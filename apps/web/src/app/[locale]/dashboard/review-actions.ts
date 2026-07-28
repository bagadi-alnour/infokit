"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActionLocale } from "~/i18n/request-locale";
import { editorialLanguageCodes } from "~/lib/editorial-languages";
import { recordAudit } from "~/server/audit";
import { requirePermission } from "~/server/auth/require";
import {
  platformVerifyPermission,
  reviewAdapter,
  reviewEntityKinds,
} from "~/server/content/language-review";

/**
 * Sending one language through review, and the answers that come back.
 *
 * Entity-agnostic like its neighbour `translation-actions.ts`, and for the same
 * reason: an article and an activity ask the same two questions of a language —
 * would a colleague read this through, and has the platform confirmed it — so
 * the chain is written once. What differs per entity is only which grant means
 * "author" and which means "colleague", and that lives in the adapter.
 */

const targetSchema = z.object({
  entityKind: z.enum(reviewEntityKinds),
  entityId: z.string().uuid(),
  languageCode: z.enum(editorialLanguageCodes),
  /** A word to whoever is being asked, or the reason it came back. */
  note: z.string().max(2000).optional(),
  /** Where to revalidate afterwards; must stay inside the dashboard. */
  returnPath: z.string().startsWith("/").max(300).optional(),
});

const requestSchema = targetSchema.extend({
  stage: z.enum(["team", "platform"]),
});

const decisionSchema = targetSchema.extend({
  decision: z.enum([
    "team_validated",
    "platform_verified",
    "changes_requested",
  ]),
});

function read(formData: FormData) {
  const note = formData.get("note");
  return {
    entityKind: formData.get("entityKind"),
    entityId: formData.get("entityId"),
    languageCode: formData.get("languageCode"),
    note: typeof note === "string" && note.trim() ? note.trim() : undefined,
    returnPath: formData.get("returnPath") ?? undefined,
  };
}

function refresh(returnPath: string | undefined, locale: string) {
  if (returnPath?.startsWith(`/${locale}/dashboard`)) {
    revalidatePath(returnPath);
  }
}

/**
 * Ask for a language to be looked at — by a colleague, or by the platform.
 *
 * The platform stage can be asked for directly: team validation helps, but it is
 * not a queue everything has to pass through first.
 */
export async function requestLanguageReview(formData: FormData) {
  const parsed = requestSchema.parse({
    ...read(formData),
    stage: formData.get("stage"),
  });
  const locale = await getActionLocale(formData.get("locale"));
  const adapter = reviewAdapter(parsed.entityKind);
  const language = await adapter.load(parsed.entityId, parsed.languageCode);
  if (!language) throw new Error("This record no longer exists");
  if (!language.title.trim()) {
    throw new Error("There is nothing written in this language to review yet");
  }
  const user = await requirePermission(
    adapter.authorPermission,
    locale,
    language.organizationId ?? undefined,
  );

  const stage =
    parsed.stage === "team" ? "team_requested" : "platform_requested";
  const moved = await adapter.patch(parsed.entityId, parsed.languageCode, {
    stage,
    reviewRequestedById: user.id,
    reviewRequestedAt: new Date(),
    reviewNote: parsed.note ?? null,
  });
  if (!moved) throw new Error("This language has no saved text yet");

  await recordAudit({
    action: "translation.review_requested",
    subjectType: adapter.subjectType,
    subjectId: parsed.entityId,
    organizationId: language.organizationId ?? undefined,
    metadata: {
      languageCode: parsed.languageCode,
      stage,
      previousStage: language.stage,
    },
  });
  refresh(parsed.returnPath, locale);
}

/**
 * The answer. Three of them, and who may give each is the whole point:
 *
 * - a colleague validating reads the entity's own review grant;
 * - the platform verifying needs `content.translation.verify` at platform scope,
 *   which is what `requirePermission` checks when no organisation is named —
 *   an association's own translation reviewer cannot sign off for the platform;
 * - sending it back belongs to whoever is currently holding it.
 */
export async function decideLanguageReview(formData: FormData) {
  const parsed = decisionSchema.parse({
    ...read(formData),
    decision: formData.get("decision"),
  });
  const locale = await getActionLocale(formData.get("locale"));
  const adapter = reviewAdapter(parsed.entityKind);
  const language = await adapter.load(parsed.entityId, parsed.languageCode);
  if (!language) throw new Error("This record no longer exists");

  const asPlatform =
    parsed.decision === "platform_verified" ||
    (parsed.decision === "changes_requested" &&
      language.stage !== "team_requested");
  const user = asPlatform
    ? await requirePermission(platformVerifyPermission, locale)
    : await requirePermission(
        adapter.teamPermission,
        locale,
        language.organizationId ?? undefined,
      );

  const now = new Date();
  const decided = await adapter.patch(parsed.entityId, parsed.languageCode, {
    stage: parsed.decision,
    reviewNote: parsed.note ?? null,
    ...(parsed.decision === "team_validated"
      ? { teamValidatedById: user.id, teamValidatedAt: now }
      : {}),
    ...(parsed.decision === "platform_verified"
      ? { verifiedById: user.id, verifiedAt: now }
      : {}),
  });
  if (!decided) throw new Error("This language has no saved text yet");

  await recordAudit({
    action: "translation.review_decided",
    subjectType: adapter.subjectType,
    subjectId: parsed.entityId,
    organizationId: language.organizationId ?? undefined,
    metadata: {
      languageCode: parsed.languageCode,
      decision: parsed.decision,
      previousStage: language.stage,
    },
  });
  refresh(parsed.returnPath, locale);
}
