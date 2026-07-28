import type { PublicLocale } from "@infokit/shared/i18n";

import type { EventCalendarItem } from "~/components/events/month-calendar";
import type { EventTableRow } from "~/components/events/events-table";
import { localizedPath } from "~/i18n/routing";
import { instantToZonedFields } from "~/lib/zoned-time";
import type {
  CoordinationEventListRecord,
  CoordinationEventRecord,
} from "~/server/content/coordination-events";
import {
  eventDetailView,
  eventWhereLabel,
  formatEventRange,
  type CityView,
} from "~/server/content/event-presentation";
import type { EventVisibilityValue } from "~/components/events/visibility";

export {
  cityToday,
  listCityViews,
  type CityView,
} from "~/server/content/event-presentation";

export function toTableRows({
  events,
  cityById,
  locale,
  labels,
}: {
  events: readonly CoordinationEventListRecord[];
  cityById: Map<string, CityView>;
  locale: PublicLocale;
  labels: { allDay: string };
}): EventTableRow[] {
  return events.map((event) => {
    const range = formatEventRange(
      event,
      cityById.get(event.cityId),
      locale,
      labels,
    );
    return {
      id: event.id,
      href: localizedPath(`/dashboard/events/${event.id}`, locale),
      title: event.title,
      hostName: event.hostName,
      createdBy: event.createdByName,
      visibility: event.visibility,
      cancelled: event.status === "cancelled",
      archived: event.archivedAt !== null,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      dateLabel: range.dateLabel,
      timeLabel: range.timeLabel,
      whereLabel: eventWhereLabel(event),
      cityName: cityById.get(event.cityId)?.name ?? "",
    };
  });
}

export function toCalendarItems({
  events,
  cityById,
  locale,
  labels,
  visibilityLabels,
}: {
  events: readonly CoordinationEventRecord[];
  cityById: Map<string, CityView>;
  locale: PublicLocale;
  labels: { allDay: string };
  /** Reach is a distinction in the console, so the preview states it too. */
  visibilityLabels: Record<EventVisibilityValue, string>;
}): EventCalendarItem[] {
  return events.map((event) => {
    const city = cityById.get(event.cityId);
    const range = formatEventRange(event, city, locale, labels);
    const href = localizedPath(`/dashboard/events/${event.id}`, locale);
    return {
      id: event.id,
      href,
      title: event.title,
      hostName: event.hostName,
      visibility: event.visibility,
      cancelled: event.status === "cancelled",
      allDay: event.allDay,
      startKey: range.startKey,
      endKey: range.endKey,
      timeLabel: range.chipTime,
      detail: eventDetailView({
        event,
        city,
        locale,
        labels,
        href,
        reachLabel: visibilityLabels[event.visibility],
      }),
    };
  });
}

/** The full date and time of one event, for its own page. */
export function eventWhen({
  event,
  city,
  locale,
  labels,
}: {
  event: CoordinationEventRecord;
  city: CityView | undefined;
  locale: PublicLocale;
  labels: { allDay: string };
}) {
  return formatEventRange(event, city, locale, labels);
}

/**
 * The form's date and time fields for an existing event, read back in the
 * city's clock so an editor sees the hour they typed.
 */
export function eventFormFields(
  event: CoordinationEventRecord,
  timeZone: string,
) {
  const start = instantToZonedFields(event.startsAt, timeZone);
  const end = instantToZonedFields(event.endsAt, timeZone);
  return {
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
  };
}
