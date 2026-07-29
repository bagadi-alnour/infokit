import { eq, inArray } from "drizzle-orm";

import {
  permissionScope,
  type PermissionScope,
} from "~/server/auth/authorization";
import { db } from "~/server/db";
import {
  languages,
  memberLanguages,
  organizationMembers,
} from "~/server/db/schema";
import { replaceSkillRecords } from "~/server/skills";

/** A transaction, or the connection itself for a single-statement write. */
type Writer = Pick<typeof db, "select" | "delete" | "insert" | "update">;

/**
 * The grant that opens a member list. A roster is not administration an editor
 * picks up on the way past: it is people's names, addresses and phone numbers,
 * held one notch tighter than the record they belong to (organisations/[id]
 * shows the same rule — the roster's shape without `members.read`, its contact
 * details only with it).
 */
export const MEMBER_DIRECTORY_PERMISSION = "members.read";

/**
 * Whose members this account may read, or `null` when the answer is nobody and
 * the page should refuse.
 *
 * The board is cross-organisation by design — the point of it is placing people
 * across a city's teams — so "which organisations" is the whole of its security:
 * an organisation's own administrator, coordinator or team lead reads their own
 * roster, and the platform reads every roster only where a platform grant or
 * support access says so. The three-step rule is `permissionScope`'s, so this
 * board and the audit trail cannot come to different conclusions about a role
 * test.
 */
export async function memberDirectoryScope(
  userId: string,
): Promise<PermissionScope | null> {
  return permissionScope(userId, MEMBER_DIRECTORY_PERMISSION);
}

/**
 * The five fields `core.organization_members` requires of everybody: two halves
 * of a name, the function held inside the association, a phone number and an
 * email address. Every path that puts a person on the books — the city-team
 * invitation, an activity assignment, the platform inviting an association's
 * representative — supplies all five, which is why they travel as one object
 * rather than as five optional arguments.
 */
export interface MemberIdentity {
  firstName: string;
  lastName: string;
  contactEmail: string;
  phone: string;
  title: string;
}

/**
 * Keep only codes that exist in the language catalogue — all of it, not the
 * `enabled` part: `enabled` says the platform publishes content in a language,
 * which is a different question from whether a member speaks it.
 */
export async function validLanguageCodes(codes: string[]): Promise<string[]> {
  if (codes.length === 0) return [];
  const rows = await db
    .select({ code: languages.code })
    .from(languages)
    .where(inArray(languages.code, codes));
  return rows.map((row) => row.code);
}

/**
 * Create the membership. `userId` is null until the invited person signs in with
 * that address, which is also the state a pending invitation sits in.
 */
export async function insertMember(
  tx: Writer,
  {
    organizationId,
    userId,
    identity,
  }: {
    organizationId: string;
    userId: string | null;
    identity: MemberIdentity;
  },
): Promise<string> {
  const [created] = await tx
    .insert(organizationMembers)
    .values({
      organizationId,
      userId,
      firstName: identity.firstName,
      lastName: identity.lastName,
      contactEmail: identity.contactEmail,
      phone: identity.phone,
      title: identity.title,
      status: userId ? "active" : "invited",
    })
    .returning({ id: organizationMembers.id });
  if (!created) throw new Error("Member insert returned no row");
  return created.id;
}

/**
 * Replace what one member brings: the catalogue rows they declared and the
 * languages they speak. Deliberately separate from their identity — assigning
 * somebody to an activity refines what they can do there, and must not rewrite
 * the name, number or function the organisation's roster holds.
 */
export async function replaceMemberCapabilities(
  tx: Writer,
  memberId: string,
  {
    skillIds,
    languageCodes,
  }: {
    skillIds: readonly string[];
    languageCodes: readonly string[];
  },
) {
  await replaceSkillRecords(tx, { memberId }, skillIds);
  await tx
    .delete(memberLanguages)
    .where(eq(memberLanguages.memberId, memberId));
  if (languageCodes.length > 0) {
    await tx
      .insert(memberLanguages)
      .values(
        languageCodes.map((languageCode) => ({ memberId, languageCode })),
      );
  }
}

/**
 * Replace the admin-authored profile of one member: who they are, and what they
 * bring. These stay private to the organisation workspace; public attribution is
 * approved per activity assignment and never derives from them.
 *
 * The email address is deliberately not writable here. It is the identity an
 * invitation is sent to and the one an account links itself by, so changing it
 * is re-inviting somebody, not editing a field.
 *
 * What a member can do is a set of catalogue ids, not typed text: that is what
 * lets a mission's requirements be matched by comparison instead of by reading.
 * `replaceSkillRecords` diffs rather than rewrites, so a declaration somebody
 * already verified survives the next profile save.
 */
export async function writeMemberProfile(
  tx: Writer,
  memberId: string,
  {
    firstName,
    lastName,
    phone,
    title,
    skillIds,
    languageCodes,
  }: Omit<MemberIdentity, "contactEmail"> & {
    skillIds: string[];
    languageCodes: string[];
  },
) {
  await tx
    .update(organizationMembers)
    .set({ firstName, lastName, phone, title })
    .where(eq(organizationMembers.id, memberId));
  await replaceMemberCapabilities(tx, memberId, {
    skillIds,
    languageCodes,
  });
}
