"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { type AnyPgColumn, type PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import { type Locale } from "@infokit/shared/i18n";

import { getActionLocale } from "~/i18n/request-locale";
import { localizedPath } from "~/i18n/routing";
import {
  optionalNumber,
  optionalText,
  optionalTextUpTo,
} from "~/lib/form-fields";
import { recordAudit } from "~/server/audit";
import { authorizationFor } from "~/server/auth/authorization";
import { requireEditor, type ActionUser } from "~/server/auth/require";
import { isCatalogueNameConflict } from "~/server/content/catalogue-scope";
import { db } from "~/server/db";
import {
  languages,
  organizationMembers,
  requirementItems,
  requirementSets,
  skillRecords,
  skills,
  trainingCourses,
  trainingRecords,
  translators,
} from "~/server/db/schema";
import { listCourses, listSkills } from "~/server/skills";

/**
 * Skills, courses, requirement sets and verification decisions — the mutations
 * behind /dashboard/skills.
 *
 * Four permissions, because four different people do these four things: the
 * platform's own vocabulary needs `taxonomy.manage`, an association's own rows
 * `courses.manage`, the requirement sets a mission will be matched against
 * `planning.manage`, and a decision on somebody's declaration
 * `courses.qualification.verify`. The scope/permission plumbing is
 * catalogue/actions.ts's, deliberately: these are the same kind of row, written
 * by the same two kinds of author.
 */

const scopeSchema = z.enum(["global", "org"]);
const visibilitySchema = z.enum([
  "organization",
  "all_organizations",
  "all_organizations_and_translators",
]);
const kindSchema = z.enum([
  "skill",
  "software",
  "driving_permit",
  "certification",
]);
const necessitySchema = z.enum(["required", "preferred"]);
const uuidSchema = z.string().uuid();

/** Read a form field, falling back when it is absent or blank. */
function field(formData: FormData, name: string, fallback: string): string {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

/** A checkbox posts its value only when it is on; absent means off. */
function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "true";
}

const nameSchema = z.string().trim().min(2).max(160);
const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "lowercase letters, digits, _ or -");
/** The database bound on a validity period, so 600 months is a parse error. */
const validityMonthsSchema = optionalNumber.pipe(
  z.number().int().min(1).max(600).nullable(),
);
const referenceUrlSchema = optionalText.pipe(z.string().url().nullable());

function refresh(locale: Locale) {
  revalidatePath(localizedPath("/dashboard/skills", locale));
  // The member profile picks its declarations from this catalogue.
  revalidatePath(localizedPath("/dashboard/team", locale));
}

function notice(locale: Locale, code: string): never {
  redirect(`${localizedPath("/dashboard/skills", locale)}?notice=${code}`);
}

/**
 * A name, a code or a slug already taken in this scope is the editor's to
 * correct, so it comes back as a notice rather than as a stack trace. Anything
 * else rethrows.
 */
async function writeSkillName<T>(
  locale: Locale,
  write: () => Promise<T>,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isCatalogueNameConflict(error)) notice(locale, "duplicate-name");
    throw error;
  }
}

/**
 * The gate on every skills catalogue write, and it refuses by default.
 *
 * The scope decides which permission is asked for and, when the write belongs to
 * one association, the grants are read **for that association** — so the id in
 * the form both selects the check and receives the row. An actor naming an
 * association they hold nothing in fails here rather than writing into it.
 * Returns the resolved organisation id for org-scoped writes (null otherwise).
 */
async function guardScope(formData: FormData): Promise<{
  locale: Locale;
  organizationId: string | null;
  user: ActionUser;
}> {
  const locale = await getActionLocale(formData.get("locale"));
  const scope = scopeSchema.parse(formData.get("scope") ?? "global");
  const permission = scope === "global" ? "taxonomy.manage" : "courses.manage";
  const organizationId =
    scope === "org" ? uuidSchema.parse(formData.get("organizationId")) : null;
  const user = await requireEditor(locale);
  const authorization = await authorizationFor(
    user.id,
    organizationId ?? undefined,
  );
  if (!authorization.effectivePermissions.has(permission)) {
    notice(locale, "permission-denied");
  }
  return { locale, organizationId, user };
}

