import type { Locale } from "@infokit/shared/i18n";
import { and, asc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import type { HeldEntry, PersonHoldings } from "~/lib/requirement-matching";
import { db } from "~/server/db";
import {
  memberLanguages,
  organizationMembers,
  requirementItems,
  requirementSets,
  skillRecords,
  skills,
  trainingCourses,
  trainingRecords,
  translatorLanguages,
  translators,
} from "~/server/db/schema";

export type SkillRow = typeof skills.$inferSelect;
export type CourseRow = typeof trainingCourses.$inferSelect;
export type SkillKind = SkillRow["kind"];

/** Who is declaring or being matched: a member of one organisation, or a translator. */
export type Holder =
  | { memberId: string; translatorId?: undefined }
  | { translatorId: string; memberId?: undefined };

const WIDER_TIERS = [
  "all_organizations",
  "all_organizations_and_translators",
] as const;

/**
 * The catalogue name in the reader's language, falling back to French — the
 * language the network works in, and the only one a row must carry. Same
 * behaviour as the `labelPicker` the catalogue page uses for tags.
 */
export function skillName(
  row: Pick<SkillRow, "nameFr" | "nameEn" | "nameAr">,
  locale: Locale,
): string {
  if (locale === "en") return row.nameEn ?? row.nameFr;
  if (locale === "ar") return row.nameAr ?? row.nameFr;
  return row.nameFr;
}

/** A course title reads the same way; only a platform course tends to carry all three. */
export function courseTitle(
  row: Pick<CourseRow, "title" | "titleEn" | "titleAr">,
  locale: Locale,
): string {
  if (locale === "en") return row.titleEn ?? row.title;
  if (locale === "ar") return row.titleAr ?? row.title;
  return row.title;
}

/**
 * What one organisation's workspace may read: the platform's global rows, its
 * own rows, and whatever another association shared with the network. This is
 * the reach rule of docs/DATABASE-SCHEMA.md §12 as one predicate — nothing is
 * copied between organisations, so a requirement and a declaration can point at
 * the same row from two different workspaces.
 */
function organizationReach(
  organizationColumn: AnyPgColumn,
  visibilityColumn: AnyPgColumn,
  organizationId: string | null,
): SQL | undefined {
  return or(
    isNull(organizationColumn),
    organizationId ? eq(organizationColumn, organizationId) : undefined,
    inArray(visibilityColumn, [...WIDER_TIERS]),
  );
}

/** A translator belongs to no organisation: global rows, plus what was opened to them. */
function translatorReach(
  organizationColumn: AnyPgColumn,
  visibilityColumn: AnyPgColumn,
): SQL | undefined {
  return or(
    isNull(organizationColumn),
    eq(visibilityColumn, "all_organizations_and_translators"),
  );
}

export async function listSkills({
  organizationId,
  kinds,
  includeInactive = false,
}: {
  organizationId: string | null;
  kinds?: readonly SkillKind[];
  includeInactive?: boolean;
}): Promise<SkillRow[]> {
  return db
    .select()
    .from(skills)
    .where(
      and(
        organizationReach(
          skills.organizationId,
          skills.visibility,
          organizationId,
        ),
        kinds?.length ? inArray(skills.kind, [...kinds]) : undefined,
        includeInactive ? undefined : eq(skills.active, true),
      ),
    )
    .orderBy(asc(skills.kind), asc(skills.nameFr));
}

/**
 * The same reach question asked for several organisations at once, so a page
 * listing the teams of more than one association picks its options per team
 * instead of running one query per organisation.
 */
export async function listSkillsForOrganizations(
  organizationIds: readonly string[],
): Promise<Map<string, SkillRow[]>> {
  const byOrganization = new Map<string, SkillRow[]>();
  if (organizationIds.length === 0) return byOrganization;
  const rows = await db
    .select()
    .from(skills)
    .where(
      and(
        or(
          isNull(skills.organizationId),
          inArray(skills.organizationId, [...organizationIds]),
          inArray(skills.visibility, [...WIDER_TIERS]),
        ),
        eq(skills.active, true),
      ),
    )
    .orderBy(asc(skills.kind), asc(skills.nameFr));
  for (const organizationId of organizationIds) {
    byOrganization.set(
      organizationId,
      rows.filter(
        (row) =>
          row.organizationId === null ||
          row.organizationId === organizationId ||
          WIDER_TIERS.includes(row.visibility as (typeof WIDER_TIERS)[number]),
      ),
    );
  }
  return byOrganization;
}

export async function listSkillsForTranslator(): Promise<SkillRow[]> {
  return db
    .select()
    .from(skills)
    .where(
      and(
        translatorReach(skills.organizationId, skills.visibility),
        eq(skills.active, true),
      ),
    )
    .orderBy(asc(skills.kind), asc(skills.nameFr));
}

export async function listCourses({
  organizationId,
  includeInactive = false,
}: {
  organizationId: string | null;
  includeInactive?: boolean;
}): Promise<CourseRow[]> {
  return db
    .select()
    .from(trainingCourses)
    .where(
      and(
        organizationReach(
          trainingCourses.organizationId,
          trainingCourses.visibility,
          organizationId,
        ),
        includeInactive ? undefined : eq(trainingCourses.active, true),
      ),
    )
    .orderBy(asc(trainingCourses.title));
}

export async function listCoursesForTranslator(): Promise<CourseRow[]> {
  return db
    .select()
    .from(trainingCourses)
    .where(
      and(
        translatorReach(
          trainingCourses.organizationId,
          trainingCourses.visibility,
        ),
        eq(trainingCourses.active, true),
      ),
    )
    .orderBy(asc(trainingCourses.title));
}

/**
 * Everything one set of people hold, in the shape the matcher reads: skills,
 * courses and spoken languages together, keyed by the id the caller asked with.
 * A member and a translator can be the same human — pass both ids and merge on
 * the caller's side, or use `holdingsForUsers`, which does it by account.
 */
export async function holdingsForHolders({
  memberIds = [],
  translatorIds = [],
}: {
  memberIds?: readonly string[];
  translatorIds?: readonly string[];
}): Promise<Map<string, HeldEntry[]>> {
  const held = new Map<string, HeldEntry[]>();
  const push = (id: string, entry: HeldEntry) => {
    held.set(id, [...(held.get(id) ?? []), entry]);
  };
  if (memberIds.length === 0 && translatorIds.length === 0) return held;

  const [
    memberSkillRows,
    memberCourseRows,
    memberLanguageRows,
    translatorSkillRows,
    translatorCourseRows,
    translatorLanguageRows,
  ] = await Promise.all([
    memberIds.length
      ? db
          .select({
            holderId: skillRecords.memberId,
            id: skillRecords.skillId,
            state: skillRecords.state,
            expiresOn: skillRecords.expiresOn,
          })
          .from(skillRecords)
          .where(inArray(skillRecords.memberId, [...memberIds]))
      : Promise.resolve([]),
    memberIds.length
      ? db
          .select({
            holderId: trainingRecords.memberId,
            id: trainingRecords.courseId,
            state: trainingRecords.state,
            expiresOn: trainingRecords.expiresOn,
          })
          .from(trainingRecords)
          .where(inArray(trainingRecords.memberId, [...memberIds]))
      : Promise.resolve([]),
    memberIds.length
      ? db
          .select({
            holderId: memberLanguages.memberId,
            code: memberLanguages.languageCode,
          })
          .from(memberLanguages)
          .where(inArray(memberLanguages.memberId, [...memberIds]))
      : Promise.resolve([]),
    translatorIds.length
      ? db
          .select({
            holderId: skillRecords.translatorId,
            id: skillRecords.skillId,
            state: skillRecords.state,
            expiresOn: skillRecords.expiresOn,
          })
          .from(skillRecords)
          .where(inArray(skillRecords.translatorId, [...translatorIds]))
      : Promise.resolve([]),
    translatorIds.length
      ? db
          .select({
            holderId: trainingRecords.translatorId,
            id: trainingRecords.courseId,
            state: trainingRecords.state,
            expiresOn: trainingRecords.expiresOn,
          })
          .from(trainingRecords)
          .where(inArray(trainingRecords.translatorId, [...translatorIds]))
      : Promise.resolve([]),
    translatorIds.length
      ? db
          .select({
            holderId: translatorLanguages.translatorId,
            code: translatorLanguages.languageCode,
          })
          .from(translatorLanguages)
          .where(inArray(translatorLanguages.translatorId, [...translatorIds]))
      : Promise.resolve([]),
  ]);

  for (const row of [...memberSkillRows, ...translatorSkillRows]) {
    if (!row.holderId) continue;
    push(row.holderId, {
      kind: "skill",
      id: row.id,
      state: row.state,
      expiresOn: row.expiresOn,
    });
  }
  for (const row of [...memberCourseRows, ...translatorCourseRows]) {
    if (!row.holderId) continue;
    push(row.holderId, {
      kind: "course",
      id: row.id,
      state: row.state,
      expiresOn: row.expiresOn,
    });
  }
  for (const row of [...memberLanguageRows, ...translatorLanguageRows]) {
    if (!row.holderId) continue;
    push(row.holderId, { kind: "language", code: row.code });
  }
  return held;
}

/**
 * The same question asked about people, not about records: one human may be a
 * member of two associations and a translator besides, and the OCP course they
 * did once counts everywhere. Every identity behind an account is gathered, so
 * an organisation reading a collaborator sees what that person holds, not what
 * their own membership row happens to carry.
 */
export async function holdingsForUsers(
  userIds: readonly string[],
): Promise<PersonHoldings[]> {
  if (userIds.length === 0) return [];
  const [memberRows, translatorRows] = await Promise.all([
    db
      .select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
      })
      .from(organizationMembers)
      .where(inArray(organizationMembers.userId, [...userIds])),
    db
      .select({ id: translators.id, userId: translators.userId })
      .from(translators)
      .where(inArray(translators.userId, [...userIds])),
  ]);
  const held = await holdingsForHolders({
    memberIds: memberRows.map((row) => row.id),
    translatorIds: translatorRows.map((row) => row.id),
  });
  return userIds.map((userId) => {
    const holderIds = [
      ...memberRows.filter((row) => row.userId === userId).map((row) => row.id),
      ...translatorRows
        .filter((row) => row.userId === userId)
        .map((row) => row.id),
    ];
    return {
      personId: userId,
      held: holderIds.flatMap((holderId) => held.get(holderId) ?? []),
    };
  });
}

