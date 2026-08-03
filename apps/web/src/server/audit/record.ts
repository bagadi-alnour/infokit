import type { AuditChanges } from "~/lib/audit-diff";
import { db } from "~/server/db";
import { auditEvents } from "~/server/db/schema";
import { auditRequestContext } from "./context";

/**
 * The one way an audit event is written.
 *
 * Everything a console mutation does goes through here, and what the caller has
 * to say is only ever *what happened* — who, when, from where, on which route,
 * in which browser is filled in from the request. That split is the point: a
 * call site cannot forget the "how", because it was never asked for it.
 *
 * Writes never fail loudly. An editor's save must not be lost because the log
 * could not be appended, so a failed write is reported to the server console and
 * the action carries on (NFR-006 keeps the trail append-only, not blocking).
 */

export type AuditOutcome = "success" | "failure" | "denied";
export type AuditSeverity = "info" | "warning" | "critical";
export type AuditActorType =
  | "user"
  | "system"
  | "provider"
  | "support"
  /** A person holding an assignment link rather than an account. */
  | "translator";

/**
 * Small, flat, and already safe to read: identifiers, counts, flags, statuses.
 * Field-level before/after belongs in `changes`, where the redaction lives —
 * metadata is not the place to smuggle a row copy.
 */
export type AuditMetadata = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * One audit event, addressed. `audit.events` is range-partitioned by
 * `occurred_at`, so its primary key is `(id, occurred_at)` and both halves are
 * needed to reference the row — `notifications.delivery_attempts` carries the
 * pair. Anything that wants to point at an audited action takes this rather
 * than a bare id, so the partition key can never be dropped on the way.
 */
export interface AuditEventRef {
  id: string;
  occurredAt: Date;
}

export interface AuditInput {
  action: string;
  subjectType: string;
  subjectId?: string | null;
  /** A title or slug — something a reader recognises, never contact data. */
  subjectLabel?: string | null;
  organizationId?: string | null;
  actorMemberId?: string | null;
  metadata?: AuditMetadata;
  reason?: string | null;
  /** Built by `auditChanges` from `~/lib/audit-diff`, and by nothing else. */
  changes?: AuditChanges;
  outcome?: AuditOutcome;
  severity?: AuditSeverity;
  errorCode?: string | null;
  durationMs?: number | null;
  /**
   * Set only when the actor is not the signed-in session: a scheduled job
   * (`system`), a provider callback (`provider`), or a sign-in attempt that
   * failed before there was a session to read.
   */
  actorUserId?: string | null;
  actorType?: AuditActorType;
  actorLabel?: string | null;
}

/** Column widths in `audit.events`, applied here so a long label cannot 500. */
const MAX_LABEL = 255;
const MAX_ACTION = 150;
const MAX_ERROR_CODE = 120;