/**
 * The same guard for the writes that only exist inside one association —
 * requirement sets and verification decisions. `planning.manage` and
 * `courses.qualification.verify` are granted by organisation roles, so the
 * grants have to be read **for that organisation**: asking without it would
 * check permissions the actor only holds elsewhere.
 */
async function guardOrganization(
  formData: FormData,
  permission: string,
): Promise<{ locale: Locale; organizationId: string; user: ActionUser }> {
  const locale = await getActionLocale(formData.get("locale"));
  const organizationId = uuidSchema.parse(formData.get("organizationId"));
  const user = await requireEditor(locale);
  const authorization = await authorizationFor(user.id, organizationId);
  if (!authorization.effectivePermissions.has(permission)) {
    notice(locale, "permission-denied");
  }
  return { locale, organizationId, user };
}

/** How many rows in `table` reference `id` through `column`. */
async function countReferences(
  table: PgTable,
  column: AnyPgColumn,
  id: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(table)
    .where(eq(column, id));
  return row?.n ?? 0;
}

/** Deletion is only offered for unused rows; bounce back with a notice if not. */
function blockIfUsed(locale: Locale, used: number) {
  if (used > 0) notice(locale, "in-use");
}

/**
 * When a declaration is confirmed and its catalogue row has a validity period,
 * this is the day it runs out. The day of the month is kept and clamped to the
 * length of the target month, so 31 January plus one month is 28 February
 * rather than drifting into March.
 */
function expiryFrom(
  start: string | null,
  validityMonths: number | null,
): string | null {
  if (validityMonths === null) return null;
  const from = start ? new Date(`${start}T00:00:00Z`) : new Date();
  if (Number.isNaN(from.getTime())) return null;
  const day = from.getUTCDate();
  const target = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + validityMonths, 1),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/* --------------------------------- skills --------------------------------- */

/**
 * A row with no organisation has nowhere to be kept, so it is network wide by
 * definition — the database says the same thing in
 * `skills_global_reach_check`. Only an association's own row has a reach to
 * choose.
 */
function reachFor(
  organizationId: string | null,
  posted: FormDataEntryValue | null,
) {
  if (organizationId === null)
    return "all_organizations_and_translators" as const;
  return visibilitySchema.parse(posted ?? "organization");
}

export async function createSkill(formData: FormData) {
  const { locale, organizationId, user } = await guardScope(formData);
  const parsed = z
    .object({
      kind: kindSchema,
      code: codeSchema,
      nameFr: nameSchema,
      nameEn: optionalTextUpTo(160),
      nameAr: optionalTextUpTo(160),
      descriptionFr: optionalText,
      validityMonths: validityMonthsSchema,
      referenceUrl: referenceUrlSchema,
    })
    .parse({
      kind: field(formData, "kind", "skill"),
      code: formData.get("code"),
      nameFr: formData.get("nameFr"),
      nameEn: formData.get("nameEn") ?? "",
      nameAr: formData.get("nameAr") ?? "",
      descriptionFr: formData.get("descriptionFr") ?? "",
      validityMonths: formData.get("validityMonths") ?? "",
      referenceUrl: formData.get("referenceUrl") ?? "",
    });

  const skill = await writeSkillName(locale, async () => {
    const [created] = await db
      .insert(skills)
      .values({
        organizationId,
        kind: parsed.kind,
        code: parsed.code,
        nameFr: parsed.nameFr,
        nameEn: parsed.nameEn,
        nameAr: parsed.nameAr,
        descriptionFr: parsed.descriptionFr,
        visibility: reachFor(organizationId, formData.get("visibility")),
        verificationRequired: checkbox(formData, "verificationRequired"),
        validityMonths: parsed.validityMonths,
        referenceUrl: parsed.referenceUrl,
        createdById: user.id,
      })
      .returning({ id: skills.id });
    if (!created) throw new Error("Skill insert returned no row");
    return created;
  });

  await recordAudit({
    action: "skill.created",
    subjectType: "skill",
    subjectId: skill.id,
    organizationId,
  });
  refresh(locale);
}