/** A set with its conditions, ready for `evaluateRequirements`. */
export async function requirementSetItems(setId: string) {
  return db
    .select()
    .from(requirementItems)
    .where(eq(requirementItems.setId, setId))
    .orderBy(asc(requirementItems.necessity), asc(requirementItems.createdAt));
}

export async function listRequirementSets(organizationId: string) {
  return db
    .select()
    .from(requirementSets)
    .where(eq(requirementSets.organizationId, organizationId))
    .orderBy(asc(requirementSets.name));
}

/**
 * Replace what one person declared, without touching what has already been
 * decided about them: a skill they still hold keeps its state, its dates and
 * its verifier, one they dropped is deleted, one they added starts at the
 * skill's own starting state. Re-saving a profile must not quietly turn a
 * verified declaration back into somebody's own word.
 *
 * Ids the holder may not point at are dropped rather than refused: the picker
 * only ever offers reachable rows, so a stray id means a retired row or a
 * forged form, and neither should cost the rest of the save.
 */
export async function replaceSkillRecords(
  tx: Pick<typeof db, "select" | "delete" | "insert">,
  holder: Holder,
  skillIds: readonly string[],
): Promise<void> {
  const holderColumn = holder.memberId
    ? skillRecords.memberId
    : skillRecords.translatorId;
  const holderId = holder.memberId ?? holder.translatorId;
  if (!holderId)
    throw new Error("A skill record needs a member or a translator");

  const wanted = [...new Set(skillIds)];
  const selectable = wanted.length
    ? await tx
        .select({
          id: skills.id,
          verificationRequired: skills.verificationRequired,
        })
        .from(skills)
        .where(
          and(
            inArray(skills.id, wanted),
            eq(skills.active, true),
            holder.memberId
              ? organizationReach(
                  skills.organizationId,
                  skills.visibility,
                  await memberOrganizationId(tx, holder.memberId),
                )
              : translatorReach(skills.organizationId, skills.visibility),
          ),
        )
    : [];

  const existing = await tx
    .select({ skillId: skillRecords.skillId })
    .from(skillRecords)
    .where(eq(holderColumn, holderId));
  const existingIds = new Set(existing.map((row) => row.skillId));
  const keep = new Set(selectable.map((row) => row.id));

  const dropped = [...existingIds].filter((id) => !keep.has(id));
  if (dropped.length > 0) {
    await tx
      .delete(skillRecords)
      .where(
        and(eq(holderColumn, holderId), inArray(skillRecords.skillId, dropped)),
      );
  }
  const added = selectable.filter((row) => !existingIds.has(row.id));
  if (added.length > 0) {
    await tx.insert(skillRecords).values(
      added.map((row) => ({
        skillId: row.id,
        memberId: holder.memberId ?? null,
        translatorId: holder.translatorId ?? null,
        state: row.verificationRequired
          ? ("awaiting_verification" as const)
          : ("self_declared" as const),
      })),
    );
  }
}

