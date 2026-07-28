export const editorialLanguageCodes = [
  "fr",
  "en",
  "ar",
  "fa",
  "prs",
  "ps",
  "ckb",
  "ti",
  "am",
  "om",
  "so",
] as const;

export type EditorialLanguage = (typeof editorialLanguageCodes)[number];

const rtlLanguages = new Set<EditorialLanguage>([
  "ar",
  "fa",
  "prs",
  "ps",
  "ckb",
]);

export function isRtlEditorialLanguage(language: EditorialLanguage) {
  return rtlLanguages.has(language);
}

/**
 * The `dir` an authoring field, a preview or a translator's own text is written
 * with. Every such element asks the same question, so it is answered here: a
 * language added to `rtlLanguages` starts reading correctly everywhere at once.
 */
export function editorialTextDirection(language: EditorialLanguage) {
  return isRtlEditorialLanguage(language) ? "rtl" : "ltr";
}
