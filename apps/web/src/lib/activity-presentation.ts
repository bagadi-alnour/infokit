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
 * The same place handed to Google Maps, for the reader whose phone already has
 * it: the map on the page is OpenStreetMap because it costs no account and no
 * tracker, but walking directions are what someone actually leaves with, and on
 * most of these phones that is Google. Coordinates when the place is exact,
 * otherwise the address as a search; null when there is neither.
 */
export function googleMapsHref({
  address,
  latitude,
  longitude,
}: {
  address: string;
  latitude: number | null;
  longitude: number | null;
}): string | null {
  const query =
    latitude !== null && longitude !== null
      ? `${String(latitude)},${String(longitude)}`
      : address.trim();
  if (!query) return null;
  // The documented "universal" form, which the app on the device claims too, so
  // a tap opens Maps itself rather than a browser tab of it.
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
/** The average civil month and year, which is all "2 months ago" needs. */
const MONTH_MS = 30.436875 * DAY_MS;
const YEAR_MS = 12 * MONTH_MS;

/** The two ways a payload says when a record was last checked. */
export function verificationFormatters(locale: PublicLocale) {
  return {
    // Wall-clock Europe/Paris is the contract for every public date.
    date: new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "Europe/Paris",
    }),
    ago: new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
  };
}

export type VerificationFormatters = ReturnType<typeof verificationFormatters>;

/**
 * "3 days ago" rather than "25 Jul 2026". Freshness is the one claim this site
 * makes about itself, and it is read as an age: a reader deciding whether to
 * cross a town for a meal wants to know how old the check is, not a calendar
 * date they have to subtract today from — in a language whose calendar may not
 * be the one on the page. The date itself stays in the payload beside this, so
 * every answer is still dated (docs/DESIGN-SYSTEM.md §1).
 *
 * A minute is the finest step on purpose: the label is rendered on the server and
 * cached, so a claim in seconds would already be false by the time it was read.
 * Whole units are rounded, never floored below one — the age is never reported as
 * younger than it is by more than half a unit.
 */
export function verifiedAgoLabel({
  verifiedAt,
  format,
  now = Date.now(),
}: {
  verifiedAt: Date;
  format: Intl.RelativeTimeFormat;
  now?: number;
}): string {
  const elapsed = Math.max(now - verifiedAt.getTime(), 0);
  const ago = (value: number, unit: Intl.RelativeTimeFormatUnit) =>
    format.format(-Math.max(Math.round(value), 1), unit);
  if (elapsed < HOUR_MS) return ago(elapsed / MINUTE_MS, "minute");
  if (elapsed < DAY_MS) return ago(elapsed / HOUR_MS, "hour");
  if (elapsed < WEEK_MS) return ago(elapsed / DAY_MS, "day");
  if (elapsed < MONTH_MS) return ago(elapsed / WEEK_MS, "week");
  if (elapsed < YEAR_MS) return ago(elapsed / MONTH_MS, "month");
  return ago(elapsed / YEAR_MS, "year");
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