export async function updateSkill(formData: FormData) {
  const { locale, organizationId } = await guardScope(formData);
  const skillId = uuidSchema.parse(formData.get("skillId"));
  const parsed = z
    .object({
      kind: kindSchema,
      nameFr: nameSchema,
      nameEn: optionalTextUpTo(160),
      nameAr: optionalTextUpTo(160),
      descriptionFr: optionalText,
      validityMonths: validityMonthsSchema,
      referenceUrl: referenceUrlSchema,
    })
    .parse({
      kind: field(formData, "kind", "skill"),
      nameFr: formData.get("nameFr"),
      nameEn: formData.get("nameEn") ?? "",
      nameAr: formData.get("nameAr") ?? "",
      descriptionFr: formData.get("descriptionFr") ?? "",
      validityMonths: formData.get("validityMonths") ?? "",
      referenceUrl: formData.get("referenceUrl") ?? "",
    });

  // Scope comes from the row, not from the form: moving a row between scopes is
  // `promoteSkillToGlobal`, which is a different permission.
  const [owned] = await db
    .select({ organizationId: skills.organizationId })
    .from(skills)
    .where(eq(skills.id, skillId))
    .limit(1);
  if (owned?.organizationId !== organizationId) {
    throw new Error("The skill scope cannot be changed");
  }

  await writeSkillName(locale, () =>
    db
      .update(skills)
      .set({
        kind: parsed.kind,
        nameFr: parsed.nameFr,
        nameEn: parsed.nameEn,
        nameAr: parsed.nameAr,
        descriptionFr: parsed.descriptionFr,
        visibility: reachFor(organizationId, formData.get("visibility")),
        verificationRequired: checkbox(formData, "verificationRequired"),
        validityMonths: parsed.validityMonths,
        referenceUrl: parsed.referenceUrl,
      })
      .where(eq(skills.id, skillId)),
  );

  await recordAudit({
    action: "skill.updated",
    subjectType: "skill",
    subjectId: skillId,
    organizationId,
  });
  refresh(locale);
}

export async function setSkillActive(formData: FormData) {
  const { locale, organizationId } = await guardScope(formData);
  const skillId = uuidSchema.parse(formData.get("skillId"));
  const active = checkbox(formData, "active");
  await db.update(skills).set({ active }).where(eq(skills.id, skillId));
  await recordAudit({
    action: active ? "skill.activated" : "skill.deactivated",
    subjectType: "skill",
    subjectId: skillId,
    organizationId,
  });
  refresh(locale);
}

export async function deleteSkill(formData: FormData) {
  const { locale, organizationId } = await guardScope(formData);
  const skillId = uuidSchema.parse(formData.get("skillId"));
  // People's declarations and the requirements pointing here would go with it.
  const used =
    (await countReferences(skillRecords, skillRecords.skillId, skillId)) +
    (await countReferences(
      requirementItems,
      requirementItems.skillId,
      skillId,
    ));
  blockIfUsed(locale, used);
  await db.delete(skills).where(eq(skills.id, skillId));
  await recordAudit({
    action: "skill.deleted",
    subjectType: "skill",
    subjectId: skillId,
    organizationId,
  });
  refresh(locale);
}

/**
 * Hand an association's row to the platform: a skill everybody ended up needing
 * should be one row, not one per association. Clearing the owner also forces the
 * network-wide reach, because a row with no owner has no narrower one to have —
 * and every declaration already made against it keeps pointing at the same id.
 */
