import localeRows from "./locales.json";

export const supportedLocales = ["fr", "en", "ar"] as const;
export type Locale = (typeof supportedLocales)[number];

export const localeMetadata = Object.fromEntries(
  localeRows.map(({ code, label, direction }) => [
    code,
    { label, direction: direction === "rtl" ? "rtl" : "ltr" },
  ]),
) as Record<Locale, { label: string; direction: "ltr" | "rtl" }>;

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && supportedLocales.includes(value as Locale)
  );
}

export function resolveLocale(value: string | null | undefined): Locale {
  const base = value?.trim().toLowerCase().split("-")[0];
  return isLocale(base) ? base : "fr";
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
