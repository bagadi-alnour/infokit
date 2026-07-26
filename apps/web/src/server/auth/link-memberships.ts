import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";

import { env } from "~/env";
import { db } from "~/server/db";
import {
  invitationRoles,
  invitations,
  memberRoles,
  organizationMembers,
  organizations,
  rolePermissions,
} from "~/server/db/schema";

/** Permission that marks a member as able to steward the whole organisation. */
const ORG_STEWARD_PERMISSION = "organization.profile.manage";

/**
 * Mark an organisation claimed the first time one of its stewards links an
 * account. After this, platform admins are read-only for the organisation and
 * its own members maintain its data.
 */
export async function claimOrganizationIfSteward(
  memberId: string,
  organizationId: string,
) {
  const [steward] = await db
    .select({ permissionCode: rolePermissions.permissionCode })
    .from(memberRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, memberRoles.roleId))
    .where(
      and(
        eq(memberRoles.memberId, memberId),
        eq(rolePermissions.permissionCode, ORG_STEWARD_PERMISSION),
      ),
    )
    .limit(1);
  if (!steward) return;
  await db
    .update(organizations)
    .set({ claimedAt: new Date() })
    .where(
      and(
        eq(organizations.id, organizationId),
        isNull(organizations.claimedAt),
      ),
    );
}

/**
 * Grant the roles an accepted invitation promised. The roles ride on the
 * invitation rather than on the reserved membership, so an invitation that is
 * revoked or left to expire never becomes access
 * (docs/PHASE-1.3-COLLABORATION.md Flow 1).
 */
async function grantInvitedRoles(memberId: string, invitationIds: string[]) {
  if (invitationIds.length === 0) return;
  const granted = await db
    .select({ roleId: invitationRoles.roleId })
    .from(invitationRoles)
    .where(inArray(invitationRoles.invitationId, invitationIds));
  if (granted.length === 0) return;
  await db
    .insert(memberRoles)
    .values(granted.map(({ roleId }) => ({ memberId, roleId })))
    .onConflictDoNothing();
}

/**
 * Connect email-first member records when the invited person authenticates.
 * Assignments already point at the stable membership row, so their teams and
 * activities become available without copying or recreating anything. The
 * matching pending invitations are marked accepted at the same moment — a
 * magic-link sign-in already proves ownership of the invited address — and the
 * roles they carry are granted then, never before.
 *
 * An invitation is its own reason to link: an organisation representative
 * invited by a platform operator is Phase 1.3 work and must not wait on the
 * Phase 3 flag, which only governs email-first memberships created by team
 * management.
 */
export async function linkPendingMemberships({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;
  const now = new Date();

  const invitedEmail = and(
    sql`lower(${invitations.email}) = ${normalizedEmail}`,
    isNull(invitations.acceptedAt),
    isNull(invitations.revokedAt),
    gt(invitations.expiresAt, now),
  );
  const pending = await db
    .selectDistinct({ organizationId: invitations.organizationId })
    .from(invitations)
    .where(invitedEmail);
  const invitedOrganizationIds = pending.map((row) => row.organizationId);
  const teamManagement = env.ENABLE_PHASE3_MEMBER_ASSIGNMENTS;
  if (!teamManagement && invitedOrganizationIds.length === 0) return;

  const linked = await db
    .update(organizationMembers)
    .set({ userId, status: "active" })
    .where(
      and(
        isNull(organizationMembers.userId),
        sql`lower(${organizationMembers.contactEmail}) = ${normalizedEmail}`,
        teamManagement
          ? undefined
          : inArray(organizationMembers.organizationId, invitedOrganizationIds),
      ),
    )
    .returning({
      id: organizationMembers.id,
      organizationId: organizationMembers.organizationId,
    });
  for (const member of linked) {
    const accepted = await db
      .update(invitations)
      .set({ acceptedAt: now, acceptedMemberId: member.id })
      .where(
        and(
          eq(invitations.organizationId, member.organizationId),
          invitedEmail,
        ),
      )
      .returning({ id: invitations.id });
    await grantInvitedRoles(
      member.id,
      accepted.map((row) => row.id),
    );
    await claimOrganizationIfSteward(member.id, member.organizationId);
  }
}
