import {
  formatMessage,
  localeMetadata,
  type PublicLocale,
} from "@infokit/shared/i18n";

import type { NextOpening } from "~/lib/activity-current-status";
import { localizedPath } from "~/i18n/routing";

/** Public organisation page link for a provider slug. */
export function organizationHref(slug: string, locale: PublicLocale): string {
  return localizedPath(`/organizations/${slug}`, locale);
}

/**
 * External map link for an activity's location: precise coordinates when the
 * place is exact, otherwise a text search of the address. Null when neither is
 * available (area-only or contact-to-learn places).
 */
export function mapHref({
  address,
  latitude,
  longitude,
}: {
  address: string;
  latitude: number | null;
  longitude: number | null;
}): string | null {
  if (latitude !== null && longitude !== null) {
    const lat = String(latitude);
    const lon = String(longitude);
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;
  }
  if (address.trim()) {
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;
  }
  return null;
}

/**
 * Localized display name of a language code, rendered in `viewerLocale` so a
 * Persian reader sees the Persian word for the source language rather than its
 * native label. Falls back to the language's own native label, then the code.
 */
function languageName(code: string, viewerLocale: PublicLocale): string {
  try {
    const name = new Intl.DisplayNames([viewerLocale], {
      type: "language",
    }).of(code);
    if (name && name !== code) return name;
  } catch {
    // Intl.DisplayNames may not know a locale/code pair; fall through.
  }
  const meta = (
    localeMetadata as Record<string, { label: string } | undefined>
  )[code];
  return meta?.label ?? code;
}

/**
 * Fallback notice naming the content's source language in the viewer's own
 * language, e.g. a Persian reader sees "… به زبان فرانسوی …".
 */
export function fallbackLabel({
  messages,
  locale,
  contentLanguage,
}: {
  messages: Record<string, string>;
  locale: PublicLocale;
  contentLanguage: string;
}): string {
  return formatMessage(messages["public.fallback"] ?? "", {
    language: languageName(contentLanguage, locale),
  });
}

/**
 * Localized "opens next …" line for a currently-closed activity, e.g.
 * "Opens tomorrow at 12:00" or "Opens Monday at 12:00". Returns null when
 * there is no upcoming opening to show.
 */
export function nextOpeningLabel({
  messages,
  locale,
  opening,
}: {
  messages: Record<string, string>;
  locale: PublicLocale;
  opening: NextOpening | null;
}): string | null {
  if (!opening) return null;
  const time = opening.time;
  if (opening.daysAhead === 0) {
    return formatMessage(messages["activities.opensToday"] ?? "", { time });
  }
  if (opening.daysAhead === 1) {
    return formatMessage(messages["activities.opensTomorrow"] ?? "", { time });
  }
  // ISO weekday (Mon=1 … Sun=7) → a concrete date to format the weekday name.
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2024, 0, opening.weekday)));
  return formatMessage(messages["activities.opensOn"] ?? "", { weekday, time });
}
