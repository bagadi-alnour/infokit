/**
 * How a member's two name columns are read back as one line.
 *
 * `core.organization_members` stores the given name and the family name apart
 * (docs/DATABASE-SCHEMA.md §5), so every screen that prints a person has to join
 * them the same way. Doing it here rather than in each component is what keeps a
 * roster row, an avatar's initials and an audit line from disagreeing about who
 * somebody is.
 */
export interface MemberName {
  firstName: string;
  lastName: string;
}

/** Given name then family name, with either half missing tolerated. */
export function memberFullName(member: MemberName): string {
  return [member.firstName, member.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Two letters for an avatar: the first of each name. Falls back to the first two
 * of whichever half exists, and to "?" for a row with neither — an avatar is
 * decoration, and it must never be the thing that throws.
 */
export function memberInitials(member: MemberName): string {
  const first = member.firstName.trim();
  const last = member.lastName.trim();
  const initials = `${first.slice(0, 1)}${last.slice(0, 1)}`;
  return (initials || memberFullName(member).slice(0, 2) || "?").toUpperCase();
}
