"use server";

import type { Locale } from "@infokit/shared/i18n";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { env } from "~/env";
import { localizedPath } from "~/i18n/routing";
import {
  optionalText,
  optionalUuid,
  personName,
  phoneNumber,
} from "~/lib/form-fields";
import { recordAudit } from "~/server/audit";
import { protectedPermissionAction } from "~/server/auth/require";
import { db } from "~/server/db";
import { sendMemberInvitation } from "~/server/invitations";
import {
  insertMember,
  validLanguageCodes,
  writeMemberProfile,
} from "~/server/members";
import {
  activities,
  activityMemberAssignments,
  cities,
  cityTeamMembers,
  cityTeams,
  organizationMembers,
  organizations,
  users,
} from "~/server/db/schema";

function refresh(locale: Locale) {
  revalidatePath(localizedPath("/dashboard/team", locale));
  revalidatePath(localizedPath("/dashboard/activities", locale));
}

function assertEnabled() {
  if (!env.ENABLE_PHASE3_MEMBER_ASSIGNMENTS) {
    throw new Error("Phase 3 member assignments are not enabled");
  }
}

async function requireTeam(teamId: string) {
  const [team] = await db
    .select({
      id: cityTeams.id,
      organizationId: cityTeams.organizationId,
      name: cityTeams.name,
      organizationName: organizations.displayName,
    })
    .from(cityTeams)
    .innerJoin(organizations, eq(cityTeams.organizationId, organizations.id))
    .where(eq(cityTeams.id, teamId));
  if (!team) throw new Error("Unknown team");
  return team;
}

async function requireOrganization(organizationId: string) {
  const [organization] = await db
    .select({ id: organizations.id, name: organizations.displayName })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  if (!organization) throw new Error("Unknown organisation");
  return organization;
}

async function requireMember(memberId: string) {
  const [member] = await db
    .select({
      id: organizationMembers.id,
      organizationId: organizationMembers.organizationId,
      organizationName: organizations.displayName,
      email: organizationMembers.contactEmail,
      status: organizationMembers.status,
      userId: organizationMembers.userId,
    })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id),
    )
    .where(eq(organizationMembers.id, memberId));
  if (!member) throw new Error("Unknown member");
  return member;
}

/**
 * Leaving a team also ends the assignments that came with it: an activity of
 * that team is staffed from its roster, so somebody who is no longer on the
 * roster is no longer expected on Tuesday either. The membership row and its
 * history stay intact — `active: false`, never a delete.
 */
async function deactivateTeamAssignments(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  memberId: string,
  teamId: string,
) {
  const teamActivities = await tx
    .select({ id: activities.id })
    .from(activities)
    .where(eq(activities.teamId, teamId));
  if (teamActivities.length === 0) return;
  await tx
    .update(activityMemberAssignments)
    .set({ active: false })
    .where(
      and(
        eq(activityMemberAssignments.memberId, memberId),
        inArray(
          activityMemberAssignments.activityId,
          teamActivities.map((activity) => activity.id),
        ),
      ),
    );
}

/* ------------------------------- create ------------------------------ */

const createTeamSchema = z.object({
  organizationId: z.string().uuid(),
  cityId: z.string().uuid(),
  name: optionalText,
});

/**
 * One team per organisation and city (`city_teams_org_city_uq`). Creating a
 * team is picking a city the organisation does not yet publish in; the name
 * defaults to a city-scoped label. Activities auto-create their team too, so
 * this is the explicit path for setting one up ahead of the first activity.
 */