export async function promoteSkillToGlobal(formData: FormData) {
  formData.set("scope", "global");
  const { locale } = await guardScope(formData);
  const skillId = uuidSchema.parse(formData.get("skillId"));
  await writeSkillName(locale, () =>
    db
      .update(skills)
      .set({
        organizationId: null,
        visibility: "all_organizations_and_translators",
      })
      .where(eq(skills.id, skillId)),
  );
  await recordAudit({
    action: "skill.promoted",
    subjectType: "skill",
    subjectId: skillId,
  });
  refresh(locale);
}

/* --------------------------------- courses -------------------------------- */

export async function createCourse(formData: FormData) {
  const { locale, organizationId, user } = await guardScope(formData);
  const parsed = z
    .object({
      slug: codeSchema,
      title: z.string().trim().min(2).max(200),
      titleEn: optionalTextUpTo(200),
      titleAr: optionalTextUpTo(200),
      description: optionalText,
      provider: optionalTextUpTo(200),
      url: referenceUrlSchema,
      validityMonths: validityMonthsSchema,
    })
    .parse({
      slug: formData.get("slug"),
      title: formData.get("title"),
      titleEn: formData.get("titleEn") ?? "",
      titleAr: formData.get("titleAr") ?? "",
      description: formData.get("description") ?? "",
      provider: formData.get("provider") ?? "",
      url: formData.get("url") ?? "",
      validityMonths: formData.get("validityMonths") ?? "",
    });

  const course = await writeSkillName(locale, async () => {
    const [created] = await db
      .insert(trainingCourses)
      .values({
        organizationId,
        slug: parsed.slug,
        title: parsed.title,
        titleEn: parsed.titleEn,
        titleAr: parsed.titleAr,
        description: parsed.description,
        provider: parsed.provider,
        url: parsed.url,
        visibility: reachFor(organizationId, formData.get("visibility")),
        verificationRequired: checkbox(formData, "verificationRequired"),
        validityMonths: parsed.validityMonths,
        createdById: user.id,
      })
      .returning({ id: trainingCourses.id });
    if (!created) throw new Error("Course insert returned no row");
    return created;
  });

  await recordAudit({
    action: "training_course.created",
    subjectType: "training_course",
    subjectId: course.id,
    organizationId,
  });
  refresh(locale);
}

export async function updateCourse(formData: FormData) {
  const { locale, organizationId } = await guardScope(formData);
  const courseId = uuidSchema.parse(formData.get("courseId"));
  const parsed = z
    .object({
      title: z.string().trim().min(2).max(200),
      titleEn: optionalTextUpTo(200),
      titleAr: optionalTextUpTo(200),
      description: optionalText,
      provider: optionalTextUpTo(200),
      url: referenceUrlSchema,
      validityMonths: validityMonthsSchema,
    })
    .parse({
      title: formData.get("title"),
      titleEn: formData.get("titleEn") ?? "",
      titleAr: formData.get("titleAr") ?? "",
      description: formData.get("description") ?? "",
      provider: formData.get("provider") ?? "",
      url: formData.get("url") ?? "",
      validityMonths: formData.get("validityMonths") ?? "",
    });

  const [owned] = await db
    .select({ organizationId: trainingCourses.organizationId })
    .from(trainingCourses)
    .where(eq(trainingCourses.id, courseId))
    .limit(1);
  if (owned?.organizationId !== organizationId) {
    throw new Error("The course scope cannot be changed");
  }

  await writeSkillName(locale, () =>
    db
      .update(trainingCourses)
      .set({
        title: parsed.title,
        titleEn: parsed.titleEn,
        titleAr: parsed.titleAr,
        description: parsed.description,
        provider: parsed.provider,
        url: parsed.url,
        visibility: reachFor(organizationId, formData.get("visibility")),
        verificationRequired: checkbox(formData, "verificationRequired"),
        validityMonths: parsed.validityMonths,
      })
      .where(eq(trainingCourses.id, courseId)),
  );

  await recordAudit({
    action: "training_course.updated",
    subjectType: "training_course",
    subjectId: courseId,
    organizationId,
  });
  refresh(locale);
}