/**
 * The same replacement for courses — the twin of `replaceSkillRecords`, because
 * `training_records` is the twin of `skill_records`. A completion keeps its
 * dates and its verifier when the person re-saves their profile; only the
 * courses they took off the list are deleted.
 */
export async function replaceTrainingRecords(
  tx: Pick<typeof db, "select" | "delete" | "insert">,
  holder: Holder,
  courseIds: readonly string[],
): Promise<void> {
  const holderColumn = holder.memberId
    ? trainingRecords.memberId
    : trainingRecords.translatorId;
  const holderId = holder.memberId ?? holder.translatorId;
  if (!holderId)
    throw new Error("A training record needs a member or a translator");

  const wanted = [...new Set(courseIds)];
  const selectable = wanted.length
    ? await tx
        .select({
          id: trainingCourses.id,
          verificationRequired: trainingCourses.verificationRequired,
        })
        .from(trainingCourses)
        .where(
          and(
            inArray(trainingCourses.id, wanted),
            eq(trainingCourses.active, true),
            holder.memberId
              ? organizationReach(
                  trainingCourses.organizationId,
                  trainingCourses.visibility,
                  await memberOrganizationId(tx, holder.memberId),
                )
              : translatorReach(
                  trainingCourses.organizationId,
                  trainingCourses.visibility,
                ),
          ),
        )
    : [];

  const existing = await tx
    .select({ courseId: trainingRecords.courseId })
    .from(trainingRecords)
    .where(eq(holderColumn, holderId));
  const existingIds = new Set(existing.map((row) => row.courseId));
  const keep = new Set(selectable.map((row) => row.id));

  const dropped = [...existingIds].filter((id) => !keep.has(id));
  if (dropped.length > 0) {
    await tx
      .delete(trainingRecords)
      .where(
        and(
          eq(holderColumn, holderId),
          inArray(trainingRecords.courseId, dropped),
        ),
      );
  }
  const added = selectable.filter((row) => !existingIds.has(row.id));
  if (added.length > 0) {
    await tx.insert(trainingRecords).values(
      added.map((row) => ({
        courseId: row.id,
        memberId: holder.memberId ?? null,
        translatorId: holder.translatorId ?? null,
        state: row.verificationRequired
          ? ("awaiting_verification" as const)
          : ("self_declared" as const),
      })),
    );
  }
}

async function memberOrganizationId(
  tx: Pick<typeof db, "select">,
  memberId: string,
): Promise<string | null> {
  const [member] = await tx
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.id, memberId));
  return member?.organizationId ?? null;
}
