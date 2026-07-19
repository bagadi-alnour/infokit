import { isLocale, type Locale } from "@calais/shared/i18n";

import { localizedPath } from "~/i18n/routing";

export function safeReturnTo(value: unknown, locale: Locale): string {
  const fallback = localizedPath("/dashboard", locale);
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return fallback;
  }

  const parsed = new URL(value, "https://calais-info.invalid");
  if (parsed.origin !== "https://calais-info.invalid") return fallback;

  const segments = parsed.pathname.split("/").filter(Boolean);
  const pathSegments = isLocale(segments[0]) ? segments.slice(1) : segments;
  if (pathSegments[0] !== "dashboard") return fallback;

  return `${localizedPath(`/${pathSegments.join("/")}`, locale)}${parsed.search}${parsed.hash}`;
}