export async function setCourseActive(formData: FormData) {
  const { locale, organizationId } = await guardScope(formData);
  const courseId = uuidSchema.parse(formData.get("courseId"));
  const active = checkbox(formData, "active");
  await db
    .update(trainingCourses)
    .set({ active })
    .where(eq(trainingCourses.id, courseId));
  await recordAudit({
    action: active
      ? "training_course.activated"
      : "training_course.deactivated",
    subjectType: "training_course",
    subjectId: courseId,
    organizationId,
  });
  refresh(locale);
}

export async function deleteCourse(formData: FormData) {
  const { locale, organizationId } = await guardScope(formData);
  const courseId = uuidSchema.parse(formData.get("courseId"));
  const used =
    (await countReferences(
      trainingRecords,
      trainingRecords.courseId,
      courseId,
    )) +
    (await countReferences(
      requirementItems,
      requirementItems.courseId,
      courseId,
    ));
  blockIfUsed(locale, used);
  await db.delete(trainingCourses).where(eq(trainingCourses.id, courseId));
  await recordAudit({
    action: "training_course.deleted",
    subjectType: "training_course",
    subjectId: courseId,
    organizationId,
  });
  refresh(locale);
}

/* ------------------------------- requirements ------------------------------ */

/** A set is its organisation's rule; nobody else may add to it or delete it. */
async function ownedSet(
  locale: Locale,
  setId: string,
  organizationId: string,
): Promise<void> {
  const [owned] = await db
    .select({ organizationId: requirementSets.organizationId })
    .from(requirementSets)
    .where(eq(requirementSets.id, setId))
    .limit(1);
  if (owned?.organizationId !== organizationId) {
    notice(locale, "permission-denied");
  }
}

export async function createRequirementSet(formData: FormData) {
  const { locale, organizationId, user } = await guardOrganization(
    formData,
    "planning.manage",
  );
  const parsed = z
    .object({
      code: codeSchema,
      name: z.string().trim().min(2).max(200),
      description: optionalText,
    })
    .parse({
      code: formData.get("code"),
      name: formData.get("name"),
      description: formData.get("description") ?? "",
    });

  const set = await writeSkillName(locale, async () => {
    const [created] = await db
      .insert(requirementSets)
      .values({
        organizationId,
        code: parsed.code,
        name: parsed.name,
        description: parsed.description,
        createdById: user.id,
      })
      .returning({ id: requirementSets.id });
    if (!created) throw new Error("Requirement set insert returned no row");
    return created;
  });

  await recordAudit({
    action: "requirement_set.created",
    subjectType: "requirement_set",
    subjectId: set.id,
    organizationId,
  });
  refresh(locale);
}

export async function deleteRequirementSet(formData: FormData) {
  const { locale, organizationId } = await guardOrganization(
    formData,
    "planning.manage",
  );
  const setId = uuidSchema.parse(formData.get("setId"));
  await ownedSet(locale, setId, organizationId);
  await db.delete(requirementSets).where(eq(requirementSets.id, setId));
  await recordAudit({
    action: "requirement_set.deleted",
    subjectType: "requirement_set",
    subjectId: setId,
    organizationId,
  });
  refresh(locale);
}

/**
 * One condition is one of three things, so the picker posts what it is together
 * with which one: `skill:<uuid>`, `course:<uuid>`, `language:<code>`.
 */
const targetSchema = z
  .string()
  .trim()
  .regex(/^(?:skill|course|language):.+$/)
  .transform((value) => {
    const separator = value.indexOf(":");
    return {
      group: value.slice(0, separator) as "skill" | "course" | "language",
      key: value.slice(separator + 1),
    };
  });

