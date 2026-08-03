import { zonedDateKey } from "~/lib/zoned-time";

/**
 * When an event has no city to take a clock from — an online event, or a city
 * row that lost its zone. The platform's first city's zone: the hours were
 * written by somebody sitting in it.
 */
export const FALLBACK_TIME_ZONE = "Europe/Paris";

/**
 * An event's date and time as one pair of labels, in the clock of the city it
 * happens in.
 *
 * The formatting lives here rather than in the server presenter because the
 * console previews an event before it exists — there is no row to format yet,
 * only what the editor has typed. Both callers go through this function, so the
 * card an editor is shown and the card a reader is served can never disagree
 * about the hour.
 */
export function formatEventWindow({
  startsAt,
  endsAt,
  allDay,
  timeZone,
  locale,
  allDayLabel,
}: {
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  timeZone: string;
  locale: string;
  /** What a day-long event says instead of an hour. */
  allDayLabel: string;
}) {
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
  const startKey = zonedDateKey(startsAt, timeZone);
  const endKey = zonedDateKey(endsAt, timeZone);
  const multiDay = startKey !== endKey;
  return {
    startKey,
    endKey,
    dateLabel: multiDay
      ? `${date.format(startsAt)} → ${date.format(endsAt)}`
      : date.format(startsAt),
    timeLabel: allDay
      ? allDayLabel
      : `${time.format(startsAt)} – ${time.format(endsAt)}`,
    /** What a calendar chip shows before the title: a start, not a range. */
    chipTime: allDay ? allDayLabel : time.format(startsAt),
  };
}
