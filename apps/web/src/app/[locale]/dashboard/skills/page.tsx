import { loadCatalog, loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, count, eq, inArray, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { CatalogueNotice } from "~/components/admin/catalogue-notice";
import type {
  CourseTableRow,
  LanguageTableRow,
  RequirementItemRow,
  RequirementSetRow,
  RequirementTargetOption,
  SkillsLabels,
  SkillTableRow,
  VerifyTableRow,
} from "~/components/admin/skills-rows";
import { SkillsWorkspace } from "~/components/admin/skills-workspace";
import {
  Chip,
  Notice,
  PageHeader,
  Stat,
  StatGrid,
  WorkspacePage,
} from "~/components/admin/workspace";
import { env } from "~/env";
import { requireRouteLocale } from "~/i18n/route-locale";
import {
  authorizationFor,
  organizationChoices,
} from "~/server/auth/authorization";
import { requireEditor } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  languages,
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
import {
  courseTitle,
  listCourses,
  listSkills,
  skillName,
} from "~/server/skills";

/**
 * One line for the person a declaration belongs to. Joined in SQL rather than in
 * TypeScript because both verification queues left-join the roster: `concat_ws`
 * skips a missing half, and `nullif` keeps "no member on this row" as null so the
 * translator branch still reads as the translator.
 */
const memberNameExpression = sql<
  string | null
>`nullif(concat_ws(' ', ${organizationMembers.firstName}, ${organizationMembers.lastName}), '')`;

/**
 * Skills and courses: the vocabulary a mission's conditions are written in.
 *
 * The page reads six lists — the platform's skills, the languages, the
 * association's own skills, the courses, the requirement sets and the
 * declarations waiting on somebody's word — resolves every name to the reader's
 * language, and counts what points at each row. Deciding here what may be
 * edited, deleted, promoted or confirmed means a table never offers a control
 * the server would refuse (docs/PRODUCT.md §11.4).
 *
 * Reach makes this page differ from the catalogue in one way worth naming: an
 * association also reads rows *other* associations shared with the network, so
 * "may I edit this?" is not "is it global or is it mine?" but "is it global and
 * am I a maintainer, or is it this association's own?".
 */
export default async function SkillsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const [t, catalogue, console_] = await Promise.all([
    loadPageCatalog(locale, "dashboard-skills"),
    loadPageCatalog(locale, "dashboard-catalogue"),
    loadCatalog(locale, "dashboard-console"),
  ]);

  // Behind the same flag as the teams whose members fill these in.
  if (!env.ENABLE_PHASE3_MEMBER_ASSIGNMENTS) {
    return (
      <WorkspacePage>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t["skills.title"]}
        </h1>
        <p className="text-copy-muted mt-2 text-sm">{t["skills.disabled"]}</p>
      </WorkspacePage>
    );
  }

  const requestedOrg = (await searchParams).org;
  const user = await requireEditor(locale);

  // Which association's rows this reader may see beside the platform's own, and
  // which one `?org=` selected among them.
  const { choices: organizationRows, selectedId: scopeOrgId } =
    await organizationChoices(
      user.id,
      typeof requestedOrg === "string" ? requestedOrg : undefined,
    );
  const scopeOrgName =
    organizationRows.find((organization) => organization.id === scopeOrgId)
      ?.name ?? catalogue["catalogue.scope.organization"];

  /**
   * Four rights, because four different people do these four things: the
   * platform's own vocabulary, an association's own rows, the requirement sets
   * a mission will be matched against, and a decision on somebody's
   * declaration. `planning.manage` and `courses.qualification.verify` are
   * granted by organisation roles, which is why the grants are read for the
   * organisation in scope.
   */
  const authorization = await authorizationFor(
    user.id,
    scopeOrgId ?? undefined,
  );
  const canManageGlobal =
    authorization.effectivePermissions.has("taxonomy.manage");
  const canManageOrg =
    !!scopeOrgId && authorization.effectivePermissions.has("courses.manage");
  const canPlan =
    !!scopeOrgId && authorization.effectivePermissions.has("planning.manage");
  const canVerify =
    !!scopeOrgId &&
    authorization.effectivePermissions.has("courses.qualification.verify");

  const [
    skillRows,
    courseRows,
    languageRows,
    skillDeclarationRows,
    skillConditionRows,
    courseDeclarationRows,
    courseConditionRows,
    memberSpeakerRows,
    translatorSpeakerRows,
    setRows,
  ] = await Promise.all([
    // Retired rows are shown here — this is where a row is turned back on.
    listSkills({ organizationId: scopeOrgId, includeInactive: true }),
    listCourses({ organizationId: scopeOrgId, includeInactive: true }),
    /**
     * Every language, not the `enabled` ones: `enabled` means the platform
     * publishes content in that language, which is a different question from
     * whether anybody speaks it. Both belong on this tab, and the difference is
     * the column that says which is which.
     */
    db
      .select({
        code: languages.code,
        nativeName: languages.nativeName,
        englishName: languages.englishName,
        frenchName: languages.frenchName,
        enabled: languages.enabled,
      })
      .from(languages)
      .orderBy(asc(languages.publicSortOrder), asc(languages.code)),
    db
      .select({ id: skillRecords.skillId, n: count() })
      .from(skillRecords)
      .groupBy(skillRecords.skillId),
    db
      .select({ id: requirementItems.skillId, n: count() })
      .from(requirementItems)
      .groupBy(requirementItems.skillId),
    db
      .select({ id: trainingRecords.courseId, n: count() })
      .from(trainingRecords)
      .groupBy(trainingRecords.courseId),
    db
      .select({ id: requirementItems.courseId, n: count() })
      .from(requirementItems)
      .groupBy(requirementItems.courseId),
    db
      .select({ code: memberLanguages.languageCode, n: count() })
      .from(memberLanguages)
      .groupBy(memberLanguages.languageCode),
    db
      .select({ code: translatorLanguages.languageCode, n: count() })
      .from(translatorLanguages)
      .groupBy(translatorLanguages.languageCode),
    scopeOrgId
      ? db
          .select({
            id: requirementSets.id,
            code: requirementSets.code,
            name: requirementSets.name,
            description: requirementSets.description,
          })
          .from(requirementSets)
          .where(eq(requirementSets.organizationId, scopeOrgId))
          .orderBy(asc(requirementSets.name))
      : Promise.resolve([]),
  ]);

  const setIds = setRows.map((set) => set.id);
  /**
   * The verification queue mirrors what `decideSkillRecord` will allow: the
   * association the person belongs to, the association a translator was
   * registered by, or the association that owns the catalogue row — so MSF sees
   * the OCP course it runs claimed by a translator who is nobody's member, and
   * nothing else.
   */
  const decidableBy = (owner: AnyPgColumn, organizationId: string) =>
    or(
      eq(organizationMembers.organizationId, organizationId),
      eq(translators.ownerOrganizationId, organizationId),
      eq(owner, organizationId),
    );

  const [conditionRows, pendingSkillRows, pendingCourseRows] =
    await Promise.all([
      setIds.length
        ? db
            .select({
              id: requirementItems.id,
              setId: requirementItems.setId,
              skillId: requirementItems.skillId,
              courseId: requirementItems.courseId,
              languageCode: requirementItems.languageCode,
              necessity: requirementItems.necessity,
              mustBeVerified: requirementItems.mustBeVerified,
              mustBeCurrent: requirementItems.mustBeCurrent,
              minimumCount: requirementItems.minimumCount,
              note: requirementItems.note,
              skillNameFr: skills.nameFr,
              skillNameEn: skills.nameEn,
              skillNameAr: skills.nameAr,
              courseTitleFr: trainingCourses.title,
              courseTitleEn: trainingCourses.titleEn,
              courseTitleAr: trainingCourses.titleAr,
              languageName: languages.nativeName,
            })
            .from(requirementItems)
            .leftJoin(skills, eq(skills.id, requirementItems.skillId))
            .leftJoin(
              trainingCourses,
              eq(trainingCourses.id, requirementItems.courseId),
            )
            .leftJoin(
              languages,
              eq(languages.code, requirementItems.languageCode),
            )
            .where(inArray(requirementItems.setId, setIds))
            .orderBy(
              asc(requirementItems.necessity),
              asc(requirementItems.createdAt),
            )
        : Promise.resolve([]),
      scopeOrgId
        ? db
            .select({
              id: skillRecords.id,
              declaredAt: skillRecords.createdAt,
              nameFr: skills.nameFr,
              nameEn: skills.nameEn,
              nameAr: skills.nameAr,
              memberName: memberNameExpression,
              translatorName: translators.displayName,
            })
            .from(skillRecords)
            .innerJoin(skills, eq(skills.id, skillRecords.skillId))
            .leftJoin(
              organizationMembers,
              eq(organizationMembers.id, skillRecords.memberId),
            )
            .leftJoin(
              translators,
              eq(translators.id, skillRecords.translatorId),
            )
            .where(
              and(
                eq(skillRecords.state, "awaiting_verification"),
                decidableBy(skills.organizationId, scopeOrgId),
              ),
            )
            .orderBy(asc(skillRecords.createdAt))
        : Promise.resolve([]),
      scopeOrgId
        ? db
            .select({
              id: trainingRecords.id,
              declaredAt: trainingRecords.createdAt,
              title: trainingCourses.title,
              titleEn: trainingCourses.titleEn,
              titleAr: trainingCourses.titleAr,
              memberName: memberNameExpression,
              translatorName: translators.displayName,
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
            .leftJoin(
              translators,
              eq(translators.id, trainingRecords.translatorId),
            )
            .where(
              and(
                eq(trainingRecords.state, "awaiting_verification"),
                decidableBy(trainingCourses.organizationId, scopeOrgId),
              ),
            )
            .orderBy(asc(trainingRecords.createdAt))
        : Promise.resolve([]),
    ]);

  const organizationName = new Map(
    organizationRows.map((organization) => [
      organization.id,
      organization.name,
    ]),
  );
  /** Who wrote a row: the platform reads as InfoKit, never as "no association". */
  const ownerName = (organizationId: string | null) =>
    organizationId === null
      ? t["skills.owner.platform"]
      : (organizationName.get(organizationId) ?? scopeOrgName);

  /**
   * A row is this association's to correct when it wrote it, and the platform's
   * when nobody did. The rows another association shared with the network are
   * read here too, which is why owning the row is part of the question.
   */
  const canEditRow = (organizationId: string | null) =>
    organizationId === null
      ? canManageGlobal
      : organizationId === scopeOrgId && canManageOrg;

  const asCount = (rows: { id: string | null; n: number }[]) =>
    new Map(
      rows
        .filter((row): row is { id: string; n: number } => row.id !== null)
        .map((row) => [row.id, row.n]),
    );
  const skillDeclarations = asCount(skillDeclarationRows);
  const skillConditions = asCount(skillConditionRows);
  const courseDeclarations = asCount(courseDeclarationRows);
  const courseConditions = asCount(courseConditionRows);

  const skillTableRows: SkillTableRow[] = skillRows.map((skill) => {
    // Declarations and requirement conditions both break if the row goes.
    const referenced =
      (skillDeclarations.get(skill.id) ?? 0) +
      (skillConditions.get(skill.id) ?? 0);
    const canEdit = canEditRow(skill.organizationId);
    return {
      id: skill.id,
      name: skillName(skill, locale),
      nameFr: skill.nameFr,
      nameEn: skill.nameEn ?? "",
      nameAr: skill.nameAr ?? "",
      code: skill.code,
      kind: skill.kind,
      descriptionFr: skill.descriptionFr ?? "",
      organizationId: skill.organizationId,
      ownerName: ownerName(skill.organizationId),
      visibility: skill.visibility,
      verificationRequired: skill.verificationRequired,
      validityMonths: skill.validityMonths,
      referenceUrl: skill.referenceUrl ?? "",
      active: skill.active,
      usageCount: referenced,
      canEdit,
      canDelete: canEdit && referenced === 0,
      // Handing a row over is the platform's move, and only on a row it does
      // not already own.
      canPromote: canEdit && canManageGlobal && skill.organizationId !== null,
    };
  });

  const courseTableRows: CourseTableRow[] = courseRows.map((course) => {
    const referenced =
      (courseDeclarations.get(course.id) ?? 0) +
      (courseConditions.get(course.id) ?? 0);
    const canEdit = canEditRow(course.organizationId);
    return {
      id: course.id,
      title: courseTitle(course, locale),
      titleFr: course.title,
      titleEn: course.titleEn ?? "",
      titleAr: course.titleAr ?? "",
      slug: course.slug,
      description: course.description ?? "",
      provider: course.provider ?? "",
      url: course.url ?? "",
      organizationId: course.organizationId,
      ownerName: ownerName(course.organizationId),
      visibility: course.visibility,
      verificationRequired: course.verificationRequired,
      validityMonths: course.validityMonths,
      active: course.active,
      usageCount: referenced,
      canEdit,
      canDelete: canEdit && referenced === 0,
    };
  });

  const speakerCount = new Map<string, number>();
  for (const row of [...memberSpeakerRows, ...translatorSpeakerRows]) {
    speakerCount.set(row.code, (speakerCount.get(row.code) ?? 0) + row.n);
  }
  /**
   * A second handle on a language, under the name its own speakers write, so
   * searching "pachto" finds پښتو. Arabic has no stored name column, and the
   * languages spoken here are largely written in Arabic script anyway, so an
   * Arabic reader gets the English name as the second handle.
   */
  const readerName = (row: { englishName: string; frenchName: string }) =>
    locale === "fr" ? row.frenchName : row.englishName;
  const languageTableRows: LanguageTableRow[] = languageRows.map(
    (language) => ({
      code: language.code,
      name: language.nativeName,
      secondaryName: readerName(language),
      published: language.enabled,
      speakerCount: speakerCount.get(language.code) ?? 0,
    }),
  );

  const conditionLabel = (row: (typeof conditionRows)[number]) => {
    if (row.skillId && row.skillNameFr !== null) {
      return skillName(
        {
          nameFr: row.skillNameFr,
          nameEn: row.skillNameEn,
          nameAr: row.skillNameAr,
        },
        locale,
      );
    }
    if (row.courseId && row.courseTitleFr !== null) {
      return courseTitle(
        {
          title: row.courseTitleFr,
          titleEn: row.courseTitleEn,
          titleAr: row.courseTitleAr,
        },
        locale,
      );
    }
    return row.languageName ?? row.languageCode ?? "—";
  };
  const conditionsBySet = new Map<string, RequirementItemRow[]>();
  for (const row of conditionRows) {
    conditionsBySet.set(row.setId, [
      ...(conditionsBySet.get(row.setId) ?? []),
      {
        id: row.id,
        group: row.skillId ? "skill" : row.courseId ? "course" : "language",
        label: conditionLabel(row),
        necessity: row.necessity,
        mustBeVerified: row.mustBeVerified,
        mustBeCurrent: row.mustBeCurrent,
        minimumCount: row.minimumCount,
        note: row.note ?? "",
      },
    ]);
  }
  const requirementSetRows: RequirementSetRow[] = setRows.map((set) => ({
    id: set.id,
    name: set.name,
    code: set.code,
    description: set.description ?? "",
    items: conditionsBySet.get(set.id) ?? [],
  }));

  /**
   * What a condition may point at: one list, offered as three. Only rows the
   * association can still reach are offered — `addRequirementItem` re-derives
   * the same reach, so a stale page cannot smuggle a retired row in.
   */
  const requirementTargets: RequirementTargetOption[] = [
    ...skillTableRows
      .filter((row) => row.active)
      .map((row) => ({
        value: `skill:${row.id}`,
        label: row.name,
        description: t["skills.requirements.group.skills"],
      })),
    ...courseTableRows
      .filter((row) => row.active)
      .map((row) => ({
        value: `course:${row.id}`,
        label: row.title,
        description: t["skills.requirements.group.courses"],
      })),
    ...languageTableRows.map((row) => ({
      value: `language:${row.code}`,
      label: row.name,
      description: t["skills.requirements.group.languages"],
    })),
  ];

  const declaredOn = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const pending: VerifyTableRow[] = [
    ...pendingSkillRows.map((row) => ({
      id: row.id,
      kind: "skill" as const,
      item: skillName(row, locale),
      person: { name: row.memberName, translator: row.translatorName },
      declaredAt: row.declaredAt,
    })),
    ...pendingCourseRows.map((row) => ({
      id: row.id,
      kind: "course" as const,
      item: courseTitle(row, locale),
      person: { name: row.memberName, translator: row.translatorName },
      declaredAt: row.declaredAt,
    })),
  ]
    // Both queues came oldest first; merged, they have to be sorted again.
    .sort((a, b) => a.declaredAt.getTime() - b.declaredAt.getTime())
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      item: row.item,
      personName: row.person.translator ?? row.person.name ?? "—",
      personKind: row.person.translator ? "translator" : "member",
      declaredOn: declaredOn.format(row.declaredAt),
    }));

  const globalSkills = skillTableRows.filter(
    (row) => row.organizationId === null,
  );
  const ourSkills = skillTableRows.filter((row) => row.organizationId !== null);

  const labels: SkillsLabels = {
    ...t,
    ...catalogue,
    shared: console_,
    table: {
      search: console_["console.search"],
      searchPlaceholder: console_["console.search"],
      columns: console_["table.columns"],
      clear: console_["table.clearSearch"],
      noMatch: console_["console.filter.noMatch"],
      rowsPerPage: console_["table.rowsPerPage"],
      results: console_["table.results"],
      page: console_["table.page"],
      previous: console_["table.previousPage"],
      next: console_["table.nextPage"],
    },
  };

  return (
    <WorkspacePage>
      <CatalogueNotice
        duplicateNameMessage={t["skills.duplicate"]}
        inUseMessage={catalogue["catalogue.inUse"]}
      />
      <PageHeader
        title={t["skills.title"]}
        sub={t["skills.description"]}
        badges={
          scopeOrgId ? (
            <Chip tone="accent">{scopeOrgName}</Chip>
          ) : (
            <Chip tone="neutral">{t["skills.owner.platform"]}</Chip>
          )
        }
      />

      {canManageGlobal || canManageOrg ? null : (
        <Notice title={t["skills.readonly"]} />
      )}

      <StatGrid>
        <Stat label={t["skills.stat.global"]} value={globalSkills.length} />
        <Stat label={t["skills.stat.ours"]} value={ourSkills.length} />
        <Stat label={t["skills.stat.courses"]} value={courseTableRows.length} />
        <Stat
          label={t["skills.stat.pending"]}
          value={pending.length}
          hint={t["skills.stat.pendingHint"]}
        />
      </StatGrid>

      <SkillsWorkspace
        globalSkills={globalSkills}
        ourSkills={ourSkills}
        languages={languageTableRows}
        courses={courseTableRows}
        requirementSets={requirementSetRows}
        requirementTargets={requirementTargets}
        pending={pending}
        rights={{ canManageGlobal, canManageOrg, scopeOrgId, scopeOrgName }}
        canPlan={canPlan}
        canVerify={canVerify}
        locale={locale}
        labels={labels}
      />
    </WorkspacePage>
  );
}
