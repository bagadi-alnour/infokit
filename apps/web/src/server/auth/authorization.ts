import { and, asc, eq, gt, inArray, isNull, or, type SQL } from "drizzle-orm";

import { db } from "~/server/db";
import {
  organizationMembers,
  organizations,
  memberRoles,
  rolePermissions,
  roles,
  userPlatformRoles,
} from "~/server/db/schema";
// Named only to spell `OwnerColumn`; the queries that use these tables live in
// the pages, not here.
import type { activities, editorialCustodianships } from "~/server/db/schema";

export const superadminPermission = "support.superadmin";

/**
 * The grant that opens the staff page. Platform roles are the widest thing the
 * system hands out — a content manager publishes for every association — so who
 * may hand them out is itself a permission, held by the superadmin alone
 * (server/db/seed.ts).
 *
 * It lives here rather than beside the actions it gates because the sidebar has
 * to ask the same question, and a `"use server"` module may export nothing but
 * async functions.
 */
export const platformStaffPermission = "platform.staff.manage";

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

/**
 * Grants only the platform's own roles carry (server/db/seed.ts). Organisation
 * roles can hold `organization.profile.manage` too, but for their own record
 * only — `platformPermissionsForUser` reads platform-scoped roles alone, so
 * asking it for these codes answers "is this a platform administrator?".
 */
export const platformAdminPermissions = [
  superadminPermission,
  "organization.verify",
  "organization.profile.manage",
] as const;

/**
 * Whether the actor administers the platform itself. The organisation
 * directory is theirs: an association's own members see their record, not the
 * list of every association (docs/PRODUCT.md §11.3).
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const actual = await platformPermissionsForUser(userId);
  return platformAdminPermissions.some((code) => actual.has(code));
}

/** One association a reader may work in, named for a picker. */
export interface OrganizationChoice {
  id: string;
  name: string;
}

/**
 * The associations a reader may switch between on a page that works one
 * association at a time, and which of them it opens on.
 *
 * This list *is* that page's tenant security, in two ways. A picker built from
 * `select … from organizations` hands every association's name to anybody who
 * can reach the URL; and a scope id read straight out of `?org=` hands them the
 * rows underneath it. So the choices are what the reader administers — every
 * association for platform staff, their own active memberships otherwise — and
 * the requested id is honoured only if it is one of them. An id from outside is
 * dropped rather than refused, the way the audit trail drops one: the query
 * string is a convenience, and the list above it is the guarantee.
 */
export async function organizationChoices(
  userId: string,
  requested?: string,
): Promise<{ choices: OrganizationChoice[]; selectedId: string | null }> {
  const columns = { id: organizations.id, name: organizations.displayName };
  const choices = (await isPlatformAdmin(userId))
    ? await db
        .select(columns)
        .from(organizations)
        .orderBy(asc(organizations.displayName))
    : await db
        .select(columns)
        .from(organizationMembers)
        .innerJoin(
          organizations,
          eq(organizations.id, organizationMembers.organizationId),
        )
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.status, "active"),
          ),
        )
        .orderBy(asc(organizations.displayName));
  const selectedId =
    choices.find((choice) => choice.id === requested)?.id ??
    choices[0]?.id ??
    null;
  return { choices, selectedId };
}

export async function organizationPermissionsForUser(
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

/**
 * What one account may do, as itself.
 *
 * Platform grants always count. An organisation's grants count only for the
 * organisation named, which is why the caller has to name it: a permission held
 * inside one association says nothing about another, and a resolver that
 * quietly unioned every membership would turn "may edit my own record" into
 * "may edit anybody's".
 */
export async function authorizationFor(
  userId: string,
  organizationId?: string,
) {
  const platformPermissions = await platformPermissionsForUser(userId);
  const effectivePermissions = new Set(platformPermissions);
  if (organizationId) {
    const organizationPermissions = await organizationPermissionsForUser(
      userId,
      organizationId,
    );
    for (const code of organizationPermissions) effectivePermissions.add(code);
  }
  return {
    isSuperadmin: platformPermissions.has(superadminPermission),
    effectivePermissions,
  };
}

/**
 * Whose rows one account may see through a permission that is granted per
 * organisation.
 *
 * `platform` is all of them, including the rows that belong to no organisation
 * at all; otherwise it is the listed organisations and no others, which a query
 * expresses as `organization_id in (…)` and which therefore excludes everybody
 * else by construction rather than by a filter somebody has to remember. The
 * list is never empty: no access at all is `null` from `permissionScope`, so a
 * caller cannot read "nothing" as "everything".
 */
export interface PermissionScope {
  platform: boolean;
  organizationIds: readonly string[];
}

const PLATFORM_SCOPE: PermissionScope = { platform: true, organizationIds: [] };

/**
 * The organisations where this account holds the permission through an active
 * membership. Expired grants and offboarded memberships carry nothing, and an
 * organisation's own role template only counts inside that organisation.
 */
export async function organizationsGrantingPermission(
  userId: string,
  permissionCode: string,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .innerJoin(memberRoles, eq(memberRoles.memberId, organizationMembers.id))
    .innerJoin(roles, eq(roles.id, memberRoles.roleId))
    .innerJoin(
      rolePermissions,
      and(
        eq(rolePermissions.roleId, roles.id),
        eq(rolePermissions.permissionCode, permissionCode),
      ),
    )
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.status, "active"),
        or(
          isNull(roles.organizationId),
          eq(roles.organizationId, organizationMembers.organizationId),
        ),
        or(
          isNull(memberRoles.expiresAt),
          gt(memberRoles.expiresAt, new Date()),
        ),
      ),
    );
  return rows.map((row) => row.organizationId);
}

