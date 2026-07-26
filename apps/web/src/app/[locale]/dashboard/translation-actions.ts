"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { editorialLanguageCodes } from "~/lib/editorial-languages";
import { getActionLocale } from "~/i18n/request-locale";
import { recordAudit } from "~/server/audit";
import { requirePermission } from "~/server/auth/require";
import {
  latestSourceVersion,
  translationAdapter,
} from "~/server/translation/entities";

/**
 * Entity-agnostic translation decisions. Both actions are the human half of
 * the workflow: a machine draft is a proposal until somebody who reads the
 * language says otherwise, and these are the two things they can say.
 */

const decisionSchema = z.object({
  entityKind: z.enum([
    "editorial_entry",
    "activity",
    "public_event",
    "simulator_flow",
    "organization_profile",
    "place",
    "service",
  ]),
  entityId: z.string().uuid(),
  languageCode: z.enum(editorialLanguageCodes),
  /** Where to revalidate afterwards; must stay inside the dashboard. */
  returnPath: z.string().startsWith("/").max(300).optional(),
});

/**
 * Confirm a translation reads correctly.
 *
 * This is the only path to `verified` for a target language, and it is gated on
 * `content.translation.verify` through `requirePermission` — the real gate,
 * not the migration-era wrapper that only enforces during superadmin role
 * tests. A badge that says a person checked this has to mean it.
 */
export async function verifyTranslation(formData: FormData) {
  const parsed = decisionSchema.parse({
    entityKind: formData.get("entityKind"),
    entityId: formData.get("entityId"),
    languageCode: formData.get("languageCode"),
    returnPath: formData.get("returnPath") ?? undefined,
  });
  const locale = await getActionLocale(formData.get("locale"));
  const adapter = translationAdapter(parsed.entityKind);
  const source = await adapter.loadSource(parsed.entityId);
  if (!source) throw new Error("This record has no saved source language");
  const user = await requirePermission(
    "content.translation.verify",
    locale,
    source.organizationId ?? undefined,
  );

  if (parsed.languageCode === source.sourceLanguageCode) {
    throw new Error("The source language is authored, not verified");
  }
  const target = await adapter.loadTarget(parsed.entityId, parsed.languageCode);
  if (!target) throw new Error("This language has no translation yet");
  if (!target.title.trim()) {
    throw new Error("An empty translation cannot be verified");
  }
  if (target.state === "verified") return;

  const sourceVersion = await latestSourceVersion(
    parsed.entityKind,
    parsed.entityId,
  );
  if (!sourceVersion) {
    throw new Error("This record has no sealed source version");
  }
  // Verifying always re-points at the newest source version: the person
  // clicking this is looking at the current source beside the translation, so
  // their confirmation is about that pairing, which also clears staleness.
  const updated = await adapter.markVerified({
    entityId: parsed.entityId,
    languageCode: parsed.languageCode,
    userId: user.id,
    sourceVersionId: sourceVersion.id,
  });
  if (!updated) throw new Error("The translation row disappeared");

  await recordAudit({
    action: "translation.verified",
    subjectType: parsed.entityKind,
    subjectId: parsed.entityId,
    organizationId: source.organizationId ?? undefined,
    metadata: {
      languageCode: parsed.languageCode,
      previousState: target.state,
      previousMethod: target.method,
      sourceVersionId: sourceVersion.id,
    },
  });
  if (parsed.returnPath?.startsWith(`/${locale}/dashboard`)) {
    revalidatePath(parsed.returnPath);
  }
}
