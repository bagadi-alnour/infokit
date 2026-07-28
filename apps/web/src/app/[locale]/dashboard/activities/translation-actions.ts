"use server";

import { type Locale } from "@infokit/shared/i18n";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import { protectedPermissionAction } from "~/server/auth/require";
import { hashContent } from "~/server/content/editorial";
import {
  parseTranslationRequest,
  parseTranslationReview,
  requestTranslation,
  reviewTranslation,
} from "~/server/content/translation-assignments";
import { activityTranslations } from "~/server/db/schema";

/**
 * Translator collaboration for activities. The lifecycle itself lives in
 * `~/server/content/translation-assignments`; what belongs here is where an
 * accepted translation lands, still pinned to the immutable source version.
 */

const ENTITY = "activity" as const;
const activityId = z.string().uuid();

function refresh(locale: Locale, id: string) {
  revalidatePath(
    `${localizedPath("/dashboard/activities", locale)}?activity=${id}`,
  );
}

/** Send one activity language to an external translator. */
export const requestActivityTranslation = protectedPermissionAction(
  "content.translation.request",
  async (formData, locale, user) => {
    const id = activityId.parse(formData.get("activityId"));
    await requestTranslation({
      kind: ENTITY,
      entityId: id,
      request: parseTranslationRequest(formData),
      actor: user,
      locale,
      missingSource: "Activity has no translation source",
    });
    refresh(locale, id);
  },
);

type SubmittedTranslation = {
  title?: unknown;
  summary?: unknown;
  bodyHtml?: unknown;
  plainText?: unknown;
};

/**
 * Accept or reject a submitted activity translation. Accepting promotes the
 * translator's text into the verified `activity_translations` row.
 */
export const reviewActivityTranslation = protectedPermissionAction(
  "content.translation.review",
  async (formData, locale, user) => {
    const id = activityId.parse(formData.get("activityId"));
    await reviewTranslation({
      kind: ENTITY,
      entityId: id,
      review: parseTranslationReview(formData),
      actor: user,
      // No staleness check: the row below records the source version it came
      // from, so a later edit supersedes rather than clashes.
      promote: async (tx, assignment, decidedAt) => {
        const submitted =
          assignment.submittedContentJson as SubmittedTranslation | null;
        const name =
          typeof submitted?.title === "string" ? submitted.title.trim() : "";
        if (!name) throw new Error("The submitted translation has no title");
        const summary =
          typeof submitted?.summary === "string"
            ? submitted.summary.trim()
            : "";
        const descriptionHtml =
          typeof submitted?.bodyHtml === "string" ? submitted.bodyHtml : "";
        const descriptionText =
          typeof submitted?.plainText === "string" ? submitted.plainText : "";

        const translation = {
          name,
          descriptionHtml: descriptionHtml || null,
          descriptionText: descriptionText || null,
          // A card needs a short line even when the translator wrote none.
          shortDescription:
            summary || (descriptionText ? descriptionText.slice(0, 500) : null),
          state: "verified" as const,
          method: "human" as const,
          sourceVersionId: assignment.sourceVersionId,
          contentHash: hashContent({
            languageCode: assignment.targetLanguageCode,
            title: name,
            descriptionHtml: descriptionHtml || null,
            descriptionText: descriptionText || null,
          }),
          verifiedById: user.id,
          verifiedAt: decidedAt,
        };
        await tx
          .insert(activityTranslations)
          .values({
            activityId: id,
            languageCode: assignment.targetLanguageCode,
            ...translation,
          })
          .onConflictDoUpdate({
            target: [
              activityTranslations.activityId,
              activityTranslations.languageCode,
            ],
            set: translation,
          });
      },
    });
    refresh(locale, id);
  },
);
