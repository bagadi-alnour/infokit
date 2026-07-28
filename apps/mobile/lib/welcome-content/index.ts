import type { PublicLocale } from "@infokit/shared/i18n";

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
import type { WelcomeStrings } from "./types";

/**
 * The words of the first-run flow. They live in the app, not in the public
 * content catalogue, for the same reason `AppStrings` does (lib/app-strings.ts):
 * the welcome runs *before* any payload exists — on first launch, possibly with
 * no network at all — so it cannot wait for a server-localized string.
 *
 * All eleven public languages are translated here, and deliberately so: the rest
 * of the interface may still fall back to the English base for the eight
 * languages that have chrome overlays rather than full catalogues (AGENTS.md
 * rule 3), but this is the screen where a reader chooses their language. Falling
 * back to English on it fails exactly the person the fallback exists for.
 *
 * One table per language, so a translator can be sent a single file.
 */
const tables: Record<PublicLocale, WelcomeStrings> = {
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

export function welcomeStrings(locale: PublicLocale): WelcomeStrings {
  return tables[locale];
}

/**
 * A greeting in each configured language, so the first screen can be chosen by
 * recognition instead of reading: someone who reads none of fr/en/ar still
 * finds their own script. Shared scripts repeat the same word on purpose.
 */
export const localeGreetings: Record<PublicLocale, string> = {
  fr: "Bonjour",
  en: "Hello",
  ar: "مرحبا",
  fa: "سلام",
  prs: "سلام",
  ps: "سلام",
  ckb: "سڵاو",
  ti: "ሰላም",
  am: "ሰላም",
  om: "Akkam",
  so: "Salaan",
};

/** Fills `{name}` placeholders. Keeps the tables free of string concatenation. */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = values[key];
    return value === undefined ? whole : String(value);
  });
}

export type { WelcomeFeature, WelcomeStrings } from "./types";
