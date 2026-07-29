import { createHmac } from "node:crypto";

import { env } from "~/env";
import { normaliseRecipient, redactRecipient } from "~/lib/delivery-recipient";
import { db } from "~/server/db";
import { deliveryAttempts } from "~/server/db/schema";
import { auditRequestContext } from "./context";
import type { AuditEventRef } from "./record";

/**
 * The delivery ledger's write path: one row per attempt to reach somebody.
 *
 * "Did the invitation arrive?" is the support question this answers, and the
 * only honest answer is what the provider said and when. So the row keeps the
 * provider, its message id, the outcome, and how long the call took — and of the
 * recipient it keeps a masked form to read and a keyed hash to search, never the
 * address itself. Message bodies are never stored at all: `template` names what
 * was sent and the catalogue says what that template reads.
 *
 * Like the audit trail, a failed write here is reported and swallowed. An editor
 * whose invitation went out must not see an error because the ledger did not.
 */

export type DeliveryChannel = "email" | "sms" | "push" | "in_app";
export type DeliveryStatus = "queued" | "sent" | "failed" | "skipped";

export interface DeliveryInput {
  channel: DeliveryChannel;
  /** `auth.magic_link`, `auth.sms_code`, `invitation`, `translation.assignment`. */
  template: string;
  /** The address or number as the caller has it; never stored as given. */
  recipient: string;
  status: DeliveryStatus;
  /** `ses`, `sns`, or `dev-log` when the development transport swallowed it. */
  provider?: string | null;
  providerMessageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  userId?: string | null;
  organizationId?: string | null;
  locale?: string | null;
  attempt?: number;
  durationMs?: number | null;
  /**
   * The audited action that caused the send, when there was one — as
   * `recordAudit` returned it. Both halves of the reference travel together
   * because `audit.events` is partitioned and its key is `(id, occurred_at)`;
   * one object rather than two fields is what stops half of it being passed.
   */
  auditEvent?: AuditEventRef | null;
  sentAt?: Date | null;
}

const MAX_ERROR_MESSAGE = 400;
const MAX_PROVIDER_MESSAGE_ID = 255;
const MAX_ERROR_CODE = 120;
const MAX_TEMPLATE = 120;
const MAX_REDACTED = 160;

/**
 * Searchable without being reversible. A plain SHA-256 of a phone number is not
 * a secret — the whole French numbering plan can be hashed on a laptop — so the
 * digest is keyed with the deployment secret. Same address, same deployment,
 * same hash; and a copy of this table on its own reveals nothing.
 *
 * Exported because the console's ledger search needs it: an address typed into
 * the filter is hashed here and matched against the column, so "did this person
 * get their invitation?" is answerable without the table ever holding what was
 * typed.
 */
export function recipientFingerprint(recipient: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(normaliseRecipient(recipient))
    .digest("hex");
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Provider wording, with the recipient taken back out of it.
 *
 * SES and SNS quote the address in several of their errors — "the following
 * identities failed the check … name@example.org" — which would put in this
 * column exactly what the two recipient columns are shaped to keep out. So the
 * address is replaced by its masked form wherever the provider repeated it.
 */
function safeErrorMessage(
  raw: string | null | undefined,
  recipient: string,
): string | null {
  if (!raw) return null;
  const masked = redactRecipient(recipient);
  const candidates = [recipient.trim(), normaliseRecipient(recipient)].filter(
    (value) => value.length > 3,
  );
  let cleaned = raw;
  for (const candidate of new Set(candidates)) {
    cleaned = cleaned.replace(
      new RegExp(escapeForRegex(candidate), "gi"),
      masked,
    );
  }
  const collapsed = cleaned.replace(/\s+/g, " ").trim();
  if (collapsed === "") return null;
  return collapsed.length > MAX_ERROR_MESSAGE
    ? collapsed.slice(0, MAX_ERROR_MESSAGE)
    : collapsed;
}

function cap(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (cleaned === "") return null;
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

/** Append one attempt to the ledger. */
export async function recordDelivery(input: DeliveryInput): Promise<void> {
  try {
    const context = await auditRequestContext();
    await db.insert(deliveryAttempts).values({
      channel: input.channel,
      status: input.status,
      template: cap(input.template, MAX_TEMPLATE) ?? "unknown",
      recipientRedacted:
        cap(redactRecipient(input.recipient), MAX_REDACTED) ?? "•••",
      recipientHash: recipientFingerprint(input.recipient),
      userId: input.userId ?? null,
      organizationId: input.organizationId ?? null,
      locale: input.locale ?? null,
      provider: input.provider ?? null,
      providerMessageId: cap(input.providerMessageId, MAX_PROVIDER_MESSAGE_ID),
      errorCode: cap(input.errorCode, MAX_ERROR_CODE),
      errorMessage: safeErrorMessage(input.errorMessage, input.recipient),
      attempt: input.attempt ?? 1,
      durationMs: input.durationMs ?? null,
      auditEventId: input.auditEvent?.id ?? null,
      auditEventOccurredAt: input.auditEvent?.occurredAt ?? null,
      requestId: context.requestId,
      sentAt: input.sentAt ?? (input.status === "sent" ? new Date() : null),
    });
  } catch (error) {
    console.error("delivery log write failed", error);
  }
}

/** What a send reports back, so the ledger can name the message it produced. */
export interface DeliveryOutcome {
  provider: string;
  providerMessageId?: string | null;
}

/**
 * Wrap one provider call so the attempt is recorded either way.
 *
 * The failure path is the one that earns this: a send that throws is exactly the
 * case somebody will ask about tomorrow, and it is the case least likely to be
 * logged by hand. The error is re-thrown untouched — callers that already treat
 * a failed send as fatal keep doing so.
 */
export async function trackDelivery(
  input: Omit<
    DeliveryInput,
    "status" | "provider" | "providerMessageId" | "durationMs" | "errorCode"
  >,
  send: () => Promise<DeliveryOutcome>,
): Promise<void> {
  const startedAt = performance.now();
  try {
    const outcome = await send();
    await recordDelivery({
      ...input,
      status: "sent",
      provider: outcome.provider,
      providerMessageId: outcome.providerMessageId ?? null,
      durationMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    const named = error as { name?: string; message?: string } | null;
    await recordDelivery({
      ...input,
      status: "failed",
      errorCode: named?.name ?? "unknown_error",
      errorMessage: named?.message ?? null,
      durationMs: Math.round(performance.now() - startedAt),
    });
    throw error;
  }
}
