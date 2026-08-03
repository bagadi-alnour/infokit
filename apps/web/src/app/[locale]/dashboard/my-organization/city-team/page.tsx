import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";

import { CreateTeamDialog } from "~/components/admin/create-team-dialog";
import {
  TeamBoard,
  type BoardLabels,
  type BoardMember,
  type BoardPlacement,
  type MemberSkill,
} from "~/components/admin/team-board";
import {
  EmptyState,
  PageHeader,
  Stat,
  StatGrid,
  WorkspacePage,
} from "~/components/admin/workspace";
import { env } from "~/env";
import { requireRouteLocale } from "~/i18n/route-locale";
import { recordRestrictedRead } from "~/server/audit/reads";
import { type PermissionScope } from "~/server/auth/authorization";
import { denyPageAccess, requireEditor } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  activities,
  activityMemberAssignments,
  cities,
  cityTeamMembers,
  cityTeams,
  cityTranslations,
  languages,
  memberLanguages,
  organizationMembers,
  organizations,
  skillRecords,
  skills,
} from "~/server/db/schema";
import {
  MEMBER_DIRECTORY_PERMISSION,
  memberDirectoryScope,
} from "~/server/members";
import { listSkillsForOrganizations, skillName } from "~/server/skills";

/**
 * The columns this page's scope is applied to, spelled as a union of the actual
 * ones rather than a loose `AnyPgColumn`: a fourth list of people would have to
 * be named here to be filtered, which is the point — a query nobody remembered
 * to scope is a tenant leak, and this board reads three tables about people.
 */
type OwnerColumn =
  | typeof cityTeams.organizationId
  | typeof organizationMembers.organizationId
  | typeof organizations.id;

