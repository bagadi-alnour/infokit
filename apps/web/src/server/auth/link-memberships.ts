import { and, eq, isNull, sql } from "drizzle-orm";

import { env } from "~/env";
import { db } from "~/server/db";
import { invitations, organizationMembers } from "~/server/db/schema";

/**
 * Connect email-first member records when the invited person authenticates.
 * Assignments already point at the stable membership row, so their teams and
 * activities become available without copying or recreating anything. The
 * matching pending invitations are marked accepted at the same moment — a
 * magic-link sign-in already proves ownership of the invited address.
 */
export async function linkPendingMemberships({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  if (!env.ENABLE_PHASE3_MEMBER_ASSIGNMENTS) return;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;
  const linked = await db
    .update(organizationMembers)
    .set({ userId, status: "active" })
    .where(
      and(
        isNull(organizationMembers.userId),
        sql`lower(${organizationMembers.contactEmail}) = ${normalizedEmail}`,
      ),
    )
    .returning({
      id: organizationMembers.id,
      organizationId: organizationMembers.organizationId,
    });
  for (const member of linked) {
    await db
      .update(invitations)
      .set({ acceptedAt: new Date(), acceptedMemberId: member.id })
      .where(
        and(
          eq(invitations.organizationId, member.organizationId),
          sql`lower(${invitations.email}) = ${normalizedEmail}`,
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      );
  }
}