function trim(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (cleaned === "") return null;
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

/**
 * How loudly the event reads, when the caller did not decide. A refusal or a
 * failure is at least a warning: those are the rows the security view opens on,
 * and defaulting them to `info` would bury them in the successful history.
 */
function defaultSeverity(outcome: AuditOutcome): AuditSeverity {
  return outcome === "success" ? "info" : "warning";
}

interface ResolvedActor {
  actorUserId: string | null;
  actorType: AuditActorType;
  actorLabel: string | null;
}

/**
 * The signed-in account, or nobody.
 *
 * The session module is reached by `import()` rather than at the top of this
 * file, and deliberately: the sign-in, sign-out and second-factor code all live
 * inside `server/auth`, and all of it has events worth recording. A static import
 * here would make every one of those files part of a cycle through the Better
 * Auth instance, which reaches for this module from its own database hooks — so
 * the edge is loaded on use instead, once per process, cached by the module
 * system.
 *
 * Reading the session also needs the request's headers, so a caller outside a
 * request — a scheduled job that forgot to say `actorType: "system"` — would
 * otherwise throw and lose the whole event. An event with an unknown actor is
 * worth far more than no event at all.
 */
async function sessionUser() {
  try {
    const { auth } = await import("~/server/auth");
    const session = await auth();
    return session?.user ?? null;
  } catch (error) {
    console.warn("audit actor unresolved", error);
    return null;
  }
}

/**
 * Who to record. An explicit actor wins — a system job knows it is not a person
 * — and otherwise the session answers, including the name it had at the time.
 */
async function resolveActor(input: AuditInput): Promise<ResolvedActor> {
  if (input.actorType && input.actorType !== "user") {
    return {
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType,
      actorLabel: trim(input.actorLabel, MAX_LABEL),
    };
  }
  if (input.actorUserId !== undefined && input.actorUserId !== null) {
    return {
      actorUserId: input.actorUserId,
      actorType: input.actorType ?? "user",
      actorLabel: trim(input.actorLabel, MAX_LABEL),
    };
  }
  const user = await sessionUser();
  return {
    actorUserId: user?.id ?? null,
    actorType: input.actorType ?? "user",
    actorLabel:
      trim(input.actorLabel, MAX_LABEL) ??
      trim(user?.name ?? user?.email, MAX_LABEL),
  };
}

/**
 * Append one event. Returns the reference a caused side effect — the invitation
 * email, the SMS code — points back at, or null when the write failed and there
 * is nothing to point at.
 *
 * Both columns, not just the id: `audit.events` is partitioned by `occurred_at`
 * and its primary key is `(id, occurred_at)`, so a foreign key into it needs the
 * pair. `occurred_at` is defaulted in the database, so returning it is also the
 * only way a caller learns what it was.
 */
export async function recordAudit(
  input: AuditInput,
): Promise<AuditEventRef | null> {
  try {
    const [context, actor] = await Promise.all([
      auditRequestContext(),
      resolveActor(input),
    ]);
    const outcome = input.outcome ?? "success";
    const [row] = await db
      .insert(auditEvents)
      .values({
        action: trim(input.action, MAX_ACTION) ?? "unknown",
        subjectType: input.subjectType,
        subjectId: input.subjectId ?? null,
        subjectLabel: trim(input.subjectLabel, MAX_LABEL),
        organizationId: input.organizationId ?? null,
        actorUserId: actor.actorUserId,
        actorType: actor.actorType,
        actorLabel: actor.actorLabel,
        actorMemberId: input.actorMemberId ?? null,
        outcome,
        severity: input.severity ?? defaultSeverity(outcome),
        metadata: input.metadata,
        reason: input.reason ?? null,
        changes: input.changes,
        errorCode: trim(input.errorCode, MAX_ERROR_CODE),
        durationMs: input.durationMs ?? null,
        route: context.route,
        method: context.method,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      })
      .returning({
        id: auditEvents.id,
        occurredAt: auditEvents.occurredAt,
      });
    return row ?? null;
  } catch (error) {
    console.error("audit write failed", error);
    return null;
  }
}

export interface AccessDeniedInput {
  /** The grant that was missing, e.g. `activities.publish`. */
  permissionCode: string;
  organizationId?: string | null;
  subjectType?: string;
  subjectId?: string | null;
  /** Why the gate refused, when it is more specific than "no grant". */
  reason?: string | null;
  metadata?: AuditMetadata;
}

/**
 * An attempt that the permission gate refused.
 *
 * This is the event the whole table exists for as much as any successful edit:
 * one editor probing pages they have no grant for looks like nothing at all
 * unless the refusals are written down. It records the *permission* that was
 * missing rather than a message, so "who has been hitting the publish gate this
 * week" is a query and not a reading exercise.
 */
export async function recordAccessDenied(
  input: AccessDeniedInput,
): Promise<void> {
  await recordAudit({
    action: "access.denied",
    subjectType: input.subjectType ?? "auth.permission",
    subjectId: input.subjectId ?? input.permissionCode,
    subjectLabel: input.permissionCode,
    organizationId: input.organizationId ?? null,
    outcome: "denied",
    severity: "warning",
    errorCode: "permission_denied",
    reason: input.reason ?? null,
    metadata: { permission: input.permissionCode, ...input.metadata },
  });
}

/**
 * A redirect is how a successful server action returns in this codebase, and
 * `notFound()` throws too. Neither is a failure, and recording them as one would
 * fill the trail with alarming rows describing ordinary saves.
 */
function isControlFlowError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
  );
}

/**
 * A stable code for a thrown error, never its message. Messages carry whatever
 * the throwing code interpolated — an address, a title, a whole row — and this
 * table is the wrong place to find out. The message goes to the server console,
 * where it is already at home.
 */
function errorCodeOf(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code !== "") return code;
    if (error instanceof Error && error.name !== "") return error.name;
  }
  return "unknown_error";
}

/**
 * Run a mutation and, if it throws, leave a record of the attempt before the
 * error carries on.
 *
 * Successes are not recorded here: the call site that knows *what* changed logs
 * that itself with `recordAudit`, and a second event saying "something ran"
 * would only be noise. What is missing without this is the other half of the
 * story — the saves that never landed — and an audit trail that only contains
 * what worked cannot explain a support call.
 */
export async function withFailureAudit<Result>(
  input: Omit<AuditInput, "outcome" | "durationMs" | "errorCode">,
  run: () => Promise<Result>,
): Promise<Result> {
  const startedAt = performance.now();
  try {
    return await run();
  } catch (error) {
    if (isControlFlowError(error)) throw error;
    console.error(`${input.action} failed`, error);
    await recordAudit({
      ...input,
      outcome: "failure",
      severity: input.severity ?? "warning",
      errorCode: errorCodeOf(error),
      durationMs: Math.round(performance.now() - startedAt),
    });
    throw error;
  }
}
