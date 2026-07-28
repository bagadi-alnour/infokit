"use server";

import { type Locale } from "@infokit/shared/i18n";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import { assertOrganizationWritable } from "~/server/auth/org-access";
import { protectedPermissionAction } from "~/server/auth/require";
import {
  parseTranslationRequest,
  parseTranslationReview,
  requestTranslation,
  reviewTranslation,
} from "~/server/content/translation-assignments";
import { organizationProfileTranslations } from "~/server/db/schema";

/**
 * Translator collaboration for the organisation narrative (purpose, goals,
 * values). The lifecycle itself lives in
 * `~/server/content/translation-assignments`; what belongs here is the
 * membership check and where an accepted narrative lands.
 */

const ENTITY = "organization_profile" as const;
const organizationId = z.string().uuid();

function refresh(locale: Locale, id: string) {
  revalidatePath(localizedPath(`/dashboard/organizations/${id}`, locale));
}

export const requestOrganizationTranslation = protectedPermissionAction(
  "content.translation.request",
  async (formData, locale, user) => {
    const id = organizationId.parse(formData.get("organizationId"));
    await assertOrganizationWritable(user.id, id);
    await requestTranslation({
      kind: ENTITY,
      entityId: id,
      request: parseTranslationRequest(formData),
      actor: user,
      locale,
      missingSource: "The organisation has no narrative to translate yet",
      // The narrative belongs to the organisation it describes.
      organizationId: id,
    });
    refresh(locale, id);
  },
);

type SubmittedNarrative = {
  purpose?: unknown;
  goals?: unknown;
  values?: unknown;
};

export const reviewOrganizationTranslation = protectedPermissionAction(
  "content.translation.review",
  async (formData, locale, user) => {
    const id = organizationId.parse(formData.get("organizationId"));
    await assertOrganizationWritable(user.id, id);
    await reviewTranslation({
      kind: ENTITY,
      entityId: id,
      review: parseTranslationReview(formData),
      actor: user,
      // The profile row below is not version-scoped, so a late acceptance would
      // publish a translation of a narrative nobody can read any more.
      staleSource: "The narrative changed after this translation was requested",
      promote: async (tx, assignment) => {
        const submitted =
          assignment.submittedContentJson as SubmittedNarrative | null;
        const purpose =
          typeof submitted?.purpose === "string"
            ? submitted.purpose.trim()
            : "";
        if (!purpose) {
          throw new Error("The submitted translation has no purpose text");
        }
        const narrative = {
          purpose,
          goals:
            typeof submitted?.goals === "string"
              ? submitted.goals.trim() || null
              : null,
          values:
            typeof submitted?.values === "string"
              ? submitted.values.trim() || null
              : null,
          state: "verified" as const,
          method: "human" as const,
        };
        await tx
          .insert(organizationProfileTranslations)
          .values({
            organizationId: id,
            languageCode: assignment.targetLanguageCode,
            ...narrative,
          })
          .onConflictDoUpdate({
            target: [
              organizationProfileTranslations.organizationId,
              organizationProfileTranslations.languageCode,
            ],
            set: narrative,
          });
      },
    });
    refresh(locale, id);
  },
);