export const createTeam = protectedPermissionAction(
  "teams.manage",
  async (formData, locale) => {
    assertEnabled();
    const parsed = createTeamSchema.parse({
      organizationId: formData.get("organizationId"),
      cityId: formData.get("cityId"),
      name: formData.get("name") ?? "",
    });
    const [city] = await db
      .select({ code: cities.code })
      .from(cities)
      .where(eq(cities.id, parsed.cityId));
    if (!city) throw new Error("Unknown city");
    await requireOrganization(parsed.organizationId);

    const [team] = await db
      .insert(cityTeams)
      .values({
        organizationId: parsed.organizationId,
        cityId: parsed.cityId,
        name: parsed.name ?? `${city.code} publishing team`,
      })
      .onConflictDoNothing()
      .returning({ id: cityTeams.id });
    if (!team) {
      throw new Error("This organisation already has a team in this city");
    }
    await recordAudit({
      action: "team.created",
      subjectType: "team",
      subjectId: team.id,
      organizationId: parsed.organizationId,
      metadata: { cityId: parsed.cityId },
    });
    refresh(locale);
  },
);

/* ------------------------------- invite ------------------------------ */

/**
 * What every member row carries (`core.organization_members`): the two halves of
 * a name, the function held, a reachable number and an address. None of them is
 * optional — a roster of half-filled rows is what makes a coverage board
 * unusable, and the number is what a coordinator needs when a maraude changes at
 * six in the evening.
 */
const identityFields = {
  firstName: personName,
  lastName: personName,
  email: z.string().trim().toLowerCase().email(),
  phone: phoneNumber,
  title: z.string().trim().min(2).max(160),
};

const inviteSchema = z.object({
  organizationId: z.string().uuid(),
  /**
   * Blank when the person is joining the organisation without a team yet: they
   * exist on the books, they show in the unassigned column, and a coordinator
   * drops them onto a team when there is one to put them on.
   */
  teamId: optionalUuid,
  ...identityFields,
  /**
   * Catalogue ids, not typed words: `replaceSkillRecords` keeps only the rows
   * this organisation may actually point at, so a stale or forged id costs
   * nothing. Bounded the same way the language list is.
   */
  skillIds: z.array(z.string().uuid()).max(40),
  languages: z.array(z.string().min(2).max(35)).max(30),
});

function readIdentity(formData: FormData) {
  return {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    title: formData.get("title"),
  };
}

/**
 * Add a person to the organisation, on a team or not yet. If no account exists
 * for the address, the membership is reserved and an email invitation to join is
 * sent immediately.
 */
