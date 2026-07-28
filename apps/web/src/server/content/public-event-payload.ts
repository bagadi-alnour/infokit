/**
 * One presenter for every agenda payload a client reads: the public events
 * endpoint and the members' agenda both come through here. Dates are formatted
 * once, in the city's own clock, and each event carries the plain words for its
 * reach — a client never maps a visibility enum to a colour of its own
 * (`@infokit/shared/public-content`, docs/DESIGN-SYSTEM.md §6).
 */
import { localeMetadata, type PublicLocale } from "@infokit/shared/i18n";
import {
  loadPageCatalog,
  type PageCatalog,
} from "@infokit/shared/i18n/catalogs";
import { formatMessage } from "@infokit/shared/i18n";
import type {
  PublicEventDetailPayload,
  PublicEventLabels,
  PublicEventListPayload,
  PublicEventPageLabels,
  PublicEventReach,
  PublicEventSummary,
} from "@infokit/shared/public-content";

import { localizedPath } from "~/i18n/routing";
import { eventIcsHref, eventMapHref } from "~/lib/event-links";
import type { CoordinationEventRecord } from "~/server/content/coordination-events";
import {
  findPublicCoordinationEvent,
  listPastPublicCoordinationEvents,
  listPublicCoordinationEvents,
} from "~/server/content/coordination-events";
import {
  publicEventMedia,
  publicEventMediaFor,
} from "~/server/content/event-media";
import {
  cityToday,
  eventWhereLabel,
  formatEventRange,
  listCityViews,
  FALLBACK_TIME_ZONE,
  type CityView,
} from "~/server/content/event-presentation";

type Messages = PageCatalog<"public-content">;
type MemberMessages = PageCatalog<"member">;

/**
 * Weekday initials for a month grid, Monday first. Computed from the reader's
 * own language rather than shipped as eleven catalogue keys.
 */
export function weekdayInitials(locale: PublicLocale): string[] {
  const narrow = new Intl.DateTimeFormat(locale, {
    weekday: "narrow",
    timeZone: "UTC",
  });
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, index) =>
    narrow.format(new Date(Date.UTC(2024, 0, 1 + index))),
  );
}

/** "July 2026" for a month key, in the reader's language. */
export function monthLabel(month: string, locale: PublicLocale): string {
  const [year, index] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year ?? 1970, (index ?? 1) - 1, 15)));
}

export function eventLabels({
  messages,
  locale,
  month,
}: {
  messages: Messages;
  locale: PublicLocale;
  month: string;
}): PublicEventLabels {
  return {
    empty: messages["events.empty"],
    emptyPast: messages["events.emptyPast"],
    upcoming: messages["events.upcoming"],
    past: messages["events.past"],
    when: messages["events.when"],
    where: messages["events.where"],
    city: messages["events.city"],
    host: messages["events.host"],
    platform: messages["public.platform"],
    contact: messages["events.contact"],
    allDay: messages["events.allDay"],
    cancelled: messages["events.cancelled"],
    cancelledNoReason: messages["events.cancelledNoReason"],
    addToCalendar: messages["events.addToCalendar"],
    openMap: messages["events.openMap"],
    checkBefore: messages["events.checkBefore"],
    details: messages["events.details"],
    notAvailable: messages["public.notAvailable"],
    weekdayInitials: weekdayInitials(locale),
    monthLabel: monthLabel(month, locale),
    previousMonth: messages["events.calendar.previousMonth"],
    nextMonth: messages["events.calendar.nextMonth"],
    today: messages["events.calendar.today"],
  };
}

export function eventPageLabels(messages: Messages): PublicEventPageLabels {
  return {
    eyebrow: messages["events.eyebrow"],
    title: messages["events.title"],
    description: messages["events.description"],
    occasional: messages["events.occasional"],
    occasionalLink: messages["events.occasional.link"],
  };
}

/** The reach an event was stored with, as the payload names it. */
export function reachOf(event: CoordinationEventRecord): PublicEventReach {
  return event.visibility;
}

/**
 * The words for a reach. `organization` names the host, because "members only"
 * is not the same promise to someone in two organisations.
 */
