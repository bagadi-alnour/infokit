"use server";

import { type Locale } from "@infokit/shared/i18n";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import { protectedPermissionAction } from "~/server/auth/require";
import { localizedContentHash } from "~/server/content/editorial";
import {
  parseTranslationRequest,
  parseTranslationReview,
  requestTranslation,
  reviewTranslation,
} from "~/server/content/translation-assignments";
import {
  editorialRevisionTranslations,
  translationSourceVersions,
} from "~/server/db/schema";

/**
 * Translator collaboration for articles. The lifecycle itself lives in
 * `~/server/content/translation-assignments`; what belongs here is where an
 * accepted translation lands — on the revision it was translated from.
 */

const ENTITY = "editorial_entry" as const;
const entryId = z.string().uuid();

function refresh(locale: Locale, id: string) {
  revalidatePath(
    `${localizedPath("/dashboard/articles", locale)}?article=${id}`,
  );
}

export const requestArticleTranslation = protectedPermissionAction(
  "content.translation.request",
  async (formData, locale, user) => {
    const id = entryId.parse(formData.get("entryId"));
    await requestTranslation({
      kind: ENTITY,
      entityId: id,
      request: parseTranslationRequest(formData),
      actor: user,
      locale,
      missingSource: "Article has no translation source",
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

export const reviewArticleTranslation = protectedPermissionAction(
  "content.translation.review",
  async (formData, locale, user) => {
    const id = entryId.parse(formData.get("entryId"));
    await reviewTranslation({
      kind: ENTITY,
      entityId: id,
      review: parseTranslationReview(formData),
      actor: user,
      // No staleness check: the row below hangs off the pinned revision, so a
      // later edit is a different revision rather than a clash.
      promote: async (tx, assignment, decidedAt) => {
        const submitted =
          assignment.submittedContentJson as SubmittedTranslation | null;
        const title =
          typeof submitted?.title === "string" ? submitted.title.trim() : "";
        if (!title) throw new Error("The submitted translation has no title");
        const summary =
          typeof submitted?.summary === "string"
            ? submitted.summary.trim()
            : "";
        const bodyHtml =
          typeof submitted?.bodyHtml === "string" ? submitted.bodyHtml : "";
        const plainText =
          typeof submitted?.plainText === "string" ? submitted.plainText : "";

        const [source] = await tx
          .select({ revisionId: translationSourceVersions.sourceRevisionId })
          .from(translationSourceVersions)
          .where(eq(translationSourceVersions.id, assignment.sourceVersionId))
          .limit(1);
        if (!source?.revisionId)
          throw new Error("Assignment source is invalid");

        const content = {
          title,
          summary: summary || null,
          bodyHtml: bodyHtml || null,
          plainText: plainText || null,
        };
        const translation = {
          title,
          summary: summary || null,
          bodyJson: bodyHtml ? { html: bodyHtml } : null,
          plainText: plainText || null,
          state: "verified" as const,
          method: "human" as const,
          sourceVersionId: assignment.sourceVersionId,
          contentHash: localizedContentHash(
            assignment.targetLanguageCode,
            content,
          ),
          verifiedById: user.id,
          verifiedAt: decidedAt,
        };
        await tx
          .insert(editorialRevisionTranslations)
          .values({
            revisionId: source.revisionId,
            languageCode: assignment.targetLanguageCode,
            ...translation,
          })
          .onConflictDoUpdate({
            target: [
              editorialRevisionTranslations.revisionId,
              editorialRevisionTranslations.languageCode,
            ],
            set: translation,
          });
      },
    });
    refresh(locale, id);
  },
);