export async function addRequirementItem(formData: FormData) {
  const { locale, organizationId } = await guardOrganization(
    formData,
    "planning.manage",
  );
  const setId = uuidSchema.parse(formData.get("setId"));
  await ownedSet(locale, setId, organizationId);
  const parsed = z
    .object({
      target: targetSchema,
      necessity: necessitySchema,
      minimumCount: optionalNumber.pipe(
        z.number().int().min(1).max(100).nullable(),
      ),
      note: optionalText,
    })
    .parse({
      target: formData.get("target"),
      necessity: field(formData, "necessity", "required"),
      minimumCount: formData.get("minimumCount") ?? "",
      note: formData.get("note") ?? "",
    });

  /**
   * A requirement may only point at a row this organisation can actually read,
   * and reach is re-derived here rather than trusted from the form: the picker
   * offered these options, but a stale page or a forged post would offer more.
   */
  const target = parsed.target;
  if (target.group === "skill") {
    const reachable = await listSkills({ organizationId });
    if (!reachable.some((row) => row.id === target.key)) {
      notice(locale, "permission-denied");
    }
  } else if (target.group === "course") {
    const reachable = await listCourses({ organizationId });
    if (!reachable.some((row) => row.id === target.key)) {
      notice(locale, "permission-denied");
    }
  } else {
    const [language] = await db
      .select({ code: languages.code })
      .from(languages)
      .where(eq(languages.code, target.key))
      .limit(1);
    if (!language) notice(locale, "permission-denied");
  }

  const item = await writeSkillName(locale, async () => {
    const [created] = await db
      .insert(requirementItems)
      .values({
        setId,
        skillId: target.group === "skill" ? target.key : null,
        courseId: target.group === "course" ? target.key : null,
        languageCode: target.group === "language" ? target.key : null,
        necessity: parsed.necessity,
        mustBeVerified: checkbox(formData, "mustBeVerified"),
        mustBeCurrent: checkbox(formData, "mustBeCurrent"),
        minimumCount: parsed.minimumCount,
        note: parsed.note,
      })
      .returning({ id: requirementItems.id });
    if (!created) throw new Error("Requirement item insert returned no row");
    return created;
  });

  await recordAudit({
    action: "requirement_item.added",
    subjectType: "requirement_item",
    subjectId: item.id,
    organizationId,
    metadata: { set: setId, target: `${target.group}:${target.key}` },
  });
  refresh(locale);
}

export async function removeRequirementItem(formData: FormData) {
  const { locale, organizationId } = await guardOrganization(
    formData,
    "planning.manage",
  );
  const itemId = uuidSchema.parse(formData.get("itemId"));
  const [item] = await db
    .select({ setId: requirementItems.setId })
    .from(requirementItems)
    .where(eq(requirementItems.id, itemId))
    .limit(1);
  if (!item) notice(locale, "in-use");
  await ownedSet(locale, item.setId, organizationId);
  await db.delete(requirementItems).where(eq(requirementItems.id, itemId));
  await recordAudit({
    action: "requirement_item.removed",
    subjectType: "requirement_item",
    subjectId: itemId,
    organizationId,
  });
  refresh(locale);
}

/* ------------------------------ verification ------------------------------ */

const decisionSchema = z.enum(["accept", "reject"]);

/**
 * Who may decide a declaration: the association the person belongs to — their
 * own membership, or the association a translator was registered by — and the
 * association that owns the catalogue row, so MSF can confirm the OCP course it
 * runs for a translator who is nobody's member. Read from the record rather than
 * from the form, and matched by the queue on the page.
 */
function canDecide(
  organizationId: string,
  row: {
    memberOrganizationId: string | null;
    translatorOwnerId: string | null;
    ownerOrganizationId: string | null;
  },
): boolean {
  return (
    row.memberOrganizationId === organizationId ||
    row.translatorOwnerId === organizationId ||
    row.ownerOrganizationId === organizationId
  );
}

