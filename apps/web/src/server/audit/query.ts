/**
 * The audit trail's read side: what one reader is allowed to see of it, and the
 * two queries that show it.
 *
 * The scope rule is the whole security of this page. A platform administrator
 * reads everything, including the rows that belong to no organisation — the
 * sign-ins, the platform staffing, the support access. An organisation's own
 * administrator reads their organisation's rows and nothing else, which is
 * expressed as `organization_id IN (…)` and therefore excludes the null-owned
 * platform rows by construction rather than by a filter somebody has to
 * remember. A superadmin who is testing a role reads what that role reads: the
 * test is authoritative, so their own memberships and their own platform grants
 * are both out of the picture until they leave it.
 *
 * Nothing here is exported through `~/server/audit`: that index is the write
 * path, imported by the auth gate, and the read model has no business being
 * pulled into it.
 */
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  type SQL,
} from "drizzle-orm";

import {
  AUDIT_PAGE_SIZE,
  type AuditQuery,
  type AuditOutcomeFilter,
  type AuditSeverityFilter,
  type DeliveryChannelFilter,
  type DeliveryStatusFilter,
} from "~/lib/audit-filters";
import { zonedWallTimeToInstant } from "~/lib/zoned-time";
import {
  permissionScope,
  type PermissionScope,
} from "~/server/auth/authorization";
import { db } from "~/server/db";
import {
  auditEvents,
  deliveryAttempts,
  organizations,
  users,
} from "~/server/db/schema";
import { recipientFingerprint } from "./deliveries";
import type { AuditActorType } from "./record";

/** The grant this page is behind, in the console and in the seed alike. */
export const AUDIT_PERMISSION = "audit.read";

/**
 * Dates in the console are the dates on the wall of the office reading them, not
 * UTC ones: an operator filtering "1 July" means the day that started at
 * midnight in Calais. The platform is city-first, and this is the city's zone
 * until a deployment needs its own.
 */
const CONSOLE_TIMEZONE = "Europe/Paris";

/** How far back the header counts. A week is the span of a support question. */
const STATS_WINDOW_DAYS = 7;

/**
 * Which rows one reader may see. `platform` is every row; otherwise it is the
 * listed organisations and no others — an empty list is a reader with no access
 * at all, which is why the resolver returns `null` for that case instead.
 */
export type AuditScope = PermissionScope;

/**
 * What this account may read of the trail, or `null` when the answer is nothing.
 * The ordering rule — role test first and alone, then platform grants, then
 * memberships — belongs to `permissionScope`, which every per-organisation read
 * scope on the platform now asks in exactly the same order.
 */
export async function auditScope(userId: string): Promise<AuditScope | null> {
  return permissionScope(userId, AUDIT_PERMISSION);
}

/** The organisations a reader may narrow by — their own, or all of them. */
export async function auditOrganizations(
  scope: AuditScope,
): Promise<{ id: string; name: string }[]> {
  if (!scope.platform && scope.organizationIds.length === 0) return [];
  return db
    .select({ id: organizations.id, name: organizations.displayName })
    .from(organizations)
    .where(
      scope.platform
        ? undefined
        : inArray(organizations.id, [...scope.organizationIds]),
    )
    .orderBy(organizations.displayName);
}

