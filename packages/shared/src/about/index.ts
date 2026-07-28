import type { PublicLocale } from "../i18n";

import { amharic } from "./am";
import { arabic } from "./ar";
import { sorani } from "./ckb";
import { english } from "./en";
import { persian } from "./fa";
import { french } from "./fr";
import { oromo } from "./om";
import { dari } from "./prs";
import { pashto } from "./ps";
import { somali } from "./so";
import { tigrinya } from "./ti";
import type { AboutStrings } from "./types";

/**
 * What InfoKit is, in the reader's own language.
 *
 * These words describe the platform itself rather than any published entry, so
 * they are not editor content and cannot come from the database: they live here,
 * next to the interface catalogues, and both surfaces read the same table — the
 * site's About page and the app's About sheet explain the same product in the
 * same words (docs/UI-ARCHITECTURE.md §1).
 *
 * All eleven languages are translated, not the interface three: "what is this
 * app, and can I trust what it tells me" is precisely the question a reader asks
 * in their own language, and an English fallback answers it for the people who
 * need it least. One table per language, so a translator can be sent one file.
 *
 * Two things are deliberately *not* repeated here — the four status words and
 * the four things never asked for. Each surface passes in its own established
 * vocabulary for those, so this page cannot drift from the words the rest of the
 * surface already uses (docs/DESIGN-SYSTEM.md §6).
 */
const tables: Record<PublicLocale, AboutStrings> = {
  fr: french,
  en: english,
  ar: arabic,
  fa: persian,
  prs: dari,
  ps: pashto,
  ckb: sorani,
  ti: tigrinya,
  am: amharic,
  om: oromo,
  so: somali,
};

export function aboutStrings(locale: PublicLocale): AboutStrings {
  return tables[locale];
}

export type { AboutSection, AboutStrings } from "./types";
