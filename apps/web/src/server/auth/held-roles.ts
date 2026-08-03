import { and, asc, eq, gt, isNull, or } from "drizzle-orm";

import { db } from "~/server/db";
import {
  memberRoles,
  organizationMembers,
  organizations,
  roles,
  userPlatformRoles,
} from "~/server/db/schema";

/**
 * The roles one account holds, for saying so on screen.
 *
 * Read for display only. Nothing gates on this: a gate asks
 * `authorizationFor(userId, organizationId)` about a *permission*, because a
 * role is a bundle whose contents are rows and can change, and because an
 * organisation's roles only count inside that organisation. Answering "may I"
 * from a role name would be reading the label instead of the grant.
 *
 * Both kinds are returned together and the reader is told which is which:
 * platform roles reach everywhere, an organisation role reaches one association,
 * and somebody looking at their own header should not have to guess which.
 *
 * Expired and ended grants are excluded on the same terms the organisation
 * picker uses (`organizationMembershipChoices`) — a role that no longer opens
 * anything must not still be printed under somebody's name.
 */
export interface HeldRole {
  code: string;
  /** Null for a platform role; the association's name otherwise. */
  organizationName: string | null;
}

export async function heldRoles(userId: string): Promise<HeldRole[]> {
  const now = new Date();
  const [platform, organization] = await Promise.all([
    db
      .selectDistinct({ code: roles.code })
      .from(userPlatformRoles)
      .innerJoin(roles, eq(roles.id, userPlatformRoles.roleId))
      .where(
        and(
          eq(userPlatformRoles.userId, userId),
          isNull(roles.organizationId),
          or(
            isNull(userPlatformRoles.expiresAt),
            gt(userPlatformRoles.expiresAt, now),
          ),
        ),
      )
      .orderBy(asc(roles.code)),
    db
      .selectDistinct({
        code: roles.code,
        organizationName: organizations.displayName,
      })
      .from(organizationMembers)
      .innerJoin(memberRoles, eq(memberRoles.memberId, organizationMembers.id))
      .innerJoin(roles, eq(roles.id, memberRoles.roleId))
      .innerJoin(
        organizations,
        eq(organizations.id, organizationMembers.organizationId),
      )
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.status, "active"),
          or(isNull(memberRoles.expiresAt), gt(memberRoles.expiresAt, now)),
          // A role template shared across associations has no organisation of
          // its own; one written for a single association names it. Both are
          // reachable through a membership, so both count here.
          or(
            isNull(roles.organizationId),
            eq(roles.organizationId, organizationMembers.organizationId),
          ),
        ),
      )
      .orderBy(asc(roles.code)),
  ]);

  const seen = new Set<string>();
  const held: HeldRole[] = [];
  for (const row of platform) {
    if (seen.has(row.code)) continue;
    seen.add(row.code);
    held.push({ code: row.code, organizationName: null });
  }
  for (const row of organization) {
    // A code already held at platform level is not repeated: the platform grant
    // is the wider of the two, so the narrower line would add nothing.
    if (seen.has(row.code)) continue;
    seen.add(row.code);
    held.push({ code: row.code, organizationName: row.organizationName });
  }
  return held;
}