/**
 * What one account may see of a per-organisation permission's data, or `null`
 * when the answer is nothing and the page should refuse.
 *
 * Read in one order, deliberately: the platform's own grants, then memberships.
 *
 * Support access is platform-wide even where the superadmin's role does not
 * carry the permission itself: `support.superadmin` can read any organisation's
 * context by design, so a scope that pretended otherwise would be a narrow rule
 * with a way around it rather than a limit. The audit trail is what makes that
 * honest — every such read is attributed.
 */
export async function permissionScope(
  userId: string,
  permissionCode: string,
): Promise<PermissionScope | null> {
  return permissionScopeAny(userId, [permissionCode]);
}

/**
 * The same question for a workspace that one permission does not describe.
 *
 * A list is opened by everybody who works on the thing it lists, and the roles
 * split that work up: `organization_verifier` holds `content.activity.verify`
 * and nothing else, `organization_author` holds `content.article.write` and
 * nothing else. Asking for a single code would refuse the page to the role whose
 * whole job is on it, so the caller names every grant that legitimately opens the
 * list and gets the union — which is still a scope, and still `null` when the
 * answer is none of them.
 */
export async function permissionScopeAny(
  userId: string,
  permissionCodes: readonly string[],
): Promise<PermissionScope | null> {
  const platformPermissions = await platformPermissionsForUser(userId);
  if (
    platformPermissions.has(superadminPermission) ||
    permissionCodes.some((code) => platformPermissions.has(code))
  ) {
    return PLATFORM_SCOPE;
  }

  const granted = await Promise.all(
    permissionCodes.map((code) =>
      organizationsGrantingPermission(userId, code),
    ),
  );
  const organizationIds = [...new Set(granted.flat())];
  return organizationIds.length > 0
    ? { platform: false, organizationIds }
    : null;
}

/**
 * The grants that legitimately open the activities workspace.
 *
 * They live here, not in the page, because two callers have to agree about them:
 * the page decides who gets in and which rows they see, and the sidebar decides
 * whether the entry is drawn at all. A link that answers "permission denied"
 * teaches nothing except that the sidebar is not to be trusted, and two copies of
 * a tuple drift.
 *
 * `organization_verifier` carries only the second code, so both have to count or
 * the role whose whole job is on that page cannot reach it (server/db/seed.ts).
 */
export const activityWorkspacePermissions = [
  "content.activity.manage",
  "content.activity.verify",
] as const;

/**
 * The same for the newsroom: an author writes, a publisher publishes, a reviewer
 * reviews — three roles that each carry one of these and no others, and all
 * three need the list.
 */
export const articleWorkspacePermissions = [
  "content.article.write",
  "content.article.publish",
  "content.article.review",
] as const;

/**
 * The owner column of a workspace list, spelled as a union of the actual columns
 * rather than as a loose `AnyPgColumn`. A fourth list would have to name its
 * column here to be filtered, which is the point: a list nobody remembered to
 * scope shows every association's work to whoever opens the page.
 */
type OwnerColumn =
  | typeof activities.organizationId
  | typeof editorialCustodianships.organizationId;

/**
 * The `where` clause that keeps a workspace list inside what its reader
 * administers: nothing extra for platform staff, `organization_id in (…)` for
 * everybody else.
 *
 * `undefined` means "no restriction", which is only ever returned for
 * `scope.platform` — a scope of nothing at all is `null` from `permissionScope`
 * and the page refuses before reaching here, so the absent condition can never
 * stand for absent access. Rows whose owner is null are the platform's own, and
 * `in (…)` excludes them from an association's list by SQL's own null rules
 * rather than by a second clause somebody has to remember.
 */
export function ownedWithin(
  column: OwnerColumn,
  scope: PermissionScope,
): SQL | undefined {
  if (scope.platform) return undefined;
  return inArray(column, [...scope.organizationIds]);
}
