/**
 * The audit trail's public surface (NFR-006, docs/DATABASE-SCHEMA.md §17).
 *
 * `recordAudit` is what a mutation calls; it fills in who, when and how from the
 * session and the request headers, so a call site only ever describes what it
 * did. `recordAccessDenied` is the refusal, `withFailureAudit` the attempt that
 * threw, `recordRestrictedRead` the read that is not exempt — `./reads` says
 * which those are — and `~/lib/audit-diff` builds the one thing that may go in
 * `changes`.
 *
 * The delivery ledger is deliberately *not* re-exported here. `server/auth/aws`
 * writes to it and this module reads the session, whose configuration imports
 * `server/auth/aws` in turn — importing `./deliveries` directly keeps that a
 * straight line instead of a cycle resolved at module-init time.
 */
export {
  recordAccessDenied,
  recordAudit,
  withFailureAudit,
  type AccessDeniedInput,
  type AuditActorType,
  type AuditInput,
  type AuditMetadata,
  type AuditOutcome,
  type AuditSeverity,
} from "./record";
export { auditRequestContext, type AuditRequestContext } from "./context";
export { recordRestrictedRead, type RestrictedReadInput } from "./reads";