/** The scope, as the one condition every query below starts from. */
function scopeCondition(column: OwnerColumn, scope: PermissionScope) {
  if (scope.platform) return undefined;
  return inArray(column, [...scope.organizationIds]);
}

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ org?: string; city?: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const search = await searchParams;
  const t = await loadPageCatalog(locale, "dashboard-console");
  const user = await requireEditor(locale);

  if (!env.ENABLE_PHASE3_MEMBER_ASSIGNMENTS) {
    return (
      <WorkspacePage>
        <PageHeader title={t["team.title"]} sub={t["team.disabled"]} />
      </WorkspacePage>
    );
  }

  /**
   * Who may read a roster, and whose. Being signed in to the console is not the
   * answer: this board is every member of every organisation in scope, with the
   * address and the number each of them left, so it is behind the same grant
   * that opens contact details on an organisation's own record, and it shows the
   * organisations that grant answers for — nobody else's.
   *
   * The refusal is the console's ordinary one: back to where the reader came
   * from with the permission notice, and a row in the trail saying which grant
   * was missing.
   */
  const scope = await memberDirectoryScope(user.id);
  if (scope === null) {
    await denyPageAccess(MEMBER_DIRECTORY_PERMISSION, locale);
    // `denyPageAccess` redirects, which throws; this only tells the compiler so.
    return null;
  }

  const [teamRows, memberRows, languageRows, organizationRows, cityRows] =
    await Promise.all([
      db
        .select({
          id: cityTeams.id,
          name: cityTeams.name,
          organizationId: cityTeams.organizationId,
          cityId: cityTeams.cityId,
          cityCode: cities.code,
          cityName: cityTranslations.name,
        })
        .from(cityTeams)
        .innerJoin(cities, eq(cityTeams.cityId, cities.id))
        .leftJoin(
          cityTranslations,
          and(
            eq(cityTranslations.cityId, cities.id),
            eq(cityTranslations.languageCode, locale),
          ),
        )
        .where(
          and(
            eq(cityTeams.active, true),
            scopeCondition(cityTeams.organizationId, scope),
            // The filter narrows inside the scope; an id from outside it simply
            // matches nothing, because the scope is the guarantee and `?org=` is
            // the convenience.
            search.org ? eq(cityTeams.organizationId, search.org) : undefined,
          ),
        )
        .orderBy(asc(cities.code), asc(cityTeams.name)),
      /**
       * Every member of the organisation, not only those joined through a team:
       * somebody can be on the books before there is a team to put them on, and
       * a person the board cannot show is a person nobody remembers to place.
       */
      db
        .select({
          memberId: organizationMembers.id,
          organizationId: organizationMembers.organizationId,
          firstName: organizationMembers.firstName,
          lastName: organizationMembers.lastName,
          email: organizationMembers.contactEmail,
          phone: organizationMembers.phone,
          title: organizationMembers.title,
          status: organizationMembers.status,
        })
        .from(organizationMembers)
        .where(
          and(
            isNull(organizationMembers.offboardedAt),
            scopeCondition(organizationMembers.organizationId, scope),
            search.org
              ? eq(organizationMembers.organizationId, search.org)
              : undefined,
          ),
        )
        .orderBy(
          asc(organizationMembers.lastName),
          asc(organizationMembers.firstName),
        ),
      /**
       * Every language in the catalogue, not the `enabled` ones: `enabled`
       * means the platform publishes content in that language, which is a
       * different question from whether a member speaks it. Someone may
       * welcome people in Italian on a site that stays unreadable in Italian.
       */
      db
        .select({ code: languages.code, nativeName: languages.nativeName })
        .from(languages)
        .orderBy(asc(languages.publicSortOrder), asc(languages.code)),
      /**
       * The names behind the filter and the create dialog. Scoped too: a reader
       * who may see one association's members has no business being handed the
       * list of every association in a dropdown.
       */
      db
        .select({ id: organizations.id, name: organizations.displayName })
        .from(organizations)
        .where(scopeCondition(organizations.id, scope))
        .orderBy(asc(organizations.displayName)),
      db
        .select({
          id: cities.id,
          code: cities.code,
          name: cityTranslations.name,
        })
        .from(cities)
        .leftJoin(
          cityTranslations,
          and(
            eq(cityTranslations.cityId, cities.id),
            eq(cityTranslations.languageCode, locale),
          ),
        )
        .where(eq(cities.active, true))
        .orderBy(asc(cities.code)),
    ]);

  /**
   * `?city=` scopes to the associations that work in that city and then shows
   * each of them whole. Hiding their other city teams would be worse than
   * unhelpful: a member of the hidden team would fall into the unassigned
   * column and read as somebody nobody had placed yet.
   */
  const cityScoped = search.city
    ? new Set(
        teamRows
          .filter((team) => team.cityId === search.city)
          .map((team) => team.organizationId),
      )
    : null;
  const inScope = (organizationId: string) =>
    cityScoped === null || cityScoped.has(organizationId);

  const visibleOrganizationIds = new Set<string>();
  for (const team of teamRows) {
    if (inScope(team.organizationId))
      visibleOrganizationIds.add(team.organizationId);
  }
  for (const member of memberRows) {
    if (inScope(member.organizationId)) {
      visibleOrganizationIds.add(member.organizationId);
    }
  }

  const teams = teamRows.filter((team) =>
    visibleOrganizationIds.has(team.organizationId),
  );
  const members = memberRows.filter((member) =>
    visibleOrganizationIds.has(member.organizationId),
  );
  const teamIds = teams.map((team) => team.id);
  const memberIds = members.map((member) => member.memberId);
  const organizationIds = [...visibleOrganizationIds];

  /**
   * The board is the platform's densest personal-data read: every member of
   * every organisation in scope, with the address and the number each of them
   * left. One row records that it happened and how much of it was disclosed —
   * not the names, which are the thing being protected.
   *
   * Unscoped, it belongs to no single organisation, so the row is a platform one
   * and only a platform reader sees it; narrowed to one organisation, it is that
   * organisation's own event and their administrators can read it.
   */
  if (members.length > 0) {
    await recordRestrictedRead({
      action: "member.directory_read",
      subjectType: "core.city_team_board",
      subjectId: organizationIds.length === 1 ? organizationIds[0] : null,
      organizationId: organizationIds.length === 1 ? organizationIds[0] : null,
      metadata: {
        members: members.length,
        organizations: organizationIds.length,
        teams: teams.length,
        // Which right the reader held while reading: a coordinator reading their
        // own association is the job, and a platform-wide read of everybody's
        // rosters is the thing a review wants to be able to find.
        scope: scope.platform ? "platform" : "organizations",
        organizationFilter: search.org ?? null,
        cityFilter: search.city ?? null,
      },
    });
  }

  const [
    placementRows,
    skillRows,
    memberLanguageRows,
    assignmentRows,
    skillsByOrganization,
  ] = await Promise.all([
    teamIds.length
      ? db
          .select({
            teamId: cityTeamMembers.teamId,
            memberId: cityTeamMembers.memberId,
            isLead: cityTeamMembers.isLead,
          })
          .from(cityTeamMembers)
          .where(
            and(
              inArray(cityTeamMembers.teamId, teamIds),
              eq(cityTeamMembers.active, true),
            ),
          )
      : Promise.resolve([]),
    /**
     * Declarations are joined to the catalogue rather than read as text, so a
     * retired row still reads with its own name — the picker just stops
     * offering it.
     */
    memberIds.length
      ? db
          .select({
            memberId: skillRecords.memberId,
            skillId: skillRecords.skillId,
            state: skillRecords.state,
            nameFr: skills.nameFr,
            nameEn: skills.nameEn,
            nameAr: skills.nameAr,
          })
          .from(skillRecords)
          .innerJoin(skills, eq(skillRecords.skillId, skills.id))
          .where(inArray(skillRecords.memberId, memberIds))
          .orderBy(asc(skills.nameFr))
      : Promise.resolve([]),
    memberIds.length
      ? db
          .select({
            memberId: memberLanguages.memberId,
            languageCode: memberLanguages.languageCode,
          })
          .from(memberLanguages)
          .where(inArray(memberLanguages.memberId, memberIds))
      : Promise.resolve([]),
    memberIds.length && teamIds.length
      ? db
          .select({
            memberId: activityMemberAssignments.memberId,
            teamId: activities.teamId,
            n: count(),
          })
          .from(activityMemberAssignments)
          .innerJoin(
            activities,
            eq(activityMemberAssignments.activityId, activities.id),
          )
          .where(
            and(
              inArray(activityMemberAssignments.memberId, memberIds),
              inArray(activities.teamId, teamIds),
              eq(activityMemberAssignments.active, true),
            ),
          )
          .groupBy(activityMemberAssignments.memberId, activities.teamId)
      : Promise.resolve([]),
    listSkillsForOrganizations(organizationIds),
  ]);

  const skillsByMember = new Map<string, MemberSkill[]>();
  for (const row of skillRows) {
    if (!row.memberId) continue;
    skillsByMember.set(row.memberId, [
      ...(skillsByMember.get(row.memberId) ?? []),
      { id: row.skillId, label: skillName(row, locale), state: row.state },
    ]);
  }
  const skillOptionsByOrganization = new Map(
    [...skillsByOrganization].map(([organizationId, rows]) => [
      organizationId,
      rows.map((row) => ({
        value: row.id,
        label: skillName(row, locale),
        description:
          row.organizationId === null ? t["member.skillShared"] : undefined,
      })),
    ]),
  );
  const languagesByMember = new Map<string, string[]>();
  for (const row of memberLanguageRows) {
    languagesByMember.set(row.memberId, [
      ...(languagesByMember.get(row.memberId) ?? []),
      row.languageCode,
    ]);
  }
  const assignmentCounts = new Map<string, number>();
  for (const row of assignmentRows) {
    if (!row.teamId) continue;
    assignmentCounts.set(`${row.teamId}:${row.memberId}`, row.n);
  }

  const boardMembers: BoardMember[] = members.map((member) => ({
    memberId: member.memberId,
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    phone: member.phone,
    title: member.title,
    status: member.status,
    languages: languagesByMember.get(member.memberId) ?? [],
    skills: skillsByMember.get(member.memberId) ?? [],
  }));
  const memberOrganization = new Map(
    members.map((member) => [member.memberId, member.organizationId]),
  );
  const placements: BoardPlacement[] = placementRows
    .filter((row) => memberOrganization.has(row.memberId))
    .map((row) => ({
      memberId: row.memberId,
      teamId: row.teamId,
      isLead: row.isLead,
      activityCount: assignmentCounts.get(`${row.teamId}:${row.memberId}`) ?? 0,
    }));
  const placedMemberIds = new Set(
    placements.map((placement) => placement.memberId),
  );

  const languageOptions = languageRows.map((language) => ({
    code: language.code,
    label: language.nativeName,
  }));
  const organizationOptions = organizationRows.map((organization) => ({
    id: organization.id,
    label: organization.name,
  }));
  const cityOptions = cityRows.map((city) => ({
    id: city.id,
    label: city.name ?? city.code,
  }));
  const organizationNames = new Map(
    organizationRows.map((organization) => [
      organization.id,
      organization.name,
    ]),
  );

  const createTeamLabels = {
    create: t["team.create"],
    createTitle: t["team.createTitle"],
    createHint: t["team.createHint"],
    organization: t["team.organization"],
    city: t["team.city"],
    name: t["team.nameLabel"],
    nameHint: t["team.nameHint"],
    createAction: t["team.createAction"],
    created: t["team.created"],
    createError: t["team.createError"],
    cancel: t["member.cancel"],
    noMatch: t["member.noMatch"],
  };

  const boardLabels: BoardLabels = {
    organizationTeams: t["team.teamsCount"],
    membersCount: t["team.membersCount"],
    unassignedTitle: t["team.unassignedTitle"],
    unassignedHint: t["team.unassignedHint"],
    unassignedEmpty: t["team.unassignedEmpty"],
    noTeamHere: t["team.empty"],
    dragHint: t["team.dragHint"],
    dropHere: t["team.dropHere"],
    noTeam: t["team.noTeam"],
    cityTeam: t["team.title"],
    moveTo: t["team.moveTo"],
    moved: t["team.moved"],
    memberRemoved: t["team.memberRemoved"],
    lead: t["member.lead"],
    pending: t["member.pending"],
    active: t["member.active"],
    activities: t["team.activities"],
    rowMenu: t["team.rowMenu"],
    makeLead: t["team.makeLead"],
    removeLead: t["team.removeLead"],
    leadChanged: t["team.leadChanged"],
    editProfile: t["team.editProfile"],
    profileSaved: t["team.profileSaved"],
    resendInvite: t["team.resendInvite"],
    inviteResent: t["team.inviteResent"],
    removeMember: t["team.removeMember"],
    actionError: t["team.actionError"],
    addMember: t["team.addMember"],
    addMemberTitle: t["team.addMemberTitle"],
    addMemberHint: t["team.addMemberHint"],
    addMemberAction: t["team.addMemberAction"],
    addToTeam: t["team.addToTeam"],
    invited: t["team.invited"],
    inviteError: t["team.inviteError"],
    inviteNote: t["team.addMemberNote"],
    firstName: t["member.firstName"],
    lastName: t["member.lastName"],
    email: t["member.email"],
    phone: t["member.phone"],
    phoneHint: t["member.phoneHint"],
    title: t["member.title"],
    titleHint: t["member.titleHint"],
    languagesSpoken: t["member.languagesSpoken"],
    languagesSpokenHint: t["member.languagesSpokenHint"],
    skills: t["member.skills"],
    skillsHint: t["member.skillsHint"],
    skillsPlaceholder: t["member.skillsPlaceholder"],
    skillsEmpty: t["member.skillsEmpty"],
    noMatch: t["member.noMatch"],
    cancel: t["member.cancel"],
    save: t["team.save"],
  };

  return (
    <WorkspacePage>
      <PageHeader
        title={t["team.title"]}
        sub={t["team.sub"]}
        action={
          <CreateTeamDialog
            locale={locale}
            organizations={organizationOptions}
            cities={cityOptions}
            defaultOrganizationId={search.org}
            defaultCityId={search.city}
            labels={createTeamLabels}
          />
        }
      />

      {organizationIds.length === 0 ? (
        <EmptyState>{t["team.none"]}</EmptyState>
      ) : (
        <>
          <StatGrid>
            <Stat label={t["team.statTeams"]} value={teams.length} />
            <Stat label={t["team.statMembers"]} value={boardMembers.length} />
            <Stat
              label={t["team.statUnassigned"]}
              value={
                boardMembers.filter(
                  (member) => !placedMemberIds.has(member.memberId),
                ).length
              }
              hint={t["team.statUnassignedHint"]}
            />
            <Stat
              label={t["team.statPending"]}
              value={
                boardMembers.filter((member) => member.status === "invited")
                  .length
              }
              hint={t["team.statPendingHint"]}
            />
          </StatGrid>

          {organizationIds
            .map((organizationId) => ({
              organizationId,
              name: organizationNames.get(organizationId) ?? organizationId,
            }))
            .sort((left, right) => left.name.localeCompare(right.name, locale))
            .map((organization) => (
              <TeamBoard
                key={organization.organizationId}
                locale={locale}
                organizationId={organization.organizationId}
                organizationName={organization.name}
                teams={teams
                  .filter(
                    (team) =>
                      team.organizationId === organization.organizationId,
                  )
                  .map((team) => ({
                    id: team.id,
                    name: team.name,
                    cityLabel: team.cityName ?? team.cityCode,
                  }))}
                members={boardMembers.filter(
                  (member) =>
                    memberOrganization.get(member.memberId) ===
                    organization.organizationId,
                )}
                placements={placements.filter(
                  (placement) =>
                    memberOrganization.get(placement.memberId) ===
                    organization.organizationId,
                )}
                languageOptions={languageOptions}
                skillOptions={
                  skillOptionsByOrganization.get(organization.organizationId) ??
                  []
                }
                labels={boardLabels}
              />
            ))}
        </>
      )}
    </WorkspacePage>
  );
}