export async function decideSkillRecord(formData: FormData) {
  const { locale, organizationId, user } = await guardOrganization(
    formData,
    "courses.qualification.verify",
  );
  const recordId = uuidSchema.parse(formData.get("recordId"));
  const decision = decisionSchema.parse(formData.get("decision"));

  const [row] = await db
    .select({
      obtainedOn: skillRecords.obtainedOn,
      expiresOn: skillRecords.expiresOn,
      validityMonths: skills.validityMonths,
      ownerOrganizationId: skills.organizationId,
      memberOrganizationId: organizationMembers.organizationId,
      translatorOwnerId: translators.ownerOrganizationId,
    })
    .from(skillRecords)
    .innerJoin(skills, eq(skills.id, skillRecords.skillId))
    .leftJoin(
      organizationMembers,
      eq(organizationMembers.id, skillRecords.memberId),
    )
    .leftJoin(translators, eq(translators.id, skillRecords.translatorId))
    .where(eq(skillRecords.id, recordId))
    .limit(1);
  if (!row) throw new Error("No such declaration");
  if (!canDecide(organizationId, row)) notice(locale, "permission-denied");

  await db
    .update(skillRecords)
    .set({
      state: decision === "accept" ? "verified" : "rejected",
      verifiedById: user.id,
      verifiedAt: new Date(),
      // Confirming is what starts the clock, so this is where a validity period
      // becomes a date `mustBeCurrent` can be read against.
      expiresOn:
        decision === "accept"
          ? (row.expiresOn ?? expiryFrom(row.obtainedOn, row.validityMonths))
          : row.expiresOn,
    })
    .where(eq(skillRecords.id, recordId));

  await recordAudit({
    action:
      decision === "accept" ? "skill_record.verified" : "skill_record.rejected",
    subjectType: "skill_record",
    subjectId: recordId,
    organizationId,
  });
  refresh(locale);
}

export async function decideTrainingRecord(formData: FormData) {
  const { locale, organizationId, user } = await guardOrganization(
    formData,
    "courses.qualification.verify",
  );
  const recordId = uuidSchema.parse(formData.get("recordId"));
  const decision = decisionSchema.parse(formData.get("decision"));

  const [row] = await db
    .select({
      completedOn: trainingRecords.completedOn,
      expiresOn: trainingRecords.expiresOn,
      validityMonths: trainingCourses.validityMonths,
      ownerOrganizationId: trainingCourses.organizationId,
      memberOrganizationId: organizationMembers.organizationId,
      translatorOwnerId: translators.ownerOrganizationId,
    })
    .from(trainingRecords)
    .innerJoin(
      trainingCourses,
      eq(trainingCourses.id, trainingRecords.courseId),
    )
    .leftJoin(
      organizationMembers,
      eq(organizationMembers.id, trainingRecords.memberId),
    )
    .leftJoin(translators, eq(translators.id, trainingRecords.translatorId))
    .where(eq(trainingRecords.id, recordId))
    .limit(1);
  if (!row) throw new Error("No such declaration");
  if (!canDecide(organizationId, row)) notice(locale, "permission-denied");

  await db
    .update(trainingRecords)
    .set({
      state: decision === "accept" ? "verified" : "rejected",
      verifiedById: user.id,
      verifiedAt: new Date(),
      expiresOn:
        decision === "accept"
          ? (row.expiresOn ?? expiryFrom(row.completedOn, row.validityMonths))
          : row.expiresOn,
    })
    .where(eq(trainingRecords.id, recordId));

  await recordAudit({
    action:
      decision === "accept"
        ? "training_record.verified"
        : "training_record.rejected",
    subjectType: "training_record",
    subjectId: recordId,
    organizationId,
  });
  refresh(locale);
}
