import localeRows from "./locales.json";

export const supportedLocales = ["fr", "en", "ar"] as const;
export type Locale = (typeof supportedLocales)[number];

export const publicSupportedLocales = [
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
export type PublicLocale = (typeof publicSupportedLocales)[number];

export const translatedInterfaceLocales = ["fr", "en", "ar"] as const;
export type TranslatedInterfaceLocale =
  (typeof translatedInterfaceLocales)[number];

export const localeMetadata = Object.fromEntries(
  localeRows.map(({ code, label, direction }) => [
    code,
    { label, direction: direction === "rtl" ? "rtl" : "ltr" },
  ]),
) as Record<PublicLocale, { label: string; direction: "ltr" | "rtl" }>;

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && supportedLocales.includes(value as Locale)
  );
}

export function isPublicLocale(value: unknown): value is PublicLocale {
  return (
    typeof value === "string" &&
    publicSupportedLocales.includes(value as PublicLocale)
  );
}

export function resolveLocale(value: string | null | undefined): Locale {
  const base = value?.trim().toLowerCase().split("-")[0];
  return isLocale(base) ? base : "fr";
}

/**
 * Best public locale for a language tag ("fa-IR" → "fa", "de" → "fr"). Used by
 * the public API and by native clients reading the device language.
 */
export function resolvePublicLocale(
  value: string | null | undefined,
): PublicLocale {
  const trimmed = value?.trim().toLowerCase();
  if (isPublicLocale(trimmed)) return trimmed;
  const base = trimmed?.split("-")[0];
  return isPublicLocale(base) ? base : "fr";
}

export function formatMessage(
  message: string,
  values: Record<string, string> = {},
): string {
  return Object.entries(values).reduce(
    (formatted, [name, value]) => formatted.replaceAll(`{${name}}`, value),
    message,
  );
}
