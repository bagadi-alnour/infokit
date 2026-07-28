import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type { StewardCandidate } from "~/lib/steward-contact";
import { db } from "~/server/db";
import { organizationMembers, users } from "~/server/db/schema";

/**
 * The people an editor may name as the contact for one of their organisation's
 * records.
 *
 * Invited members count, not only active ones: somebody who has not linked an
 * account yet is still the person who knows when the day centre opens. Anybody
 * offboarded is left out — a contact nobody answers for is worse than none.
 *
 * Returns nothing for a record the platform holds itself: there is no
 * organisation whose members could be offered, and the fields stay free text.
 */
export async function loadStewardCandidates(
  organizationId: string | null | undefined,
): Promise<StewardCandidate[]> {
  if (!organizationId) return [];
  const rows = await db
    .select({
      id: organizationMembers.id,
      displayName: organizationMembers.displayName,
      contactEmail: organizationMembers.contactEmail,
      title: organizationMembers.title,
      accountName: users.name,
      accountEmail: users.email,
    })
    .from(organizationMembers)
    .leftJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        inArray(organizationMembers.status, ["invited", "active"]),
        isNull(organizationMembers.offboardedAt),
      ),
    )
    .orderBy(asc(organizationMembers.displayName));
  return rows
    .map((row) => ({
      id: row.id,
      // The membership's own name first: it is what this organisation calls
      // them, which is the name a colleague will recognise.
      name: row.displayName.trim() || (row.accountName ?? "").trim(),
      email: row.contactEmail ?? row.accountEmail ?? null,
      title: row.title,
    }))
    .filter((candidate) => candidate.name.length > 0);
}
