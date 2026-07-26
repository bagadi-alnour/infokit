"use server";

import type { Locale } from "@infokit/shared/i18n";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { env } from "~/env";
import { localizedPath } from "~/i18n/routing";
import { recordAudit } from "~/server/audit";
import { auth } from "~/server/auth";
import { protectedPermissionAction } from "~/server/auth/require";
import { db } from "~/server/db";
import { sendMemberInvitation } from "~/server/invitations";
import {
  parseSkills,
  replaceMemberProfileFacets,
  validLanguageCodes,
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

const optional = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value));

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

/* ------------------------------- create ------------------------------ */

const createTeamSchema = z.object({
  organizationId: z.string().uuid(),
  cityId: z.string().uuid(),
  name: optional,
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
    const [organization] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, parsed.organizationId));
    if (!organization) throw new Error("Unknown organisation");

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

const inviteSchema = z.object({
  teamId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
  displayName: optional,
  title: optional,
  skills: optional,
  languages: z.array(z.string().min(2).max(35)).max(30),
});

/**
 * Add a person to the team by email, without an activity assignment. If no
 * account exists yet, the membership is reserved and an email invitation to
 * join is sent immediately.
 */
export const inviteTeamMember = protectedPermissionAction(
  "members.manage",
  async (formData, locale) => {
    assertEnabled();
    const parsed = inviteSchema.parse({
      teamId: formData.get("teamId"),
      email: formData.get("email"),
      displayName: formData.get("displayName") ?? "",
      title: formData.get("title") ?? "",
      skills: formData.get("skills") ?? "",
      languages: formData.getAll("languages"),
    });
    const team = await requireTeam(parsed.teamId);
    const skills = parseSkills(parsed.skills);
    const languageCodes = await validLanguageCodes(parsed.languages);

    const [account] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(sql`lower(${users.email}) = ${parsed.email}`)
      .limit(1);

    const { member, created } = await db.transaction(async (tx) => {
      const identityMatch = account
        ? or(
            eq(organizationMembers.contactEmail, parsed.email),
            eq(organizationMembers.userId, account.id),
          )
        : eq(organizationMembers.contactEmail, parsed.email);
      let created = false;
      let [existing] = await tx
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, team.organizationId),
            identityMatch,
          ),
        )
        .limit(1);

      if (!existing) {
        created = true;
        [existing] = await tx
          .insert(organizationMembers)
          .values({
            organizationId: team.organizationId,
            userId: account?.id ?? null,
            displayName:
              parsed.displayName ??
              account?.name ??
              parsed.email.split("@")[0] ??
              parsed.email,
            contactEmail: parsed.email,
            status: account ? "active" : "invited",
          })
          .returning({ id: organizationMembers.id });
      } else if (parsed.displayName) {
        await tx
          .update(organizationMembers)
          .set({ displayName: parsed.displayName })
          .where(eq(organizationMembers.id, existing.id));
      }
      if (!existing) throw new Error("Member insert returned no row");

      await replaceMemberProfileFacets(tx, existing.id, {
        title: parsed.title,
        skills,
        languageCodes,
      });
      await tx
        .insert(cityTeamMembers)
        .values({
          teamId: team.id,
          organizationId: team.organizationId,
          memberId: existing.id,
        })
        .onConflictDoUpdate({
          target: [cityTeamMembers.teamId, cityTeamMembers.memberId],
          set: { active: true },
        });
      return { member: existing, created };
    });

    if (!account && created) {
      const session = await auth();
      await sendMemberInvitation({
        organizationId: team.organizationId,
        email: parsed.email,
        memberId: member.id,
        invitedById: session?.user.id ?? null,
        locale,
        organizationName: team.organizationName,
        teamName: team.name,
        inviterName: session?.user.name ?? session?.user.email ?? team.name,
      });
    }
    await recordAudit({
      action: "team.member_added",
      subjectType: "team",
      subjectId: team.id,
      organizationId: team.organizationId,
      metadata: { memberId: member.id, invited: !account && created },
    });
    refresh(locale);
  },
);

/* --------------------------- profile editing ------------------------- */

const profileSchema = z.object({
  memberId: z.string().uuid(),
  displayName: z.string().trim().min(2).max(200),
  title: optional,
  skills: optional,
  languages: z.array(z.string().min(2).max(35)).max(30),
});