export const inviteMember = protectedPermissionAction(
  "members.manage",
  async (formData, locale, user) => {
    assertEnabled();
    const parsed = inviteSchema.parse({
      organizationId: formData.get("organizationId"),
      teamId: formData.get("teamId") ?? "",
      ...readIdentity(formData),
      skillIds: formData.getAll("skillIds"),
      languages: formData.getAll("languages"),
    });
    const organization = await requireOrganization(parsed.organizationId);
    const team = parsed.teamId ? await requireTeam(parsed.teamId) : null;
    if (team && team.organizationId !== organization.id) {
      throw new Error("That team belongs to another organisation");
    }
    const languageCodes = await validLanguageCodes(parsed.languages);

    const [account] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${parsed.email}`)
      .limit(1);

    const { memberId, created } = await db.transaction(async (tx) => {
      const identityMatch = account
        ? or(
            eq(organizationMembers.contactEmail, parsed.email),
            eq(organizationMembers.userId, account.id),
          )
        : eq(organizationMembers.contactEmail, parsed.email);
      const [existing] = await tx
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organization.id),
            identityMatch,
          ),
        )
        .limit(1);

      const memberId =
        existing?.id ??
        (await insertMember(tx, {
          organizationId: organization.id,
          userId: account?.id ?? null,
          identity: {
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            contactEmail: parsed.email,
            phone: parsed.phone,
            title: parsed.title,
          },
        }));

      await writeMemberProfile(tx, memberId, {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        phone: parsed.phone,
        title: parsed.title,
        skillIds: parsed.skillIds,
        languageCodes,
      });
      if (team) {
        await tx
          .insert(cityTeamMembers)
          .values({
            teamId: team.id,
            organizationId: organization.id,
            memberId,
          })
          .onConflictDoUpdate({
            target: [cityTeamMembers.teamId, cityTeamMembers.memberId],
            set: { active: true },
          });
      }
      return { memberId, created: !existing };
    });

    if (!account && created) {
      await sendMemberInvitation({
        organizationId: organization.id,
        email: parsed.email,
        memberId,
        invitedById: user.id,
        locale,
        organizationName: organization.name,
        teamName: team?.name,
        inviterName: user.name ?? user.email ?? organization.name,
      });
    }
    await recordAudit({
      action: team ? "team.member_added" : "member.added",
      subjectType: team ? "team" : "member",
      subjectId: team ? team.id : memberId,
      organizationId: organization.id,
      metadata: { memberId, invited: !account && created },
    });
    refresh(locale);
  },
);

/* --------------------------- profile editing ------------------------- */

const profileSchema = z.object({
  memberId: z.string().uuid(),
  firstName: personName,
  lastName: personName,
  phone: phoneNumber,
  title: z.string().trim().min(2).max(160),
  skillIds: z.array(z.string().uuid()).max(40),
  languages: z.array(z.string().min(2).max(35)).max(30),
});

/**
 * Everything a coordinator may correct about a member. The address is not in the
 * form: it is what the invitation was sent to and what an account links itself
 * by, so changing it is re-inviting somebody rather than editing a field.
 */
export const updateMemberProfile = protectedPermissionAction(
  "members.manage",
  async (formData, locale) => {
    assertEnabled();
    const parsed = profileSchema.parse({
      memberId: formData.get("memberId"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      phone: formData.get("phone"),
      title: formData.get("title"),
      skillIds: formData.getAll("skillIds"),
      languages: formData.getAll("languages"),
    });
    const member = await requireMember(parsed.memberId);
    const languageCodes = await validLanguageCodes(parsed.languages);
    await db.transaction(async (tx) => {
      await writeMemberProfile(tx, parsed.memberId, {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        phone: parsed.phone,
        title: parsed.title,
        skillIds: parsed.skillIds,
        languageCodes,
      });
    });
    await recordAudit({
      action: "member.updated",
      subjectType: "member",
      subjectId: parsed.memberId,
      organizationId: member.organizationId,
    });
    refresh(locale);
  },
);

/* ------------------------------- lead -------------------------------- */

const leadSchema = z.object({
  teamId: z.string().uuid(),
  memberId: z.string().uuid(),
  lead: z.enum(["true", "false"]),
});

/** One lead per team: setting a lead clears the previous one. */
export const setTeamLead = protectedPermissionAction(
  "teams.manage",
  async (formData, locale) => {
    assertEnabled();
    const parsed = leadSchema.parse({
      teamId: formData.get("teamId"),
      memberId: formData.get("memberId"),
      lead: formData.get("lead"),
    });
    const team = await requireTeam(parsed.teamId);
    await db.transaction(async (tx) => {
      await tx
        .update(cityTeamMembers)
        .set({ isLead: false })
        .where(
          and(
            eq(cityTeamMembers.teamId, parsed.teamId),
            eq(cityTeamMembers.isLead, true),
          ),
        );
      if (parsed.lead === "true") {
        await tx
          .update(cityTeamMembers)
          .set({ isLead: true })
          .where(
            and(
              eq(cityTeamMembers.teamId, parsed.teamId),
              eq(cityTeamMembers.memberId, parsed.memberId),
              eq(cityTeamMembers.active, true),
            ),
          );
      }
    });
    await recordAudit({
      action: "team.lead_changed",
      subjectType: "team",
      subjectId: parsed.teamId,
      organizationId: team.organizationId,
      metadata: { memberId: parsed.memberId, lead: parsed.lead },
    });
    refresh(locale);
  },
);

/* -------------------------------- move ------------------------------- */

const moveSchema = z.object({
  memberId: z.string().uuid(),
  /** Null is the unassigned column: in the organisation, on no team. */
  teamId: optionalUuid,
  /** Which column the member was picked up from, so the others are left alone. */
  fromTeamId: optionalUuid,
});

/**
 * Move one member between the columns of the team board — out of the unassigned
 * pool onto a team, from one team to another, or back off a team.
 *
 * Only the column the drag started from is left: an association working in two
 * cities may legitimately have somebody on both city teams, and a gesture aimed
 * at one column must not quietly end the other membership.
 */
export const moveMemberToTeam = protectedPermissionAction(
  "teams.manage",
  async (formData, locale) => {
    assertEnabled();
    const parsed = moveSchema.parse({
      memberId: formData.get("memberId"),
      teamId: formData.get("teamId") ?? "",
      fromTeamId: formData.get("fromTeamId") ?? "",
    });
    if (parsed.teamId === parsed.fromTeamId) return;
    const member = await requireMember(parsed.memberId);
    const target = parsed.teamId ? await requireTeam(parsed.teamId) : null;
    if (target && target.organizationId !== member.organizationId) {
      throw new Error("A member cannot join another organisation's team");
    }
    const source = parsed.fromTeamId
      ? await requireTeam(parsed.fromTeamId)
      : null;
    if (source && source.organizationId !== member.organizationId) {
      throw new Error("That team belongs to another organisation");
    }

    await db.transaction(async (tx) => {
      if (source) {
        await tx
          .update(cityTeamMembers)
          .set({ active: false, isLead: false })
          .where(
            and(
              eq(cityTeamMembers.teamId, source.id),
              eq(cityTeamMembers.memberId, parsed.memberId),
            ),
          );
        await deactivateTeamAssignments(tx, parsed.memberId, source.id);
      }
      if (target) {
        await tx
          .insert(cityTeamMembers)
          .values({
            teamId: target.id,
            organizationId: member.organizationId,
            memberId: parsed.memberId,
          })
          .onConflictDoUpdate({
            target: [cityTeamMembers.teamId, cityTeamMembers.memberId],
            /**
             * Leading is a decision about a team, not a property of the person,
             * so it does not travel with them — and reviving a stale lead flag
             * would collide with the team's existing lead.
             */
            set: { active: true, isLead: false },
          });
      }
    });

    await recordAudit({
      action: target ? "team.member_moved" : "team.member_removed",
      subjectType: "member",
      subjectId: parsed.memberId,
      organizationId: member.organizationId,
      metadata: { from: parsed.fromTeamId, to: parsed.teamId },
    });
    refresh(locale);
  },
);

/* --------------------------- resend invite --------------------------- */

const resendSchema = z.object({ memberId: z.string().uuid() });

export const resendMemberInvitation = protectedPermissionAction(
  "members.manage",
  async (formData, locale, user) => {
    assertEnabled();
    const parsed = resendSchema.parse({ memberId: formData.get("memberId") });
    const member = await requireMember(parsed.memberId);
    if (member.status !== "invited" || member.userId) {
      throw new Error("Only pending invitations can be resent");
    }
    /** Names the team in the email when there is one to name. */
    const [team] = await db
      .select({ name: cityTeams.name })
      .from(cityTeamMembers)
      .innerJoin(cityTeams, eq(cityTeamMembers.teamId, cityTeams.id))
      .where(
        and(
          eq(cityTeamMembers.memberId, parsed.memberId),
          eq(cityTeamMembers.active, true),
        ),
      )
      .limit(1);
    await sendMemberInvitation({
      organizationId: member.organizationId,
      email: member.email,
      memberId: member.id,
      invitedById: user.id,
      locale,
      organizationName: member.organizationName,
      teamName: team?.name,
      inviterName: user.name ?? user.email ?? member.organizationName,
    });
    refresh(locale);
  },
);
