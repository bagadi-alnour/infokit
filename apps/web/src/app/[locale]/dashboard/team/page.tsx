import { formatMessage } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, count, eq, inArray } from "drizzle-orm";

import { CreateTeamDialog } from "~/components/admin/create-team-dialog";
import { TeamRoster } from "~/components/admin/team-roster";
import { WorkspacePage } from "~/components/admin/workspace";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { env } from "~/env";
import { requireRouteLocale } from "~/i18n/route-locale";
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
  memberSkills,
  organizationMembers,
  organizations,
} from "~/server/db/schema";

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

  if (!env.ENABLE_PHASE3_MEMBER_ASSIGNMENTS) {
    return (
      <WorkspacePage>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t["team.title"]}
        </h1>
        <p className="text-copy-muted mt-2 text-sm">{t["team.disabled"]}</p>
      </WorkspacePage>
    );
  }

  const teams = await db
    .select({
      id: cityTeams.id,
      name: cityTeams.name,
      organizationId: cityTeams.organizationId,
      organizationName: organizations.displayName,
      cityCode: cities.code,
      cityName: cityTranslations.name,
    })
    .from(cityTeams)
    .innerJoin(organizations, eq(cityTeams.organizationId, organizations.id))
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
        search.org ? eq(cityTeams.organizationId, search.org) : undefined,
        search.city ? eq(cityTeams.cityId, search.city) : undefined,
      ),
    )
    .orderBy(asc(organizations.displayName), asc(cities.code));

  const teamIds = teams.map((team) => team.id);

  const [membershipRows, languageRows, organizationRows, cityRows] =
    await Promise.all([
      teamIds.length
        ? db
            .select({
              teamId: cityTeamMembers.teamId,
              isLead: cityTeamMembers.isLead,
              memberId: organizationMembers.id,
              displayName: organizationMembers.displayName,
              email: organizationMembers.contactEmail,
              status: organizationMembers.status,
              title: organizationMembers.title,
            })
            .from(cityTeamMembers)
            .innerJoin(
              organizationMembers,
              eq(cityTeamMembers.memberId, organizationMembers.id),
            )
            .where(
              and(
                inArray(cityTeamMembers.teamId, teamIds),
                eq(cityTeamMembers.active, true),
              ),
            )
            .orderBy(asc(organizationMembers.displayName))
        : Promise.resolve([]),
      db
        .select({ code: languages.code, nativeName: languages.nativeName })
        .from(languages)
        .where(eq(languages.enabled, true))
        .orderBy(asc(languages.publicSortOrder)),
      db
        .select({ id: organizations.id, name: organizations.displayName })
        .from(organizations)
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

  const memberIds = [...new Set(membershipRows.map((row) => row.memberId))];
  const [skillRows, memberLanguageRows, assignmentRows] = await Promise.all([
    memberIds.length
      ? db
          .select({
            memberId: memberSkills.memberId,
            skill: memberSkills.skill,
          })
          .from(memberSkills)
          .where(inArray(memberSkills.memberId, memberIds))
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
  ]);

  const skillsByMember = new Map<string, string[]>();
  for (const row of skillRows) {
    skillsByMember.set(row.memberId, [
      ...(skillsByMember.get(row.memberId) ?? []),
      row.skill,
    ]);
  }
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

  const rosterLabels = {
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
    memberRemoved: t["team.memberRemoved"],
    actionError: t["team.actionError"],
    empty: t["team.empty"],
    invite: t["team.invite"],
    inviteTitle: t["team.inviteTitle"],
    inviteHint: t["team.inviteHint"],
    inviteAction: t["team.inviteAction"],
    invited: t["team.invited"],
    inviteError: t["team.inviteError"],
    inviteNote: t["member.inviteNote"],
    email: t["member.email"],
    displayName: t["member.displayName"],
    title: t["member.title"],
    languagesSpoken: t["member.languagesSpoken"],
    skills: t["member.skills"],
    skillsHint: t["member.skillsHint"],
    cancel: t["member.cancel"],
    save: t["team.save"],
  };

  return (
    <WorkspacePage>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t["team.title"]}
          </h1>
          <p className="text-copy-muted mt-2 max-w-3xl text-sm">
            {t["team.sub"]}
          </p>
        </div>
        <CreateTeamDialog
          locale={locale}
          organizations={organizationOptions}
          cities={cityOptions}
          defaultOrganizationId={search.org}
          defaultCityId={search.city}
          labels={createTeamLabels}
        />
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm">
            {t["team.none"]}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {teams.map((team) => {
            const members = membershipRows
              .filter((row) => row.teamId === team.id)
              .map((row) => ({
                memberId: row.memberId,
                displayName: row.displayName,
                email: row.email,
                status: row.status,
                title: row.title,
                isLead: row.isLead,
                languages: languagesByMember.get(row.memberId) ?? [],
                skills: skillsByMember.get(row.memberId) ?? [],
                activityCount:
                  assignmentCounts.get(`${team.id}:${row.memberId}`) ?? 0,
              }));
            return (
              <Card key={team.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {team.name}
                    <Badge variant="secondary">
                      {formatMessage(t["team.membersCount"], {
                        count: String(members.length),
                      })}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {team.organizationName} · {team.cityName ?? team.cityCode}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TeamRoster
                    teamId={team.id}
                    locale={locale}
                    members={members}
                    languageOptions={languageOptions}
                    labels={rosterLabels}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </WorkspacePage>
  );
}
