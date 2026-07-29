import { and, asc, eq, notInArray, sql } from "drizzle-orm";

import { db } from "~/server/db";
import {
  skillRecords,
  skills,
  trainingCourses,
  trainingRecords,
  translatorLanguages,
} from "~/server/db/schema";
import { replaceSkillRecords, replaceTrainingRecords } from "~/server/skills";

/** One language a translator works in, and in which direction. */
export type TranslatorLanguageEntry = {
  code: string;
  canTranslateInto: boolean;
  canTranslateFrom: boolean;
};

/**
 * What one translator declared about themselves — the counterpart of
 * `replaceMemberCapabilities` for somebody who is nobody's member.
 *
 * Only this translator's own rows are read or written: an external person
 * filling in their profile from an assignment link must not be able to reach
 * anything else, so the id comes from the session rather than from the form.
 */
export async function translatorProfileFacets(translatorId: string) {
  const [languageRows, skillRows, courseRows] = await Promise.all([
    db
      .select({
        code: translatorLanguages.languageCode,
        canTranslateInto: translatorLanguages.canTranslateInto,
        canTranslateFrom: translatorLanguages.canTranslateFrom,
      })
      .from(translatorLanguages)
      .where(eq(translatorLanguages.translatorId, translatorId))
      .orderBy(asc(translatorLanguages.languageCode)),
    db
      .select({
        id: skills.id,
        nameFr: skills.nameFr,
        nameEn: skills.nameEn,
        nameAr: skills.nameAr,
        state: skillRecords.state,
      })
      .from(skillRecords)
      .innerJoin(skills, eq(skills.id, skillRecords.skillId))
      .where(eq(skillRecords.translatorId, translatorId))
      .orderBy(asc(skills.nameFr)),
    db
      .select({
        id: trainingCourses.id,
        title: trainingCourses.title,
        titleEn: trainingCourses.titleEn,
        titleAr: trainingCourses.titleAr,
        state: trainingRecords.state,
      })
      .from(trainingRecords)
      .innerJoin(
        trainingCourses,
        eq(trainingCourses.id, trainingRecords.courseId),
      )
      .where(eq(trainingRecords.translatorId, translatorId))
      .orderBy(asc(trainingCourses.title)),
  ]);
  return { languageRows, skillRows, courseRows };
}

/**
 * Replace those declarations, keeping what somebody else already recorded: a
 * confirmed skill keeps its verifier (`replaceSkillRecords` diffs rather than
 * rewrites), and a language that stays claimed keeps the `note` an editor wrote
 * on it — only the directions come from this form.
 *
 * A language claimed in neither direction is dropped rather than refused: the
 * table's own check refuses such a row, and an unticked pair means the person
 * stopped working in that language.
 */
export async function replaceTranslatorProfileFacets(
  tx: Pick<typeof db, "select" | "delete" | "insert" | "update">,
  translatorId: string,
  {
    languages,
    skillIds,
    courseIds,
  }: {
    languages: readonly TranslatorLanguageEntry[];
    skillIds: readonly string[];
    courseIds: readonly string[];
  },
) {
  await replaceSkillRecords(tx, { translatorId }, skillIds);
  await replaceTrainingRecords(tx, { translatorId }, courseIds);

  const claimed = languages.filter(
    (entry) => entry.canTranslateInto || entry.canTranslateFrom,
  );
  await tx.delete(translatorLanguages).where(
    and(
      eq(translatorLanguages.translatorId, translatorId),
      claimed.length > 0
        ? notInArray(
            translatorLanguages.languageCode,
            claimed.map((entry) => entry.code),
          )
        : undefined,
    ),
  );
  if (claimed.length > 0) {
    await tx
      .insert(translatorLanguages)
      .values(
        claimed.map((entry) => ({
          translatorId,
          languageCode: entry.code,
          canTranslateInto: entry.canTranslateInto,
          canTranslateFrom: entry.canTranslateFrom,
        })),
      )
      .onConflictDoUpdate({
        target: [
          translatorLanguages.translatorId,
          translatorLanguages.languageCode,
        ],
        set: {
          canTranslateInto: sql`excluded.can_translate_into`,
          canTranslateFrom: sql`excluded.can_translate_from`,
          updatedAt: new Date(),
        },
      });
  }
}
