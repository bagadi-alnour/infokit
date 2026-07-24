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
