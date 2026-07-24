import { eq, inArray } from "drizzle-orm";

import { db } from "~/server/db";
import {
  languages,
  memberLanguages,
  memberSkills,
  organizationMembers,
} from "~/server/db/schema";

/** Comma-separated free text → deduped, trimmed, bounded skill list. */
export function parseSkills(raw: string | null): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean)
        .map((skill) => skill.slice(0, 120)),
    ),
  ].slice(0, 20);
}

/** Keep only codes that exist in the language catalogue. */
export async function validLanguageCodes(codes: string[]): Promise<string[]> {
  if (codes.length === 0) return [];
  const rows = await db
    .select({ code: languages.code })
    .from(languages)
    .where(inArray(languages.code, codes));
  return rows.map((row) => row.code);
}

/**
 * Replace the admin-authored profile facets of one member. These stay
 * private to the organisation workspace; public attribution is approved
 * per activity assignment and never derives from them.
 */
export async function replaceMemberProfileFacets(
  tx: Pick<typeof db, "delete" | "insert" | "update">,
  memberId: string,
  {
    title,
    skills,
    languageCodes,
  }: {
    title: string | null;
    skills: string[];
    languageCodes: string[];
  },
) {
  await tx
    .update(organizationMembers)
    .set({ title })
    .where(eq(organizationMembers.id, memberId));
  await tx.delete(memberSkills).where(eq(memberSkills.memberId, memberId));
  if (skills.length > 0) {
    await tx
      .insert(memberSkills)
      .values(skills.map((skill) => ({ memberId, skill })));
  }
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
