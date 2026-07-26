import type { PublicLocale } from "@infokit/shared/i18n";
import { and, asc, eq } from "drizzle-orm";

import type { EventDetailView } from "~/components/events/event-preview";
import { localizedPath } from "~/i18n/routing";
import { eventIcsHref, eventMapHref } from "~/lib/event-links";
import { zonedDateKey } from "~/lib/zoned-time";
import type { CoordinationEventRecord } from "~/server/content/coordination-events";
import { db } from "~/server/db";
import { cities, cityTranslations } from "~/server/db/schema";

export interface CityView {
  id: string;
  name: string;
  timezone: string;
}

/** When a city has no timezone to hand — the platform's first city's zone. */
export const FALLBACK_TIME_ZONE = "Europe/Paris";

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
 * One event's date and time, formatted once on the server in the city's clock.
 * The console and the public site read the same helper, so the same event never
 * shows two different hours.
 */
export function formatEventRange(
  event: CoordinationEventRecord,
  city: CityView | undefined,
  locale: PublicLocale,
  labels: { allDay: string },
) {
  const timeZone = city?.timezone ?? FALLBACK_TIME_ZONE;
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone,
  });
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    hourCycle: "h23",
  });
  const startKey = zonedDateKey(event.startsAt, timeZone);
  const endKey = zonedDateKey(event.endsAt, timeZone);
  const multiDay = startKey !== endKey;
  const dateLabel = multiDay
    ? `${date.format(event.startsAt)} → ${date.format(event.endsAt)}`
    : date.format(event.startsAt);
  const timeLabel = event.allDay
    ? labels.allDay
    : `${time.format(event.startsAt)} – ${time.format(event.endsAt)}`;
  return {
    startKey,
    endKey,
    dateLabel,
    timeLabel,
    /** What a calendar chip shows before the title: a start, not a range. */
    chipTime: event.allDay ? labels.allDay : time.format(event.startsAt),
  };
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
