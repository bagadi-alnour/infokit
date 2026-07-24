import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";

import { db } from "~/server/db";
import {
  organizations,
  organizationMembers,
  memberRoles,
  rolePermissions,
  roles,
  roleTestContextRoles,
  roleTestContexts,
  userPlatformRoles,
} from "~/server/db/schema";
import { currentSessionTokenHash } from "./session-token";

export const superadminPermission = "support.superadmin";

export async function platformPermissionsForUser(
  userId: string,
): Promise<Set<string>> {
  const now = new Date();
  const rows = await db
    .select({ code: rolePermissions.permissionCode })
    .from(userPlatformRoles)
    .innerJoin(roles, eq(roles.id, userPlatformRoles.roleId))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(
      and(
        eq(userPlatformRoles.userId, userId),
        isNull(roles.organizationId),
        or(
          isNull(userPlatformRoles.expiresAt),
          gt(userPlatformRoles.expiresAt, now),
        ),
      ),
    );
  return new Set(rows.map(({ code }) => code));
}

export async function hasActualPlatformPermission(
  userId: string,
  permissionCode: string,
): Promise<boolean> {
  return (await platformPermissionsForUser(userId)).has(permissionCode);
}

async function organizationPermissionsForUser(
  userId: string,
  organizationId: string,
): Promise<Set<string>> {
  const now = new Date();
  const rows = await db
    .select({ code: rolePermissions.permissionCode })
    .from(organizationMembers)
    .innerJoin(memberRoles, eq(memberRoles.memberId, organizationMembers.id))
    .innerJoin(roles, eq(roles.id, memberRoles.roleId))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, "active"),
        or(
          isNull(roles.organizationId),
          eq(roles.organizationId, organizationId),
        ),
        or(isNull(memberRoles.expiresAt), gt(memberRoles.expiresAt, now)),
      ),
    );
  return new Set(rows.map(({ code }) => code));
}

export async function getRoleTestState(
  userId: string,
  organizationId?: string,
) {
  const actualPermissions = await platformPermissionsForUser(userId);
  const isSuperadmin = actualPermissions.has(superadminPermission);
  const sessionToken = await currentSessionTokenHash();
  if (!isSuperadmin || !sessionToken) {
    if (organizationId) {
      const organizationPermissions = await organizationPermissionsForUser(
        userId,
        organizationId,
      );
      for (const code of organizationPermissions) actualPermissions.add(code);
    }
    return {
      isSuperadmin,
      assumedRole: null,
      assumedRoles: [],
      assumedOrganizationId: null,
      assumedOrganizationName: null,
      effectivePermissions: actualPermissions,
    };
  }

  const [context] = await db
    .select({
      actorUserId: roleTestContexts.actorUserId,
      roleId: roles.id,
      roleCode: roles.code,
      organizationId: roleTestContexts.organizationId,
      organizationName: organizations.displayName,
    })
    .from(roleTestContexts)
    .innerJoin(roles, eq(roles.id, roleTestContexts.roleId))
    .leftJoin(
      organizations,
      eq(organizations.id, roleTestContexts.organizationId),
    )
    .where(eq(roleTestContexts.sessionToken, sessionToken))
    .limit(1);

  if (context?.actorUserId !== userId) {
    return {
      isSuperadmin,
      assumedRole: null,
      assumedRoles: [],
      assumedOrganizationId: null,
      assumedOrganizationName: null,
      effectivePermissions: actualPermissions,
    };
  }

  const selectedRoleRows = await db
    .select({ roleId: roles.id, roleCode: roles.code })
    .from(roleTestContextRoles)
    .innerJoin(roles, eq(roles.id, roleTestContextRoles.roleId))
    .where(eq(roleTestContextRoles.sessionToken, sessionToken));
  const assumedRoles =
    selectedRoleRows.length > 0
      ? selectedRoleRows
      : [{ roleId: context.roleId, roleCode: context.roleCode }];
  const grants = await db
    .select({ code: rolePermissions.permissionCode })
    .from(rolePermissions)
    .where(
      inArray(
        rolePermissions.roleId,
        assumedRoles.map((role) => role.roleId),
      ),
    );
  return {
    isSuperadmin,
    assumedRole: context,
    assumedRoles,
    assumedOrganizationId: context.organizationId,
    assumedOrganizationName: context.organizationName,
    effectivePermissions: new Set(grants.map(({ code }) => code)),
  };
}
