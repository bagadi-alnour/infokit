/**
 * The audit view's URL: what a reader may filter by, and how that filter is
 * written down.
 *
 * The whole state of the page lives in the query string — which view, which
 * filters, which page — so a refusal somebody found at 14:07 last Tuesday is a
 * link they can paste into a ticket rather than a set of clicks they have to
 * describe. That makes parsing the URL the security boundary it sounds like:
 * every value here is read from an untrusted string, so enums are matched
 * against a fixed list, free text is capped, and anything unrecognised becomes
 * the empty filter rather than reaching a query.
 *
 * Kept out of the server module on purpose: it is pure, so it is the part that
 * can be tested (`audit-filters.test.ts`) without a database.
 */

/** The two ledgers the page shows: audited actions, and messages sent. */
export const AUDIT_VIEWS = ["events", "deliveries"] as const;
export type AuditView = (typeof AUDIT_VIEWS)[number];

/**
 * The enum values, repeated here rather than imported from the drizzle schema:
 * this module is read by the browser bundle, and the schema pulls in the whole
 * database layer. The query module feeds these straight to `eq()` on the
 * matching column, so a value that stopped being part of an enum fails to
 * compile there.
 */
export const AUDIT_OUTCOMES = ["success", "failure", "denied"] as const;
export type AuditOutcomeFilter = (typeof AUDIT_OUTCOMES)[number];

export const AUDIT_SEVERITIES = ["info", "warning", "critical"] as const;
export type AuditSeverityFilter = (typeof AUDIT_SEVERITIES)[number];

export const DELIVERY_CHANNELS = ["email", "sms", "push", "in_app"] as const;
export type DeliveryChannelFilter = (typeof DELIVERY_CHANNELS)[number];

export const DELIVERY_STATUSES = [
  "queued",
  "sent",
  "failed",
  "skipped",
] as const;
export type DeliveryStatusFilter = (typeof DELIVERY_STATUSES)[number];

/** Rows per page. Enough to scan a busy morning without scrolling for a minute. */
export const AUDIT_PAGE_SIZE = 50;

/**
 * How long a free-text filter may be. A search term is a term; anything longer
 * is either a paste accident or somebody probing the query with a payload, and
 * neither deserves to reach the database.
 */
const MAX_TERM = 120;

/** Every filter the audit view understands, already validated. */
export interface AuditQuery {
  view: AuditView;
  /** Matches the actor's recorded name, email or account id. */
  actor: string;
  /** Prefix of an action name, e.g. `member.` or `access.denied`. */
  action: string;
  /** Matches the subject's type, id or label. */
  subject: string;
  outcome: "" | AuditOutcomeFilter;
  severity: "" | AuditSeverityFilter;
  /** Only meaningful for a reader who can see more than one organisation. */
  organizationId: string;
  channel: "" | DeliveryChannelFilter;
  status: "" | DeliveryStatusFilter;
  /**
   * A full address to look up. It is never stored, and never compared as text:
   * the query hashes it the same way the ledger did and matches that.
   */
  recipient: string;
  /** `YYYY-MM-DD`, inclusive, read in the console's timezone. */
  from: string;
  /** `YYYY-MM-DD`, inclusive — the whole day, not the instant it starts. */
  to: string;
  /** 1-based. */
  page: number;
}

export const EMPTY_AUDIT_QUERY: AuditQuery = {
  view: "events",
  actor: "",
  action: "",
  subject: "",
  outcome: "",
  severity: "",
  organizationId: "",
  channel: "",
  status: "",
  recipient: "",
  from: "",
  to: "",
  page: 1,
};

/** `searchParams` as Next hands it over. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/** One value from a parameter that may legally repeat, trimmed and capped. */
function term(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_TERM);
}

/** A value from a closed set, or the empty filter. Never anything else. */
function member<Value extends string>(
  raw: string | string[] | undefined,
  allowed: readonly Value[],
): "" | Value {
  const value = term(raw);
  return (allowed as readonly string[]).includes(value) ? (value as Value) : "";
}

/**
 * A calendar day, or nothing. The shape is checked here and the day is turned
 * into an instant by the query module, which knows the timezone the console
 * reads dates in.
 */
function day(raw: string | string[] | undefined): string {
  const value = term(raw);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function pageNumber(raw: string | string[] | undefined): number {
  const parsed = Number.parseInt(term(raw), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  // A page number is a cursor, not a jump target: past this the reader wants a
  // narrower filter, not page nine thousand.
  return Math.min(parsed, 1000);
}

export function parseAuditQuery(params: RawSearchParams): AuditQuery {
  return {
    view: member(params.view, AUDIT_VIEWS) || "events",
    actor: term(params.actor),
    action: term(params.action),
    subject: term(params.subject),
    outcome: member(params.outcome, AUDIT_OUTCOMES),
    severity: member(params.severity, AUDIT_SEVERITIES),
    organizationId: term(params.org),
    channel: member(params.channel, DELIVERY_CHANNELS),
    status: member(params.status, DELIVERY_STATUSES),
    recipient: term(params.recipient),
    from: day(params.from),
    to: day(params.to),
    page: pageNumber(params.page),
  };
}

/**
 * The query string for a link that changes part of the current filter — the
 * next page, the other view, a cleared field. Empty filters and the first page
 * are left out, so the URL says only what the reader actually chose.
 */
export function auditQueryString(
  query: AuditQuery,
  overrides: Partial<AuditQuery> = {},
): string {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (next.view !== "events") params.set("view", next.view);
  if (next.actor) params.set("actor", next.actor);
  if (next.action) params.set("action", next.action);
  if (next.subject) params.set("subject", next.subject);
  if (next.outcome) params.set("outcome", next.outcome);
  if (next.severity) params.set("severity", next.severity);
  if (next.organizationId) params.set("org", next.organizationId);
  if (next.channel) params.set("channel", next.channel);
  if (next.status) params.set("status", next.status);
  if (next.recipient) params.set("recipient", next.recipient);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.page > 1) params.set("page", String(next.page));
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** Whether anything is narrowing the list — what a "clear" control needs to know. */
export function hasAuditFilters(query: AuditQuery): boolean {
  return Boolean(
    query.actor ||
    query.action ||
    query.subject ||
    query.outcome ||
    query.severity ||
    query.organizationId ||
    query.channel ||
    query.status ||
    query.recipient ||
    query.from ||
    query.to,
  );
}
