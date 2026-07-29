import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { memberFullName } from "~/lib/member-name";
import type { StewardCandidate } from "~/lib/steward-contact";
import { db } from "~/server/db";
import { organizationMembers, users } from "~/server/db/schema";

/**
 * The people an editor may name as the contact for a record: the custodian
 * organisation's own roster, and whoever entered the record.
 *
 * Invited members count, not only active ones: somebody who has not linked an
 * account yet is still the person who knows when the day centre opens. Anybody
 * offboarded is left out — a contact nobody answers for is worse than none.
 *
 * The author is offered last and only when the roster does not already carry
 * them, because a record the platform holds itself has no organisation whose
 * members could be listed. Without them the panel offers nobody at all on
 * exactly the records the platform writes most, and the editor retypes a name
 * and an address the platform already knows.
 */
export async function loadStewardCandidates(record: {
  /** The custodian organisation, when the record has one. */
  organizationId?: string | null;
  /**
   * Whoever entered the record — `created_by_id`, or for an editorial entry the
   * author of its first revision.
   */
  authorId?: string | null;
}): Promise<StewardCandidate[]> {
  const memberRows = await loadMemberRows(record.organizationId);
  // Every field below is required of a membership, so there is no fallback to
  // the login account: the name and address this organisation holds are the
  // ones a colleague will recognise, account or no account.
  const candidates: StewardCandidate[] = memberRows.map((row) => ({
    id: row.id,
    name: memberFullName(row),
    email: row.contactEmail,
    phone: row.phone,
    title: row.title,
    source: "member",
  }));

  const authorId = record.authorId;
  if (!authorId) return candidates;
  // The roster row wins when it is the same person: it carries the number and
  // the function the organisation holds for them, which an account cannot.
  if (memberRows.some((row) => row.userId === authorId)) return candidates;

  const [account] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, authorId))
    .limit(1);
  if (!account) return candidates;
  return [
    ...candidates,
    {
      id: account.id,
      // An account may never have been given a name; its address still reaches
      // the person, and naming them by it beats offering a blank row.
      name: account.name ?? account.email,
      email: account.email,
      // An account holds no phone number, by design: numbers live on a roster
      // entry, where they belong to an organisation rather than to a login.
      phone: "",
      title: "",
      source: "author",
    },
  ];
}

async function loadMemberRows(organizationId: string | null | undefined) {
  if (!organizationId) return [];
  return db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      firstName: organizationMembers.firstName,
      lastName: organizationMembers.lastName,
      contactEmail: organizationMembers.contactEmail,
      phone: organizationMembers.phone,
      title: organizationMembers.title,
    })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        inArray(organizationMembers.status, ["invited", "active"]),
        isNull(organizationMembers.offboardedAt),
      ),
    )
    .orderBy(
      asc(organizationMembers.lastName),
      asc(organizationMembers.firstName),
    );
}
