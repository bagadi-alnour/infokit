import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "~/env";
import { hashContent } from "~/server/content/editorial";
import type { EditorialLanguage } from "~/lib/editorial-languages";

/**
 * Where a target-language translation came from, decided by the server.
 *
 * The badge an editor sees — and eventually the notice a reader sees — is only
 * worth what its provenance is worth, so `method` and `state` are never read
 * from the submitted form. A generated proposal travels back to the browser
 * carrying a signature over its own content; the save path re-derives the hash
 * from what was actually submitted and compares. That means the three answers
 * are distinguishable without trusting the client:
 *
 * - no signature            → an editor wrote this themselves
 * - signature, hash matches → untouched machine output
 * - signature, hash differs → machine output an editor has since edited
 */

export type TranslationMethod = "human" | "ai" | "ai_then_human_review";
export type TranslationState =
  "draft" | "machine_generated" | "needs_review" | "verified" | "rejected";

/** Entity kinds that can carry a translation, mirroring the DB enum. */
export type TranslationEntityKind =
  | "editorial_entry"
  | "activity"
  | "public_event"
  | "simulator_flow"
  | "organization_profile"
  | "place"
  | "service";

export interface TranslationProvenance {
  method: TranslationMethod;
  state: TranslationState;
  /** Provider identifier, recorded only for machine output. */
  providerCode: string | null;
}

interface ProposalClaim {
  /** Entity kind the proposal was generated for. */
  k: TranslationEntityKind;
  /** Target language the proposal was generated for. */
  l: EditorialLanguage;
  /** Hash of the generated payload, as the provider returned it. */
  h: string;
  /** `provider:model` that produced it. */
  m: string;
}

/**
 * Thrown when a proposal signature is present but does not verify. A missing
 * signature is an ordinary human edit; a broken one means the payload was
 * rewritten in transit, which is never a state we should quietly relabel.
 */
export class TranslationProvenanceError extends Error {
  constructor() {
    super("The translation proposal signature is invalid");
    this.name = "TranslationProvenanceError";
  }
}

function sign(payload: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(payload)
    .digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Canonical hash of one translated payload. Callers pass whichever fields the
 * entity actually translates; key order does not matter.
 *
 * String values are whitespace-normalised first. Generated HTML is round-
 * tripped through the rich-text editor before it comes back on save, and that
 * reserialisation shifts insignificant whitespace — hashing it raw would
 * report every untouched machine draft as edited by a human.
 */
export function translationPayloadHash(payload: Record<string, unknown>) {
  const normalized = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value,
    ]),
  );
  return hashContent(normalized);
}

/**
 * Seal a generated proposal so the save path can recognise it later. The token
 * is opaque to the browser and only meaningful to this server.
 */
export function signTranslationProposal(claim: ProposalClaim): string {
  const body = Buffer.from(JSON.stringify(claim)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function readProposal(token: string): ProposalClaim {
  const [body, signature] = token.split(".");
  if (!body || !signature || !safeEqual(signature, sign(body))) {
    throw new TranslationProvenanceError();
  }
  try {
    return JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as ProposalClaim;
  } catch {
    throw new TranslationProvenanceError();
  }
}

/**
 * Decide the stored `method` and `state` for one target language.
 *
 * `payload` must be the content as submitted, so an editor who tweaks a machine
 * draft is recorded as having reviewed it rather than as its author.
 */
export function resolveTranslationProvenance({
  entityKind,
  targetLanguageCode,
  payload,
  signature,
}: {
  entityKind: TranslationEntityKind;
  targetLanguageCode: EditorialLanguage;
  payload: Record<string, unknown>;
  signature: string | null | undefined;
}): TranslationProvenance {
  if (!signature) {
    return { method: "human", state: "draft", providerCode: null };
  }
  const claim = readProposal(signature);
  // A proposal generated for one language must not be able to vouch for
  // another, so the claim is bound to both the entity kind and the target.
  if (claim.k !== entityKind || claim.l !== targetLanguageCode) {
    throw new TranslationProvenanceError();
  }
  if (claim.h === translationPayloadHash(payload)) {
    return { method: "ai", state: "machine_generated", providerCode: claim.m };
  }
  return {
    method: "ai_then_human_review",
    state: "needs_review",
    providerCode: claim.m,
  };
}

/**
 * The source language is authored, never translated: it is `human` by
 * definition, and `verified` the moment its author saves it.
 */
export function sourceProvenance(): TranslationProvenance {
  return { method: "human", state: "verified", providerCode: null };
}

/** What the database already holds for one target language, if anything. */
export interface ExistingTranslation {
  method: TranslationMethod;
  state: TranslationState;
  providerCode: string | null;
  /** The stored payload, hashed with `translationPayloadHash`. */
  payload: Record<string, unknown>;
}

/**
 * Decide what to store for one language on save.
 *
 * A signature only exists for the request that generated a proposal, so re-
 * saving a form must not silently relabel untouched machine output as human.
 * The stored payload therefore acts as the fallback witness: identical content
 * keeps its current provenance, and changed content keeps its machine lineage
 * while dropping back to `needs_review`.
 */
export function classifyTranslation({
  entityKind,
  targetLanguageCode,
  payload,
  signature,
  existing,
  isSource,
}: {
  entityKind: TranslationEntityKind;
  targetLanguageCode: EditorialLanguage;
  payload: Record<string, unknown>;
  signature: string | null | undefined;
  existing?: ExistingTranslation | null;
  isSource: boolean;
}): TranslationProvenance {
  if (isSource) return sourceProvenance();
  if (signature) {
    return resolveTranslationProvenance({
      entityKind,
      targetLanguageCode,
      payload,
      signature,
    });
  }
  if (!existing) {
    return { method: "human", state: "draft", providerCode: null };
  }
  const unchanged =
    translationPayloadHash(existing.payload) ===
    translationPayloadHash(payload);
  if (unchanged) {
    return {
      method: existing.method,
      state: existing.state,
      providerCode: existing.providerCode,
    };
  }
  // Edited text can no longer claim to be verified, and an edited machine
  // draft is exactly what `ai_then_human_review` describes.
  if (existing.method === "ai" || existing.method === "ai_then_human_review") {
    return {
      method: "ai_then_human_review",
      state: "needs_review",
      providerCode: existing.providerCode,
    };
  }
  return { method: "human", state: "draft", providerCode: null };
}