export const updateMemberProfile = protectedPermissionAction(
  "members.manage",
  async (formData, locale) => {
    assertEnabled();
    const parsed = profileSchema.parse({
      memberId: formData.get("memberId"),
      displayName: formData.get("displayName"),
      title: formData.get("title") ?? "",
      skills: formData.get("skills") ?? "",
      languages: formData.getAll("languages"),
    });
    const [member] = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.id, parsed.memberId));
    if (!member) throw new Error("Unknown member");

    const skills = parseSkills(parsed.skills);
    const languageCodes = await validLanguageCodes(parsed.languages);
    await db.transaction(async (tx) => {
      await tx
        .update(organizationMembers)
        .set({ displayName: parsed.displayName })
        .where(eq(organizationMembers.id, parsed.memberId));
      await replaceMemberProfileFacets(tx, parsed.memberId, {
        title: parsed.title,
        skills,
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
        .set({ isLead: false, updatedAt: new Date() })
        .where(
          and(
            eq(cityTeamMembers.teamId, parsed.teamId),
            eq(cityTeamMembers.isLead, true),
          ),
        );
      if (parsed.lead === "true") {
        await tx
          .update(cityTeamMembers)
          .set({ isLead: true, updatedAt: new Date() })
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

/* ------------------------------ removal ------------------------------ */

const removalSchema = z.object({
  teamId: z.string().uuid(),
  memberId: z.string().uuid(),
});

/**
 * Remove from the team and deactivate the member's assignments on this
 * team's activities. The membership record and its history stay intact.
 */
export const removeTeamMember = protectedPermissionAction(
  "teams.manage",
  async (formData, locale) => {
    assertEnabled();
    const parsed = removalSchema.parse({
      teamId: formData.get("teamId"),
      memberId: formData.get("memberId"),
    });
    const team = await requireTeam(parsed.teamId);
    await db.transaction(async (tx) => {
      await tx
        .update(cityTeamMembers)
        .set({ active: false, isLead: false, updatedAt: new Date() })
        .where(
          and(
            eq(cityTeamMembers.teamId, parsed.teamId),
            eq(cityTeamMembers.memberId, parsed.memberId),
          ),
        );
      const teamActivities = await tx
        .select({ id: activities.id })
        .from(activities)
        .where(eq(activities.teamId, parsed.teamId));
      if (teamActivities.length > 0) {
        await tx
          .update(activityMemberAssignments)
          .set({ active: false, updatedAt: new Date() })
          .where(
            and(
              eq(activityMemberAssignments.memberId, parsed.memberId),
              inArray(
                activityMemberAssignments.activityId,
                teamActivities.map((activity) => activity.id),
              ),
            ),
          );
      }
    });
    await recordAudit({
      action: "team.member_removed",
      subjectType: "team",
      subjectId: parsed.teamId,
      organizationId: team.organizationId,
      metadata: { memberId: parsed.memberId },
    });
    refresh(locale);
  },
);

/* --------------------------- resend invite --------------------------- */

const resendSchema = z.object({
  teamId: z.string().uuid(),
  memberId: z.string().uuid(),
});

export const resendMemberInvitation = protectedPermissionAction(
  "members.manage",
  async (formData, locale) => {
    assertEnabled();
    const parsed = resendSchema.parse({
      teamId: formData.get("teamId"),
      memberId: formData.get("memberId"),
    });
    const team = await requireTeam(parsed.teamId);
    const [member] = await db
      .select({
        id: organizationMembers.id,
        email: organizationMembers.contactEmail,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.id, parsed.memberId),
          eq(organizationMembers.organizationId, team.organizationId),
          eq(organizationMembers.status, "invited"),
          isNull(organizationMembers.userId),
        ),
      );
    if (!member?.email) {
      throw new Error("Only pending invitations can be resent");
    }
    const session = await auth();
    await sendMemberInvitation({
      organizationId: team.organizationId,
      email: member.email,
      memberId: member.id,
      invitedById: session?.user.id ?? null,
      locale,
      organizationName: team.organizationName,
      teamName: team.name,
      inviterName: session?.user.name ?? session?.user.email ?? team.name,
    });
    refresh(locale);
  },
);
