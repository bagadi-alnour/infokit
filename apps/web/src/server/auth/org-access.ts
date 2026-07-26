import { and, eq, gt, isNull, or } from "drizzle-orm";

import { db } from "~/server/db";
import {
  memberRoles,
  organizationMembers,
  organizations,
  rolePermissions,
  roles,
} from "~/server/db/schema";
import {
  hasActualPlatformPermission,
  organizationPermissionsForUser,
} from "./authorization";

/**
 * Who may edit an organisation, under the claim rule:
 *
 * - Before an organisation is claimed, platform stewards (holders of
 *   `organization.profile.manage` as a platform role) maintain it.
 * - Once claimed (an org steward has linked their account), platform admins
 *   become read-only and the organisation's own members with the permission
 *   maintain its data.
 *
 * Org members always edit their own organisation regardless of claim state;
 * the claim only revokes the *platform admin's* write access.
 */
export interface OrgWriteAccess {
  canWrite: boolean;
  claimed: boolean;
  actor: "organization_member" | "platform_admin" | "none";
}

const MANAGE_PERMISSION = "organization.profile.manage";

export async function organizationWriteAccess(
  userId: string,
  organizationId: string,
): Promise<OrgWriteAccess> {
  const [org] = await db
    .select({ claimedAt: organizations.claimedAt })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const claimed = Boolean(org?.claimedAt);

  const orgPermissions = await organizationPermissionsForUser(
    userId,
    organizationId,
  );
  if (orgPermissions.has(MANAGE_PERMISSION)) {
    return { canWrite: true, claimed, actor: "organization_member" };
  }

  const platformManages = await hasActualPlatformPermission(
    userId,
    MANAGE_PERMISSION,
  );
  if (platformManages) {
    // Platform admins keep write access only until the org claims itself.
    return { canWrite: !claimed, claimed, actor: "platform_admin" };
  }

  return { canWrite: false, claimed, actor: "none" };
}

/**
 * Organisations the signed-in member may maintain from their own workspace —
 * active memberships whose roles grant `organization.profile.manage`.
 */
export async function manageableOrganizationsForUser(
  userId: string,
): Promise<{ id: string; displayName: string; slug: string }[]> {
  const now = new Date();
  const rows = await db
    .selectDistinct({
      id: organizations.id,
      displayName: organizations.displayName,
      slug: organizations.slug,
    })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationMembers.organizationId),
    )
    .innerJoin(memberRoles, eq(memberRoles.memberId, organizationMembers.id))
    .innerJoin(roles, eq(roles.id, memberRoles.roleId))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.status, "active"),
        eq(rolePermissions.permissionCode, MANAGE_PERMISSION),
        or(
          isNull(roles.organizationId),
          eq(roles.organizationId, organizationMembers.organizationId),
        ),
        or(isNull(memberRoles.expiresAt), gt(memberRoles.expiresAt, now)),
      ),
    );
  return rows;
}

/** Throw when the actor may not write to the organisation (claim-aware). */
export async function assertOrganizationWritable(
  userId: string,
  organizationId: string,
): Promise<void> {
  const access = await organizationWriteAccess(userId, organizationId);
  if (!access.canWrite) {
    throw new Error(
      access.claimed
        ? "This organisation is maintained by its own members and is read-only here."
        : "You do not have permission to edit this organisation.",
    );
  }
}
