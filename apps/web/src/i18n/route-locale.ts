import { isLocale, type Locale } from "@calais/shared/i18n";
import { notFound } from "next/navigation";

export function requireRouteLocale(value: string): Locale {
  if (!isLocale(value)) notFound();
  return value;
}
