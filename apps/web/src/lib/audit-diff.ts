/**
 * What may be written into an audit event's `changes` column, and nothing else.
 *
 * `docs/DATABASE-SCHEMA.md` §17 forbids unrestricted before/after objects in
 * the audit trail, and the reason is worth restating: a log that quietly copies
 * whole rows will one day copy a password reset token, a member's phone number,
 * or a simulator answer, and it will do it in the one table nobody is allowed
 * to delete from. But an audit trail that only says "activity.updated" cannot
 * answer the question it exists for — *what* changed.
 *
 * So this module is the narrow door between those two failures. It keeps the
 * names of the fields that changed, masks the values that must never be read
 * back, truncates the rest to a size that cannot smuggle a document, and caps
 * how many fields one event may carry. Everything that writes `changes` goes
 * through `auditChanges`; nothing else may build that object by hand.
 */

/** The masked placeholder, so a reader can tell "hidden" from "empty". */
export const REDACTED = "[redacted]";

/** One field's before and after, already normalised and masked. */
export interface AuditFieldChange {
  from: AuditValue;
  to: AuditValue;
}

export type AuditValue =
  | string
  | number
  | boolean
  | null
  | AuditValue[]
  | { [key: string]: AuditValue };

export type AuditChanges = Record<string, AuditFieldChange>;

/**
 * Field names whose *value* never enters the log, whatever it holds.
 *
 * Matched against the key with case and separators stripped, so one entry
 * covers `passwordHash`, `password_hash` and `PasswordHash` at once. The list
 * errs towards masking a harmless field — `recipientHash` is masked and no one
 * minds — rather than letting a secret through. A masked field still records
 * *that* it changed, which is the part a review needs.
 *
 * `code` on its own is deliberately absent, and the one-time codes are spelled
 * out one by one instead. Half this schema calls its stable identifier `code` —
 * roles, permissions, cities, languages, tags — and a role code changing is
 * precisely the event a security review must be able to read. A new secret
 * column is named here; that is the cost of not masking the whole word.
 */
const MASKED_KEY_PARTS = [
  "password",
  "passphrase",
  "secret",
  "token",
  "credential",
  "otp",
  "onetimecode",
  "verificationcode",
  "confirmationcode",
  "smscode",
  "logincode",
  "authcode",
  "resetcode",
  "twofactorcode",
  "secondfactorcode",
  "mfacode",
  "challenge",
  "hash",
  "salt",
  "signature",
  "privatekey",
  "authorization",
  "cookie",
  "apikey",
  "accesskey",
  /** Simulator answers are never persisted and never logged (AGENTS.md §4). */
  "answer",
] as const;

function isMaskedKey(key: string): boolean {
  const flattened = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return MASKED_KEY_PARTS.some((part) => flattened.includes(part));
}

/** Values longer than this are cut: an audit event is evidence, not a copy. */
const MAX_STRING = 240;
/** Beyond this many changed fields, the event says so instead of listing them. */
const MAX_FIELDS = 40;
const MAX_ARRAY_ITEMS = 20;
/**
 * How far into a structure the diff reads, counting the field's own value as
 * depth 0. Two levels is deliberate: a jsonb column like an opening rule —
 * `{ days: [...], window: { from, to } }` — is worth reading in full, because
 * "the Tuesday window moved" is the whole point of looking. The level below that
 * is where a diff stops being evidence and starts being a copy of a document.
 */
const MAX_DEPTH = 2;
/**
 * The ceiling on one side of one field, measured on its JSON. The caps above
 * bound each dimension separately and still multiply: twenty array items of
 * twenty keys of long strings is a legal shape and far too much to keep in a
 * table nobody deletes from. Past this the field records only that it changed.
 */
const MAX_VALUE_JSON = 800;

/** Stored in place of a value whose structure was too large to keep. */
export const TOO_LARGE = "[too large]";

/**
 * Recorded under this key when the change set was cut short, so a reader is
 * never shown a partial diff that looks complete.
 */
export const TRUNCATED_KEY = "_truncated";

