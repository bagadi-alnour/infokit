/**
 * What the home page's search box compares a reader's keystrokes against.
 *
 * The index arrives in eleven languages and the reader types on whatever
 * keyboard they have, so neither side can be compared as it was written. A
 * French name is typed without its accents, an Arabic name without the short
 * vowels an editor may have set, and the same Arabic letter is a different
 * codepoint on a Persian, Dari, Pashto or Sorani keyboard. All of that is folded
 * away on both sides before anything is looked at.
 *
 * Matching is "contains" and word by word, not "starts with": people type the
 * word that distinguishes a name rather than the one that opens it —
 * "catholique", not "secours" — and they type two of them when one is not
 * enough.
 *
 * Pure functions, no React and no database: the server folds the index once per
 * render and the browser folds only what was typed, which is why the folding
 * lives in one file both can import (docs/UI-ARCHITECTURE.md §1).
 */

/**
 * What a suggestion is a suggestion of. Also the order the groups are shown in,
 * which is the order the page itself is written in: the kinds of help in the
 * hero, then the services band, then the activities, the places they are at, and
 * last the associations behind them.
 */
export type SearchSuggestionKind =
  "need" | "service" | "activity" | "place" | "organization";

/** One row of the popup: what it says, and where pressing it goes. */
export interface SearchSuggestion {
  /** Unique across the whole popup, so the kind is part of it. */
  id: string;
  kind: SearchSuggestionKind;
  label: string;
  /** The quiet second line — where it is, or how many answers are behind it. */
  hint: string;
  /** A catalogue icon name where the content carries one, else null. */
  icon: string | null;
  href: string;
  /**
   * The label plus every other word worth matching, already folded. Built on the
   * server so a keystroke costs one `includes` per row rather than a fold.
   */
  haystack: string;
}

/** One heading in the popup and the rows under it. */
export interface SearchSuggestionGroup {
  kind: SearchSuggestionKind;
  /** The heading, in the reader's language — always a catalogue entry. */
  label: string;
  items: SearchSuggestion[];
}

/**
 * The letters the keyboards disagree about.
 *
 * Arabic, Persian, Dari, Pashto and Sorani share an alphabet but not a keyboard:
 * the same word is typed with ی or ي, ک or ك, and a final ه may be typed as ة.
 * None of these decompose on their own, so the five are mapped by hand; the
 * hamza and madda forms of alef, and the hamza on waw and yeh, are combining
 * marks and are already gone by the time this is reached.
 */
const SAME_LETTER_DIFFERENT_KEY = new Map([
  ["ى", "ي"], // ى → ي
  ["ی", "ي"], // ی → ي
  ["ک", "ك"], // ک → ك
  ["ھ", "ه"], // ھ → ه
  ["ة", "ه"], // ة → ه
]);

/**
 * Characters that carry no sound: the tatweel, which only stretches a word to
 * fill a line, and the zero-width marks Persian and Dari write inside words.
 */
const SILENT_CHARACTERS = /[\u0640\u200B-\u200F]/gu;

/**
 * One comparable form of a string: case, accents, Arabic vowel marks and the
 * keyboards' disagreements all folded away, and the spacing normalised.
 *
 * `toLowerCase` is deliberately not the locale-aware one. The server folds the
 * index and the browser folds the query, and the two must agree letter for
 * letter — a fold that depended on where it ran would quietly stop matching in
 * one of the eleven languages.
 */
export function foldSearchText(value: string): string {
  let folded = "";
  for (const character of value
    // Decompose first, then drop every combining mark: é becomes e, and the
    // Arabic harakat, the hamza above and below alef and the Vietnamese tones
    // all go with them.
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(SILENT_CHARACTERS, "")) {
    folded += SAME_LETTER_DIFFERENT_KEY.get(character) ?? character;
  }
  return folded.toLowerCase().replace(/\s+/gu, " ").trim();
}

/** A suggestion's words, folded into the one string a keystroke is tried against. */
export function suggestionHaystack(
  parts: readonly (string | null | undefined)[],
): string {
  return foldSearchText(parts.filter(Boolean).join(" "));
}

/**
 * The groups worth showing for what has been typed so far, each cut to the few
 * rows a popup can hold.
 *
 * Every word must be found, so a second word narrows rather than widens: a
 * reader who types "repas calais" has said two things about one answer. An empty
 * query matches nothing at all — the popup is a reaction to typing, not a menu
 * that opens on focus — and a group with no rows left is dropped rather than
 * shown as an empty heading.
 */
export function matchingSuggestionGroups({
  groups,
  query,
  perGroup,
}: {
  groups: readonly SearchSuggestionGroup[];
  query: string;
  perGroup: number;
}): SearchSuggestionGroup[] {
  const folded = foldSearchText(query);
  if (!folded) return [];
  const words = folded.split(" ");
  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => words.every((word) => item.haystack.includes(word)))
        .slice(0, perGroup),
    }))
    .filter((group) => group.items.length > 0);
}
