/**
 * Wall-clock ↔ instant conversion for a named timezone.
 *
 * An editor typing "14:00" into an agenda means two o'clock in the city the
 * event happens in — not in whatever timezone their laptop is set to, and not
 * UTC. These helpers keep that promise without pulling in a date library:
 * `Intl.DateTimeFormat` already knows every offset and every DST transition.
 */

export interface ZonedFields {
  /** `YYYY-MM-DD` in the target zone. */
  date: string;
  /** `HH:MM` in the target zone, 24-hour. */
  time: string;
}

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

/**
 * How far the zone is from UTC at one instant, in milliseconds. Positive east
 * of Greenwich (Europe/Paris in summer → +7_200_000).
 */
function offsetAt(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantMs));
  const field = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asIfUtc = Date.UTC(
    field("year"),
    field("month") - 1,
    field("day"),
    field("hour"),
    field("minute"),
    field("second"),
  );
  return asIfUtc - instantMs;
}

/**
 * The instant at which the clocks in `timeZone` read `date` and `time`.
 *
 * Returns `null` for input the editor has not finished filling in or that is
 * not a real date, so callers can validate rather than store a silent NaN.
 * The offset is applied twice: the first pass uses the offset in force at the
 * naive instant, the second corrects the hour lost or gained when the wall
 * time sits on a DST transition.
 */
export function zonedWallTimeToInstant(
  date: string,
  time: string,
  timeZone: string,
): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!dateMatch || !timeMatch) return null;
  const [, year, month, day] = dateMatch.map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const [, hour, minute] = timeMatch.map(Number) as [number, number, number];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59) return null;
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  // A date such as 2026-02-30 rolls over; reject it rather than store March.
  const rolled = new Date(naive);
  if (
    rolled.getUTCFullYear() !== year ||
    rolled.getUTCMonth() !== month - 1 ||
    rolled.getUTCDate() !== day
  ) {
    return null;
  }
  const firstPass = naive - offsetAt(naive, timeZone);
  return new Date(naive - offsetAt(firstPass, timeZone));
}

/** The date and time the clocks in `timeZone` show at `instant`. */
export function instantToZonedFields(
  instant: Date,
  timeZone: string,
): ZonedFields {
  const shifted = new Date(
    instant.getTime() + offsetAt(instant.getTime(), timeZone),
  );
  return {
    date: `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`,
  };
}

/** `YYYY-MM-DD` for one instant in a zone — the key a calendar cell uses. */
export function zonedDateKey(instant: Date, timeZone: string): string {
  return instantToZonedFields(instant, timeZone).date;
}
