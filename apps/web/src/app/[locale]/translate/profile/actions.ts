"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRouteLocale } from "~/i18n/route-locale";
import { recordAudit } from "~/server/audit";
import { db } from "~/server/db";
import { translationAssignments } from "~/server/db/schema";
import { validLanguageCodes } from "~/server/members";
import { readTranslationAssignmentSession } from "~/server/translation-assignment-session";
import { replaceTranslatorProfileFacets } from "~/server/translators";

/**
 * Bounded like the member profile's own schema, and for the same reason: the
 * lists are pickers, so a form posting forty skills is not a translator filling
 * in a profile.
 */
const profileSchema = z.object({
  locale: z.enum(["fr", "en", "ar"]),
  languages: z.array(z.string().min(2).max(35)).max(30),
  skillIds: z.array(z.string().uuid()).max(40),
  courseIds: z.array(z.string().uuid()).max(40),
});

/**
 * A translator filling in their own profile from an assignment link.
 *
 * Nothing here is authorised by an account: the session cookie names one
 * assignment, and that assignment names at most one directory entry, so the
 * translator id can only ever be their own. The form never carries it.
 */
export async function saveTranslatorProfile(formData: FormData) {
  const parsed = profileSchema.parse({
    locale: formData.get("locale"),
    languages: formData.getAll("languages"),
    skillIds: formData.getAll("skillIds"),
    courseIds: formData.getAll("courseIds"),
  });
  const locale = requireRouteLocale(parsed.locale);
  const assignmentId = await readTranslationAssignmentSession();
  if (!assignmentId) throw new Error("Translation session unavailable");

  const [assignment] = await db
    .select({ translatorId: translationAssignments.translatorId })
    .from(translationAssignments)
    .where(
      and(
        eq(translationAssignments.id, assignmentId),
        isNull(translationAssignments.revokedAt),
        gt(translationAssignments.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const translatorId = assignment?.translatorId;
  if (!translatorId) {
    throw new Error("This link is not tied to a translator directory entry");
  }

  const codes = await validLanguageCodes(parsed.languages);
  const languages = codes.map((code) => {
    const into = formData.get(`into_${code}`) === "true";
    const from = formData.get(`from_${code}`) === "true";
    return {
      code,
      /**
       * Picking a language and ticking neither direction still means they work
       * in it, so it reads as the table's own default rather than being
       * dropped — the form's own default too.
       */
      canTranslateInto: into || !from,
      canTranslateFrom: from,
    };
  });

  await db.transaction(async (tx) => {
    await replaceTranslatorProfileFacets(tx, translatorId, {
      languages,
      skillIds: parsed.skillIds,
      courseIds: parsed.courseIds,
    });
  });
  // The directory entry decides who gets offered which assignments, so a change
  // to it is dated and attributed like any other edit. Counts, not lists: which
  // skills a translator claims is on the row itself, not in the trail.
  await recordAudit({
    action: "translator.profile_updated",
    subjectType: "translator",
    subjectId: translatorId,
    actorType: "translator",
    metadata: {
      languages: languages.map((language) => language.code).join(", "),
      skills: parsed.skillIds.length,
      courses: parsed.courseIds.length,
    },
  });
  revalidatePath(`/${locale}/translate/profile`);
}
