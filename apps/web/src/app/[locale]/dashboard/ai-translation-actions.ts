"use server";

import { z } from "zod";

import { getActionLocale } from "~/i18n/request-locale";
import { editorialLanguageCodes } from "~/lib/editorial-languages";
import { recordAudit } from "~/server/audit";
import { requirePermission } from "~/server/auth/require";
import { sanitizeRichText } from "~/server/content/sanitize-rich-text";
import { generateTranslation } from "~/server/translation/generate";
import { translationAdapter } from "~/server/translation/entities";

/**
 * Machine-translate one language, for any entity.
 *
 * The source can arrive two ways. On an existing record the server reads the
 * saved source language, which is authoritative. On the creation form nothing
 * is saved yet, so the unsaved source travels in the request — otherwise an
 * editor would have to save, reload, and only then translate. Either way the
 * proposal comes back signed, so the save path decides its provenance.
 */

const proposeSchema = z.object({
  entityKind: z.enum([
    "editorial_entry",
    "activity",
    "public_event",
    "simulator_flow",
    "organization_profile",
    "place",
    "service",
  ]),
  entityId: z.string().uuid().optional(),
  targetLanguageCode: z.enum(editorialLanguageCodes),
  /** Unsaved source, used only when `entityId` is absent. */
  sourceLanguageCode: z.enum(editorialLanguageCodes).optional(),
  sourceTitle: z.string().max(150).optional(),
  sourceBodyHtml: z.string().max(200_000).optional(),
  /** Cover-image alt text to translate alongside the body, if there is one. */
  sourceAltText: z.string().max(500).optional(),
  /** Scope for the permission check on the creation form. */
  organizationId: z.string().uuid().optional(),
});

function optional(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function proposeTranslation(formData: FormData) {
  const parsed = proposeSchema.parse({
    entityKind: formData.get("entityKind"),
    entityId: optional(formData.get("entityId")),
    targetLanguageCode: formData.get("targetLanguageCode"),
    sourceLanguageCode: optional(formData.get("sourceLanguageCode")),
    sourceTitle: optional(formData.get("sourceTitle")),
    sourceBodyHtml: optional(formData.get("sourceBodyHtml")),
    sourceAltText: optional(formData.get("sourceAltText")),
    organizationId: optional(formData.get("organizationId")),
  });
  const locale = await getActionLocale(formData.get("locale"));
  const adapter = translationAdapter(parsed.entityKind);

  const saved = parsed.entityId
    ? await adapter.loadSource(parsed.entityId)
    : null;
  if (parsed.entityId && !saved) {
    throw new Error("The saved source translation is unavailable");
  }
  const organizationId = saved?.organizationId ?? parsed.organizationId;
  await requirePermission(
    adapter.managePermission,
    locale,
    organizationId ?? undefined,
  );

  const sourceLanguage = saved?.sourceLanguageCode ?? parsed.sourceLanguageCode;
  if (!sourceLanguage) {
    throw new Error("The source language is required");
  }
  // An unsaved draft is untrusted input like any other form field.
  const unsavedBody = parsed.sourceBodyHtml
    ? sanitizeRichText(parsed.sourceBodyHtml)
    : null;
  const title = saved?.title ?? parsed.sourceTitle ?? "";
  const bodyHtml = saved?.bodyHtml ?? unsavedBody?.html ?? null;
  const plainText = saved?.plainText ?? unsavedBody?.text ?? null;

  const proposal = await generateTranslation({
    entityKind: parsed.entityKind,
    sourceLanguage,
    targetLanguage: parsed.targetLanguageCode,
    title,
    bodyHtml,
    plainText,
    altText: parsed.sourceAltText,
  });

  /**
   * Existing activities can save one language independently, so generating a
   * draft must not leave the only copy in browser state. Creation forms and
   * versioned entities still receive the signed proposal for their owning form
   * to persist atomically.
   */
  const draftSaved =
    parsed.entityId && adapter.saveMachineDraft
      ? await adapter.saveMachineDraft({
          entityId: parsed.entityId,
          languageCode: parsed.targetLanguageCode,
          title: proposal.title,
          bodyHtml: proposal.html,
          plainText: proposal.text,
          signature: proposal.signature,
        })
      : false;
  if (parsed.entityId && adapter.saveMachineDraft && !draftSaved) {
    throw new Error("The generated translation could not be saved");
  }

  await recordAudit({
    action: "translation.ai_proposed",
    subjectType: parsed.entityKind,
    subjectId: parsed.entityId,
    organizationId: organizationId ?? undefined,
    metadata: {
      model: proposal.model,
      sourceLanguage,
      targetLanguage: parsed.targetLanguageCode,
      sourceSaved: Boolean(parsed.entityId),
      draftSaved,
    },
  });

  return {
    title: proposal.title,
    html: proposal.html,
    text: proposal.text,
    altText: proposal.altText,
    signature: proposal.signature,
    saved: draftSaved,
  };
}
