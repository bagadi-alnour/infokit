import { and, eq, gt, isNull, or, sql } from "drizzle-orm";

import { db } from "~/server/db";
import {
  invitations,
  organizationMembers,
  translators,
  userPlatformRoles,
  users,
} from "~/server/db/schema";

/**
 * Whether this address is allowed to hold a session at all.
 *
 * There is no public signup anywhere in the product: every person arrives
 * because somebody already recorded them — as platform staff, as an
 * organisation's member, as a translator in the directory, or as a live
 * invitation to become one of those. So the database already knows who may
 * sign in, and asking it is what lets an administrator invite a colleague and
 * assign their roles without anyone editing deployment configuration. The very
 * first account is no exception: `seedBootstrapSuperadmin` writes its platform
 * grant, which is the row this function then finds.
 *
 * Eligibility is not authorization: it only decides whether a session may
 * exist. What the person may then read or write is still `requirePermission`,
 * and the SMS step-up still applies on top (`secondFactorRequired`).
 *
 * Sign-in and password recovery deliberately distinguish an address with no
 * account, so a person can correct it without losing the rest of the form.
 */
export async function canSignIn(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;

  const now = new Date();
  const matchesUser = sql`lower(btrim(${users.email})) = ${normalizedEmail}`;

  const [platformStaff] = await db
    .select({ userId: userPlatformRoles.userId })
    .from(userPlatformRoles)
    .innerJoin(users, eq(users.id, userPlatformRoles.userId))
    .where(
      and(
        matchesUser,
        or(
          isNull(userPlatformRoles.expiresAt),
          gt(userPlatformRoles.expiresAt, now),
        ),
      ),
    )
    .limit(1);
  if (platformStaff) return true;

  // Either the address a member was invited under, or the account already
  // linked to that membership.
  const [member] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .leftJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      or(
        sql`lower(btrim(${organizationMembers.contactEmail})) = ${normalizedEmail}`,
        matchesUser,
      ),
    )
    .limit(1);
  if (member) return true;

  const [translator] = await db
    .select({ id: translators.id })
    .from(translators)
    .where(eq(translators.contactEmail, normalizedEmail))
    .limit(1);
  if (translator) return true;

  const [invitation] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        sql`lower(${invitations.email}) = ${normalizedEmail}`,
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, now),
      ),
    )
    .limit(1);
  return Boolean(invitation);
}
