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
  const memberRows = await loadMemberRows(
    record.organizationId ? [record.organizationId] : [],
  );
  const author = await loadAuthor(record.authorId);
  return withAuthor(memberRows, author);
}

/**
 * The same candidates for every organisation a record could be filed under, so
 * a form where the custodian is still being chosen can answer without going
 * back to the server. Keyed by organisation id, plus `""` for the record the
 * platform holds itself — which has no roster, only its author.
 *
 * One query for every roster rather than one per organisation: the caller is a
 * page that already knows which hosts it may offer, and a platform steward may
 * host for any of them.
 */
export async function loadStewardCandidatesByOrganization({
  organizationIds,
  authorId,
}: {
  organizationIds: readonly string[];
  authorId?: string | null;
}): Promise<Record<string, StewardCandidate[]>> {
  const ids = [...new Set(organizationIds)].filter((id) => id !== "");
  const [memberRows, author] = await Promise.all([
    loadMemberRows(ids),
    loadAuthor(authorId),
  ]);

  const byOrganization: Record<string, StewardCandidate[]> = {
    // The platform-hosted case: nobody but whoever is writing the record.
    "": withAuthor([], author),
  };
  for (const id of ids) {
    byOrganization[id] = withAuthor(
      memberRows.filter((row) => row.organizationId === id),
      author,
    );
  }
  return byOrganization;
}

type MemberRow = Awaited<ReturnType<typeof loadMemberRows>>[number];

/**
 * The roster as candidates, with the author appended unless one of the roster
 * entries is already them: that row carries the number and the function the
 * organisation holds for them, which an account cannot.
 */
function withAuthor(
  memberRows: readonly MemberRow[],
  author: StewardCandidate | null,
): StewardCandidate[] {
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
  if (!author) return candidates;
  if (memberRows.some((row) => row.userId === author.id)) return candidates;
  return [...candidates, author];
}

async function loadAuthor(
  authorId: string | null | undefined,
): Promise<StewardCandidate | null> {
  if (!authorId) return null;
  const [account] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, authorId))
    .limit(1);
  if (!account) return null;
  return {
    id: account.id,
    // An account may never have been given a name; its address still reaches
    // the person, and naming them by it beats offering a blank row.
    name: account.name || account.email,
    email: account.email,
    // An account holds no phone number, by design: numbers live on a roster
    // entry, where they belong to an organisation rather than to a login.
    phone: "",
    title: "",
    source: "author",
  };
}

async function loadMemberRows(organizationIds: readonly string[]) {
  if (organizationIds.length === 0) return [];
  return db
    .select({
      id: organizationMembers.id,
      organizationId: organizationMembers.organizationId,
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
        inArray(organizationMembers.organizationId, [...organizationIds]),
        inArray(organizationMembers.status, ["invited", "active"]),
        isNull(organizationMembers.offboardedAt),
      ),
    )
    .orderBy(
      asc(organizationMembers.lastName),
      asc(organizationMembers.firstName),
    );
}
