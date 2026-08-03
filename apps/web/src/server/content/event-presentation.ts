import type { PublicLocale } from "@infokit/shared/i18n";
import { and, asc, eq } from "drizzle-orm";

import type { EventDetailView } from "~/components/events/event-preview";
import { localizedPath } from "~/i18n/routing";
import { eventIcsHref, eventMapHref } from "~/lib/event-links";
import { FALLBACK_TIME_ZONE, formatEventWindow } from "~/lib/event-window";
import { zonedDateKey } from "~/lib/zoned-time";
import type { CoordinationEventRecord } from "~/server/content/coordination-events";
import { db } from "~/server/db";
import { cities, cityTranslations } from "~/server/db/schema";

export interface CityView {
  id: string;
  name: string;
  timezone: string;
}

/**
 * Re-exported so the agendas keep reading it from here, where the rest of their
 * formatting lives; it is defined in `~/lib/event-window` because the console's
 * live preview needs it in the browser, and this module talks to the database.
 */
export { FALLBACK_TIME_ZONE } from "~/lib/event-window";

/**
 * The cities an event can happen in, named in the reader's language. Every
 * date an agenda shows is formatted in the city's own timezone, so the zone
 * travels with the name.
 */
export async function listCityViews(locale: PublicLocale): Promise<CityView[]> {
  const rows = await db
    .select({
      id: cities.id,
      code: cities.code,
      timezone: cities.timezone,
      name: cityTranslations.name,
    })
    .from(cities)
    .leftJoin(
      cityTranslations,
      and(
        eq(cityTranslations.cityId, cities.id),
        eq(cityTranslations.languageCode, locale),
      ),
    )
    .orderBy(asc(cities.code));
  return rows.map((row) => ({
    id: row.id,
    name: row.name ?? row.code,
    timezone: row.timezone,
  }));
}

/**
 * The city an event happens in — `undefined` when it happens online and
 * nowhere else. Every agenda reads its cities through this rather than indexing
 * the map directly, so an event with no city is a case each of them had to
 * think about once.
 */
export function eventCity(
  cityById: Map<string, CityView>,
  event: { cityId: string | null },
): CityView | undefined {
  return event.cityId === null ? undefined : cityById.get(event.cityId);
}

/**
 * One event's date and time, formatted once on the server in the city's clock.
 * The console and the public site read the same helper, so the same event never
 * shows two different hours.
 */
export function formatEventRange(
  event: Pick<CoordinationEventRecord, "startsAt" | "endsAt" | "allDay">,
  city: CityView | undefined,
  locale: PublicLocale,
  labels: { allDay: string },
) {
  return formatEventWindow({
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    // An online event names no city, so its hours are read in the platform's
    // own zone — the one the organisers wrote them in.
    timeZone: city?.timezone ?? FALLBACK_TIME_ZONE,
    locale,
    allDayLabel: labels.allDay,
  });
}

/** Where the event happens, in one line: the named place, or what was typed. */
export function eventWhereLabel(event: CoordinationEventRecord) {
  return event.placeName ?? event.locationLabel ?? null;
}

/**
 * One event as the details dialog reads it. Built on the server, once, for both
 * agendas: the console and the public site then show the same hour, the same
 * place and the same links, because neither of them computes any of it.
 */
export function eventDetailView({
  event,
  city,
  locale,
  labels,
  href,
  reachLabel = null,
}: {
  event: CoordinationEventRecord;
  city: CityView | undefined;
  locale: PublicLocale;
  labels: { allDay: string };
  /** Where "open the page" goes — the public page, or the console editor. */
  href: string;
  reachLabel?: string | null;
}): EventDetailView {
  const range = formatEventRange(event, city, locale, labels);
  return {
    id: event.id,
    href,
    title: event.title,
    description: event.description,
    dateLabel: range.dateLabel,
    timeLabel: range.timeLabel,
    whereLabel: eventWhereLabel(event),
    mapHref: eventMapHref(event, city?.name ?? null),
    cityName: city?.name ?? "",
    isOnline: event.isOnline,
    onlineUrl: event.onlineUrl,
    hostName: event.hostName,
    hostHref:
      event.hostPageSlug === null
        ? null
        : localizedPath(`/organizations/${event.hostPageSlug}`, locale),
    contactLabel: event.contactLabel,
    contactValue: event.contactValue,
    cancelled: event.status === "cancelled",
    cancellationReason: event.cancellationReason,
    icsHref: eventIcsHref(event.id, locale),
    reachLabel,
  };
}

/** Today in a city, as the calendar's month and day keys. */
export function cityToday(timeZone: string, now: Date) {
  const key = zonedDateKey(now, timeZone);
  return { todayKey: key, month: key.slice(0, 7) };
}
