import assert from "node:assert/strict";
import test from "node:test";

import {
  foldSearchText,
  matchingSuggestionGroups,
  suggestionHaystack,
  type SearchSuggestionGroup,
} from "./search-suggestions";

const group = (
  kind: SearchSuggestionGroup["kind"],
  items: { label: string; extra?: string }[],
): SearchSuggestionGroup => ({
  kind,
  label: kind,
  items: items.map((item, index) => ({
    id: `${kind}-${String(index)}`,
    kind,
    label: item.label,
    hint: "",
    icon: null,
    href: `/en/activities?q=${item.label}`,
    haystack: suggestionHaystack([item.label, item.extra]),
  })),
});

void test("folds case, accents and spacing to one comparable form", () => {
  assert.equal(foldSearchText("  Repas   CHAUDS  "), "repas chauds");
  assert.equal(foldSearchText("Hôpital Détresse"), "hopital detresse");
  assert.equal(foldSearchText("Café"), foldSearchText("cafe"));
});

void test("folds the Arabic marks and the keyboards' disagreements", () => {
  // Short vowels an editor may have set are not on a reader's keyboard.
  assert.equal(foldSearchText("مَلْجَأ"), foldSearchText("ملجا"));
  // The Persian/Dari yeh and keheh against the Arabic ones.
  assert.equal(foldSearchText("پزشکی"), foldSearchText("پزشكي"));
  // Tatweel stretches a word; a zero-width joiner splits one.
  assert.equal(foldSearchText("طـعـام"), "طعام");
  assert.equal(foldSearchText("می‌شود"), foldSearchText("میشود"));
});

void test("matches anywhere in the words, not only at their start", () => {
  const groups = [group("organization", [{ label: "Secours Catholique" }])];
  const matches = matchingSuggestionGroups({
    groups,
    query: "catholique",
    perGroup: 5,
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.items[0]?.label, "Secours Catholique");
});

void test("every word must be found, so a second word narrows", () => {
  const groups = [
    group("activity", [
      { label: "Repas du soir", extra: "Jules Ferry" },
      { label: "Repas du midi", extra: "Centre-ville" },
    ]),
  ];
  const narrowed = matchingSuggestionGroups({
    groups,
    query: "repas ferry",
    perGroup: 5,
  });
  assert.deepEqual(
    narrowed[0]?.items.map((item) => item.label),
    ["Repas du soir"],
  );
  assert.equal(
    matchingSuggestionGroups({ groups, query: "repas", perGroup: 5 })[0]?.items
      .length,
    2,
  );
});

void test("shows nothing for an empty query and drops empty groups", () => {
  const groups = [
    group("need", [{ label: "Se laver" }]),
    group("place", [{ label: "Gare" }]),
  ];
  assert.deepEqual(
    matchingSuggestionGroups({ groups, query: "   ", perGroup: 5 }),
    [],
  );
  assert.deepEqual(
    matchingSuggestionGroups({ groups, query: "gare", perGroup: 5 }).map(
      (match) => match.kind,
    ),
    ["place"],
  );
});

void test("cuts each group to what the popup can hold", () => {
  const groups = [
    group(
      "service",
      Array.from({ length: 9 }, (_, index) => ({
        label: `Douches ${String(index)}`,
      })),
    ),
  ];
  assert.equal(
    matchingSuggestionGroups({ groups, query: "douches", perGroup: 5 })[0]
      ?.items.length,
    5,
  );
});
