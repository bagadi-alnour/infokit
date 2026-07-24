import {
  isLocale,
  isPublicLocale,
  type Locale,
  type PublicLocale,
} from "@calais/shared/i18n";
import { notFound } from "next/navigation";

export function requireRouteLocale(value: string): Locale {
  if (!isLocale(value)) notFound();
  return value;
}

export function requirePublicRouteLocale(value: string): PublicLocale {
  if (!isPublicLocale(value)) notFound();
  return value;
}
