import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { organizationMembers } from "./access";
import { users } from "./auth";
import { organizations } from "./organizations";
import { audit, auditActorType, auditOutcome, auditSeverity } from "./schemas";

/**
 * Append-only audit events (docs/DATABASE-SCHEMA.md §17, NFR-006).
 *
 * One row answers four questions about one attempt: who (`actor_*`), what
 * (`action`, `subject_*`, `changes`), when (`occurred_at`), and how (`route`,
 * `method`, `ip_address`, `user_agent`, `request_id`). A refused attempt is an
 * event like any other — `outcome = 'denied'` — because the attempts nobody
 * records are exactly the ones a review needs.
 *
 * `changes` is a *restricted* before/after: `~/lib/audit-diff` decides what may
 * be written, keeping the changed field names and dropping or masking their
 * values by name and by size. Never write a whole row object here, and never a
 * password, token, second-factor code, simulator answer, or signed-document
 * content — the diff module is the only supported way in.
 *
 * `ip_address` and `user_agent` are personal data kept for security review, so
 * they carry the table's retention policy (§17) rather than living forever.
 * Rows are never updated or deleted by application code.
 *
 * The table is **range-partitioned by `occurred_at`**, one partition per month
 * (docs/DATABASE-SCHEMA.md §17). Retention is the reason: dropping a month of
 * expired security logs is then a `DROP TABLE` on one partition instead of a
 * `DELETE` that has to walk the largest table on the platform and leave its
 * dead tuples behind. Every query here already filters or orders on
 * `occurred_at`, so the partition pruning is free.
 *
 * Drizzle does not model partitioning, so two things live outside this file:
 * `PARTITION BY RANGE (occurred_at)` is a hand-edit in the `0000` baseline, and
 * the monthly partitions plus a `DEFAULT` catch-all are `0001`. The default
 * partition matters — a partitioned table with no partition for a row rejects
 * the insert, and an audit write that throws would take the audited action down
 * with it.
 */
export const auditEvents = audit.table(
  "events",
  {
    // Not `.primaryKey()`: Postgres requires the partition key in every unique
    // constraint, so the key is `(id, occurred_at)` in the extras below.
    id: uuid("id").notNull().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    /** The membership the action was taken through, when it was taken inside one. */
    actorMemberId: uuid("actor_member_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    /**
     * Who the actor was at the time, in words: the account's name or email as
     * it read when the event happened. The FK answers "which account?" and
     * stops answering the moment the account is renamed or removed — an audit
     * trail that loses the name of the person it is about has lost the point.
     */
    actorLabel: varchar("actor_label", { length: 255 }),
    actorType: auditActorType("actor_type").notNull().default("user"),
    action: varchar("action", { length: 150 }).notNull(),
    subjectType: varchar("subject_type", { length: 100 }),
    subjectId: varchar("subject_id", { length: 255 }),
    /** A safe human label for the subject — a title or a slug, never contact data. */
    subjectLabel: varchar("subject_label", { length: 255 }),
    outcome: auditOutcome("outcome").notNull().default("success"),
    severity: auditSeverity("severity").notNull().default("info"),
    reason: text("reason"),
    metadata: jsonb("metadata"),
    /** Redacted per-field before/after, written only through `~/lib/audit-diff`. */
    changes: jsonb("changes"),
    /**
     * Which surface the attempt came in on: the pathname of the page or API
     * route, without its query string — a query string is where identifiers and
     * search terms end up, and neither belongs in a security log.
     */
    route: varchar("route", { length: 255 }),
    method: varchar("method", { length: 10 }),
    /** Client address as the proxy reported it; IPv6 fits in 45 characters. */
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 400 }),
    /** Stable code for a refusal or a failure — never a raw exception message. */
    errorCode: varchar("error_code", { length: 120 }),
    durationMs: integer("duration_ms"),
    requestId: varchar("request_id", { length: 100 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // `id` leads, so a lookup by id alone still uses the key's index; the
    // partition column follows because it is what makes the key legal at all.
    primaryKey({ name: "audit_events_pk", columns: [t.id, t.occurredAt] }),
    index("audit_events_org_time_idx").on(t.organizationId, t.occurredAt),
    index("audit_events_subject_idx").on(t.subjectType, t.subjectId),
    index("audit_events_time_idx").on(t.occurredAt),
    index("audit_events_actor_time_idx").on(t.actorUserId, t.occurredAt),
    index("audit_events_action_time_idx").on(t.action, t.occurredAt),
    // The security view opens on refusals and failures, and they are a small
    // fraction of the table: a partial index keeps that first screen cheap
    // however long the successful history grows.
    index("audit_events_attention_time_idx")
      .on(t.occurredAt)
      .where(sql`${t.outcome} <> 'success'`),
  ],
);

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  actor: one(users, {
    fields: [auditEvents.actorUserId],
    references: [users.id],
  }),
  actorMember: one(organizationMembers, {
    fields: [auditEvents.actorMemberId],
    references: [organizationMembers.id],
  }),
  organization: one(organizations, {
    fields: [auditEvents.organizationId],
    references: [organizations.id],
  }),
}));