/** The value the organisation filter uses for the platform's own rows. */
export const PLATFORM_OWNER_VALUE = "platform";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `%` and `_` are wildcards in `LIKE`; a reader typing them means the characters. */
function contains(term: string): string {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`;
}

function startsWith(term: string): string {
  return `${term.replace(/[\\%_]/g, "\\$&")}%`;
}

/**
 * Midnight in the console's timezone, `offsetDays` from the given day. `to` is
 * an inclusive day, so its upper bound is the start of the day after it — an
 * event at 23:30 belongs to the day the reader asked for.
 */
function dayBoundary(day: string, offsetDays: number): Date | null {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return null;
  const shifted = new Date(Date.UTC(year, month - 1, date + offsetDays));
  const key = shifted.toISOString().slice(0, 10);
  return zonedWallTimeToInstant(key, "00:00", CONSOLE_TIMEZONE);
}

type Condition = SQL;

/**
 * The owner and time columns of either ledger, so the scope, organisation and
 * date filters below are written once and applied to both. Spelled as a union of
 * the actual columns rather than as a loose `AnyPgColumn`: a third table would
 * have to be named here to be filtered, which is the point — a ledger nobody
 * remembered to scope is a tenant leak.
 */
type OwnerColumn =
  typeof auditEvents.organizationId | typeof deliveryAttempts.organizationId;
type TimeColumn =
  typeof auditEvents.occurredAt | typeof deliveryAttempts.createdAt;

/** The scope, as the one condition every query on this page starts from. */
function scopeCondition(
  column: OwnerColumn,
  scope: AuditScope,
): Condition | undefined {
  if (scope.platform) return undefined;
  return inArray(column, [...scope.organizationIds]);
}

/**
 * The organisation the reader asked for, kept inside what they may see. An id
 * outside the scope is dropped rather than refused: the filter is a convenience,
 * and the scope above it is the guarantee.
 */
function organizationCondition(
  column: OwnerColumn,
  scope: AuditScope,
  requested: string,
): Condition | undefined {
  if (requested === "") return undefined;
  if (requested === PLATFORM_OWNER_VALUE) {
    return scope.platform ? isNull(column) : undefined;
  }
  if (!UUID.test(requested)) return undefined;
  if (!scope.platform && !scope.organizationIds.includes(requested)) {
    return undefined;
  }
  return eq(column, requested);
}

function timeConditions(
  column: TimeColumn,
  query: AuditQuery,
): (Condition | undefined)[] {
  const from = query.from ? dayBoundary(query.from, 0) : null;
  const until = query.to ? dayBoundary(query.to, 1) : null;
  return [
    from ? gte(column, from) : undefined,
    until ? lt(column, until) : undefined,
  ];
}

/** One event, ready to render: no raw row, no column the page does not show. */
export interface AuditEventRow {
  id: string;
  occurredAt: Date;
  action: string;
  outcome: AuditOutcomeFilter;
  severity: AuditSeverityFilter;
  actorType: AuditActorType;
  /** The name the actor had at the time, falling back to the account's now. */
  actorLabel: string | null;
  actorUserId: string | null;
  subjectType: string | null;
  subjectId: string | null;
  subjectLabel: string | null;
  organizationId: string | null;
  organizationName: string | null;
  reason: string | null;
  metadata: unknown;
  /** Redacted per-field before/after; read back through `~/lib/audit-diff`. */
  changes: unknown;
  route: string | null;
  method: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  errorCode: string | null;
  durationMs: number | null;
  requestId: string | null;
}

export interface AuditPage<Row> {
  rows: Row[];
  /** Matching rows in total, so the reader knows what they are paging through. */
  total: number;
  page: number;
  pageSize: number;
}

/** The audited actions, newest first, filtered as the URL asked. */
export async function listAuditEvents(
  scope: AuditScope,
  query: AuditQuery,
): Promise<AuditPage<AuditEventRow>> {
  const where = and(
    scopeCondition(auditEvents.organizationId, scope),
    organizationCondition(
      auditEvents.organizationId,
      scope,
      query.organizationId,
    ),
    ...timeConditions(auditEvents.occurredAt, query),
    query.outcome ? eq(auditEvents.outcome, query.outcome) : undefined,
    query.severity ? eq(auditEvents.severity, query.severity) : undefined,
    query.action
      ? ilike(auditEvents.action, startsWith(query.action))
      : undefined,
    query.actor
      ? or(
          ilike(auditEvents.actorLabel, contains(query.actor)),
          ilike(users.name, contains(query.actor)),
          ilike(users.email, contains(query.actor)),
          eq(auditEvents.actorUserId, query.actor),
        )
      : undefined,
    query.subject
      ? or(
          ilike(auditEvents.subjectLabel, contains(query.subject)),
          ilike(auditEvents.subjectType, contains(query.subject)),
          eq(auditEvents.subjectId, query.subject),
        )
      : undefined,
  );

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: auditEvents.id,
        occurredAt: auditEvents.occurredAt,
        action: auditEvents.action,
        outcome: auditEvents.outcome,
        severity: auditEvents.severity,
        actorType: auditEvents.actorType,
        actorLabel: auditEvents.actorLabel,
        actorUserId: auditEvents.actorUserId,
        actorName: users.name,
        actorEmail: users.email,
        subjectType: auditEvents.subjectType,
        subjectId: auditEvents.subjectId,
        subjectLabel: auditEvents.subjectLabel,
        organizationId: auditEvents.organizationId,
        organizationName: organizations.displayName,
        reason: auditEvents.reason,
        metadata: auditEvents.metadata,
        changes: auditEvents.changes,
        route: auditEvents.route,
        method: auditEvents.method,
        ipAddress: auditEvents.ipAddress,
        userAgent: auditEvents.userAgent,
        errorCode: auditEvents.errorCode,
        durationMs: auditEvents.durationMs,
        requestId: auditEvents.requestId,
      })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorUserId))
      .leftJoin(organizations, eq(organizations.id, auditEvents.organizationId))
      .where(where)
      .orderBy(desc(auditEvents.occurredAt))
      .limit(AUDIT_PAGE_SIZE)
      .offset((query.page - 1) * AUDIT_PAGE_SIZE),
    db
      .select({ value: count() })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorUserId))
      .where(where),
  ]);

  return {
    rows: rows.map(({ actorName, actorEmail, ...row }) => ({
      ...row,
      // The stored label is what the account was called when it acted; the join
      // only fills in rows written before that column existed.
      actorLabel: row.actorLabel ?? actorName ?? actorEmail ?? null,
    })),
    total: totals[0]?.value ?? 0,
    page: query.page,
    pageSize: AUDIT_PAGE_SIZE,
  };
}

/** One attempt to reach somebody, as the ledger recorded it. */
export interface DeliveryRow {
  id: string;
  createdAt: Date;
  sentAt: Date | null;
  channel: DeliveryChannelFilter;
  status: DeliveryStatusFilter;
  template: string;
  /** `b•••i@example.com` — never the address itself. */
  recipientRedacted: string;
  locale: string | null;
  provider: string | null;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attempt: number;
  durationMs: number | null;
  organizationName: string | null;
  /** The audited action that caused the send, when there was one. */
  causeAction: string | null;
  auditEventId: string | null;
  requestId: string | null;
}

/** The delivery ledger, newest first. */
export async function listDeliveries(
  scope: AuditScope,
  query: AuditQuery,
): Promise<AuditPage<DeliveryRow>> {
  const where = and(
    scopeCondition(deliveryAttempts.organizationId, scope),
    organizationCondition(
      deliveryAttempts.organizationId,
      scope,
      query.organizationId,
    ),
    ...timeConditions(deliveryAttempts.createdAt, query),
    query.channel ? eq(deliveryAttempts.channel, query.channel) : undefined,
    query.status ? eq(deliveryAttempts.status, query.status) : undefined,
    // The address is hashed the way the ledger hashed it and matched on that,
    // so a support search never puts a plain address into a query log either.
    query.recipient
      ? eq(
          deliveryAttempts.recipientHash,
          recipientFingerprint(query.recipient),
        )
      : undefined,
    query.action
      ? ilike(deliveryAttempts.template, startsWith(query.action))
      : undefined,
  );

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: deliveryAttempts.id,
        createdAt: deliveryAttempts.createdAt,
        sentAt: deliveryAttempts.sentAt,
        channel: deliveryAttempts.channel,
        status: deliveryAttempts.status,
        template: deliveryAttempts.template,
        recipientRedacted: deliveryAttempts.recipientRedacted,
        locale: deliveryAttempts.locale,
        provider: deliveryAttempts.provider,
        providerMessageId: deliveryAttempts.providerMessageId,
        errorCode: deliveryAttempts.errorCode,
        errorMessage: deliveryAttempts.errorMessage,
        attempt: deliveryAttempts.attempt,
        durationMs: deliveryAttempts.durationMs,
        organizationName: organizations.displayName,
        causeAction: auditEvents.action,
        auditEventId: deliveryAttempts.auditEventId,
        requestId: deliveryAttempts.requestId,
      })
      .from(deliveryAttempts)
      .leftJoin(
        organizations,
        eq(organizations.id, deliveryAttempts.organizationId),
      )
      // Both key columns: `audit.events` is partitioned by `occurred_at`, and
      // joining on the id alone would make the planner read every partition to
      // resolve one row. The equality on the partition column is what prunes.
      .leftJoin(
        auditEvents,
        and(
          eq(auditEvents.id, deliveryAttempts.auditEventId),
          eq(auditEvents.occurredAt, deliveryAttempts.auditEventOccurredAt),
        ),
      )
      .where(where)
      .orderBy(desc(deliveryAttempts.createdAt))
      .limit(AUDIT_PAGE_SIZE)
      .offset((query.page - 1) * AUDIT_PAGE_SIZE),
    db.select({ value: count() }).from(deliveryAttempts).where(where),
  ]);

  return {
    rows,
    total: totals[0]?.value ?? 0,
    page: query.page,
    pageSize: AUDIT_PAGE_SIZE,
  };
}

/**
 * The four numbers the page opens with, over the last week and inside the
 * reader's scope. Deliberately independent of the filters: they are there to
 * say whether this week needs attention, and a count that moved every time
 * somebody narrowed the list could not answer that.
 */
export interface AuditStats {
  events: number;
  denied: number;
  failures: number;
  failedDeliveries: number;
  windowDays: number;
}

export async function auditStats(scope: AuditScope): Promise<AuditStats> {
  const since = new Date(Date.now() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const eventScope = scopeCondition(auditEvents.organizationId, scope);
  const window = gte(auditEvents.occurredAt, since);
  const countEvents = (condition?: Condition) =>
    db
      .select({ value: count() })
      .from(auditEvents)
      .where(and(eventScope, window, condition));

  const [events, denied, failures, failedDeliveries] = await Promise.all([
    countEvents(),
    countEvents(eq(auditEvents.outcome, "denied")),
    countEvents(eq(auditEvents.outcome, "failure")),
    db
      .select({ value: count() })
      .from(deliveryAttempts)
      .where(
        and(
          scopeCondition(deliveryAttempts.organizationId, scope),
          gte(deliveryAttempts.createdAt, since),
          eq(deliveryAttempts.status, "failed"),
        ),
      ),
  ]);

  return {
    events: events[0]?.value ?? 0,
    denied: denied[0]?.value ?? 0,
    failures: failures[0]?.value ?? 0,
    failedDeliveries: failedDeliveries[0]?.value ?? 0,
    windowDays: STATS_WINDOW_DAYS,
  };
}

/**
 * The action names actually present in the reader's scope, for the filter's
 * menu. Read from the table rather than from a hand-kept list: an action that
 * exists in the trail but not in the menu is an action nobody can filter for.
 */
export async function auditActionNames(scope: AuditScope): Promise<string[]> {
  const rows = await db
    .selectDistinct({ action: auditEvents.action })
    .from(auditEvents)
    .where(scopeCondition(auditEvents.organizationId, scope))
    .orderBy(auditEvents.action)
    .limit(200);
  return rows.map((row) => row.action);
}

/**
 * The action families — everything before the first dot — so the menu can offer
 * `member.` before it offers all eleven `member.*` names. Grouped in JS from the
 * list above rather than by a second query: the distinct names are already read.
 */
export function auditActionFamilies(actions: readonly string[]): string[] {
  const families = new Set<string>();
  for (const action of actions) {
    const [family] = action.split(".");
    if (family && family !== action) families.add(`${family}.`);
  }
  return [...families].sort((left, right) => left.localeCompare(right));
}