function truncate(value: string): string {
  if (value.length <= MAX_STRING) return value;
  return `${value.slice(0, MAX_STRING)}… (+${String(value.length - MAX_STRING)})`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

/**
 * One value, shrunk to something safe to store: instants as ISO strings, long
 * text cut, deep structures flattened to a marker rather than walked forever.
 */
function normalise(value: unknown, depth = 0): AuditValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string") return truncate(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return truncate(value.toString());
  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return `[${String(value.length)} items]`;
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => normalise(item, depth + 1));
    return value.length > MAX_ARRAY_ITEMS
      ? [...items, `… (+${String(value.length - MAX_ARRAY_ITEMS)})`]
      : items;
  }
  if (isPlainObject(value)) {
    if (depth >= MAX_DEPTH) return "[object]";
    const out: Record<string, AuditValue> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = isMaskedKey(key) ? REDACTED : normalise(nested, depth + 1);
    }
    return out;
  }
  // Functions, symbols, class instances: named, never serialised.
  return "[unsupported]";
}

function capSize(value: AuditValue): AuditValue {
  if (value === null || typeof value !== "object") return value;
  return JSON.stringify(value).length > MAX_VALUE_JSON ? TOO_LARGE : value;
}

/** Comparison after normalisation, so `new Date(x)` equals the same instant. */
function sameValue(left: AuditValue, right: AuditValue): boolean {
  if (left === right) return true;
  if (typeof left !== typeof right) return false;
  if (left === null || right === null) return false;
  if (typeof left === "object" || typeof right === "object") {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return false;
}

export interface AuditChangesOptions {
  /**
   * Which fields may be compared at all. Given, it is an allowlist and the
   * safest way to call this function: a column added to the table later cannot
   * appear in the log until somebody names it here. Omitted, every key of
   * either object is compared and the mask list is the only guard.
   */
  fields?: readonly string[];
  /** Extra field names to mask beyond the built-in list. */
  mask?: readonly string[];
}

/**
 * The before/after of one mutation, reduced to what an audit trail may keep.
 *
 * Only fields that actually changed are returned, so a form that saves eleven
 * columns and changes one reads as one change. Returns `undefined` when nothing
 * changed — an event with no diff should carry no `changes` column at all
 * rather than an empty object a reader has to interpret.
 */
export function auditChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  options: AuditChangesOptions = {},
): AuditChanges | undefined {
  if (!before && !after) return undefined;
  const extraMask = new Set(options.mask ?? []);
  const keys = options.fields ?? [
    ...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]),
  ];

  const changes: AuditChanges = {};
  let counted = 0;
  let dropped = 0;
  for (const key of keys) {
    const masked = isMaskedKey(key) || extraMask.has(key);
    const from = normalise(before?.[key]);
    const to = normalise(after?.[key]);
    if (sameValue(from, to)) continue;
    if (counted >= MAX_FIELDS) {
      dropped += 1;
      continue;
    }
    counted += 1;
    // Capped after the comparison, never before: two different oversized values
    // both reading `[too large]` would compare equal and lose the change.
    changes[key] = masked
      ? { from: REDACTED, to: REDACTED }
      : { from: capSize(from), to: capSize(to) };
  }

  if (counted === 0) return undefined;
  if (dropped > 0) {
    changes[TRUNCATED_KEY] = {
      from: null,
      to: `${String(dropped)} more field(s) not recorded`,
    };
  }
  return changes;
}

/**
 * The `changes` column read back for display. It is `jsonb`, so what comes out
 * of the database is `unknown`: this narrows it without trusting it, dropping
 * anything that does not look like a field change rather than rendering it.
 */
export function readAuditChanges(value: unknown): AuditChanges | null {
  if (!isPlainObject(value)) return null;
  const out: AuditChanges = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isPlainObject(entry)) continue;
    if (!("from" in entry) && !("to" in entry)) continue;
    out[key] = {
      from: normalise(entry.from),
      to: normalise(entry.to),
    };
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** One change rendered on a single line: `"draft" → "published"`. */
export function formatAuditValue(value: AuditValue): string {
  if (value === null) return "—";
  if (typeof value === "string") return value === "" ? '""' : value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}