export function reachLabelFor({
  event,
  messages,
}: {
  event: CoordinationEventRecord;
  messages: MemberMessages;
}): string {
  if (event.visibility === "public") return messages["member.reach.public"];
  if (event.visibility === "inter_organization") {
    return messages["member.reach.interOrganization"];
  }
  return event.hostName
    ? formatMessage(messages["member.reach.organization"], {
        organization: event.hostName,
      })
    : messages["member.reach.organizationAny"];
}

/** One event, dated and placed, ready to render. */
export function presentEvent({
  event,
  city,
  locale,
  allDay,
  reachLabel,
  href,
  coverImage = null,
}: {
  event: CoordinationEventRecord;
  city: CityView | undefined;
  locale: PublicLocale;
  allDay: string;
  reachLabel: string;
  href: string;
  coverImage?: PublicEventSummary["coverImage"];
}): PublicEventSummary {
  const range = formatEventRange(event, city, locale, { allDay });
  return {
    id: event.id,
    href,
    title: event.title,
    description: event.description,
    dayKey: range.startKey,
    endDayKey: range.endKey,
    dateLabel: range.dateLabel,
    timeLabel: range.timeLabel,
    chipTimeLabel: range.chipTime,
    allDay: event.allDay,
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
    reach: reachOf(event),
    reachLabel,
    coverImage,
  };
}

/** The month a grid opens on, in the first city's clock. */
export function defaultMonth(cities: CityView[], now: Date) {
  return cityToday(cities[0]?.timezone ?? FALLBACK_TIME_ZONE, now);
}

/**
 * One public event for a client that arrived with an id. Null for anything that
 * is not on the `public` tier, so a guessed id reveals nothing — the same single
 * condition the shareable page uses.
 */
export async function loadEventDetailPayload(
  eventId: string,
  locale: PublicLocale,
): Promise<PublicEventDetailPayload | null> {
  const [messages, member, event, cities] = await Promise.all([
    loadPageCatalog(locale, "public-content"),
    loadPageCatalog(locale, "member"),
    findPublicCoordinationEvent({ eventId, locale }),
    listCityViews(locale),
  ]);
  if (!event) return null;
  const media = await publicEventMediaFor({ eventId, locale });
  const { month } = defaultMonth(cities, new Date());
  return {
    locale,
    direction: localeMetadata[locale].direction,
    event: presentEvent({
      event,
      city: cities.find((candidate) => candidate.id === event.cityId),
      locale,
      allDay: messages["events.allDay"],
      reachLabel: reachLabelFor({ event, messages: member }),
      href: localizedPath(`/events/${event.id}`, locale),
      coverImage: media.cover,
    }),
    labels: eventLabels({ messages, locale, month }),
  };
}

/**
 * Everything the public agenda needs: what is coming, the recent tail so an
 * empty month does not read as "nothing ever happens here", and the labels for
 * both shapes of the same list.
 */
export async function loadEventListPayload(
  locale: PublicLocale,
  requestedMonth?: string,
): Promise<PublicEventListPayload> {
  const now = new Date();
  const [messages, member, upcoming, past, cities] = await Promise.all([
    loadPageCatalog(locale, "public-content"),
    loadPageCatalog(locale, "member"),
    listPublicCoordinationEvents({ locale, from: now }),
    listPastPublicCoordinationEvents({ locale, before: now }),
    listCityViews(locale),
  ]);
  const media = await publicEventMedia({
    eventIds: [...upcoming, ...past].map((event) => event.id),
    locale,
  });
  const cityById = new Map(cities.map((city) => [city.id, city]));
  const { todayKey, month } = defaultMonth(cities, now);
  const allDay = messages["events.allDay"];
  const present = (event: CoordinationEventRecord) =>
    presentEvent({
      event,
      city: cityById.get(event.cityId),
      locale,
      allDay,
      reachLabel: reachLabelFor({ event, messages: member }),
      href: localizedPath(`/events/${event.id}`, locale),
      coverImage: media.get(event.id)?.cover ?? null,
    });

  return {
    locale,
    direction: localeMetadata[locale].direction,
    todayKey,
    month: requestedMonth ?? month,
    upcoming: upcoming.map(present),
    past: past.map(present),
    labels: eventLabels({ messages, locale, month: requestedMonth ?? month }),
    page: eventPageLabels(messages),
  };
}
