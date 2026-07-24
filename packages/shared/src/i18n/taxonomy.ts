import audiences from "./taxonomy/audiences.json";
import categories from "./taxonomy/categories.json";
import services from "./taxonomy/services.json";
import specialities from "./taxonomy/specialities.json";
import tags from "./taxonomy/tags.json";

import { publicSupportedLocales, type PublicLocale } from "./index";

/**
 * Controlled taxonomies are stored in the database by stable `code`; their
 * human labels live here as JSON keyed by that code, in all supported public
 * languages. Switching language is therefore a pure render concern with no
 * database round-trip. These JSON files are also the single source of truth
 * the seed reads to populate the DB translation tables used by the editor.
 */
export const taxonomyKinds = [
  "categories",
  "services",
  "audiences",
  "tags",
  "specialities",
] as const;
export type TaxonomyKind = (typeof taxonomyKinds)[number];

type LocaleLabels = Record<PublicLocale, string>;
type TaxonomyTable = Record<string, LocaleLabels>;

const TABLES = {
  categories,
  services,
  audiences,
  tags,
  specialities,
} as const satisfies Record<
  TaxonomyKind,
  Record<string, Partial<LocaleLabels>>
>;

/** French is the fallback target for every other public language. */
const FALLBACK_LOCALE: PublicLocale = "fr";

/**
 * Resolve a taxonomy `code` to its label in `locale`, falling back to French
 * and finally to the raw code. Never touches the database.
 */
export function taxonomyLabel(
  kind: TaxonomyKind,
  code: string,
  locale: PublicLocale,
): string {
  const entry = (TABLES[kind] as TaxonomyTable)[code];
  if (!entry) return code;
  return entry[locale] || entry[FALLBACK_LOCALE] || code;
}

/** All codes for a taxonomy kind, in declaration order. */
export function taxonomyCodes(kind: TaxonomyKind): string[] {
  return Object.keys(TABLES[kind]);
}

/** Every locale label for one code — used by the seed to fill DB rows. */
export function taxonomyEntry(
  kind: TaxonomyKind,
  code: string,
): LocaleLabels | undefined {
  const entry = (TABLES[kind] as TaxonomyTable)[code];
  if (!entry) return undefined;
  return Object.fromEntries(
    publicSupportedLocales.map((loc) => [
      loc,
      entry[loc] || entry[FALLBACK_LOCALE] || code,
    ]),
  ) as LocaleLabels;
}
