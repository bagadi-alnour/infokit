const PARIS_TIME_ZONE = "Europe/Paris";

const WEEKDAYS: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export type ActivityCurrentStatus =
  "open" | "closed" | "cancelled" | "uncertain";

export interface PublicScheduleRule {
  weekday: number;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  validFrom: string | null;
  validTo: string | null;
}

export interface PublicScheduleException {
  date: string;
  kind: "closure" | "cancellation" | "exceptional_opening" | "uncertain";
  startTime: string | null;
  endTime: string | null;
}

function parisClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: WEEKDAYS[get("weekday")] ?? 1,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function previousDate(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isDateInRule(date: string, rule: PublicScheduleRule) {
  return (
    (!rule.validFrom || date >= rule.validFrom) &&
    (!rule.validTo || date <= rule.validTo)
  );
}

function isWithinWindow(
  time: string,
  startTime: string | null,
  endTime: string | null,
) {
  if (!startTime || !endTime) return true;
  return time >= startTime.slice(0, 5) && time < endTime.slice(0, 5);
}

export function activityCurrentStatus({
  now,
  manualStatus,
  rules,
  exceptions,
}: {
  now: Date;
  manualStatus: "normal" | "cancelled" | "uncertain";
  rules: PublicScheduleRule[];
  exceptions: PublicScheduleException[];
}): ActivityCurrentStatus {
  if (manualStatus === "cancelled") return "cancelled";
  if (manualStatus === "uncertain") return "uncertain";

  const clock = parisClock(now);
  const todaysExceptions = exceptions.filter(
    (exception) => exception.date === clock.date,
  );
  const activeException = (
    ["uncertain", "cancellation", "closure"] as const
  ).find((kind) =>
    todaysExceptions.some(
      (exception) =>
        exception.kind === kind &&
        isWithinWindow(clock.time, exception.startTime, exception.endTime),
    ),
  );
  if (activeException === "uncertain") return "uncertain";
  if (activeException === "cancellation") return "cancelled";
  if (activeException === "closure") return "closed";

  if (
    todaysExceptions.some(
      (exception) =>
        exception.kind === "exceptional_opening" &&
        isWithinWindow(clock.time, exception.startTime, exception.endTime),
    )
  ) {
    return "open";
  }

  const yesterday = previousDate(clock.date);
  const previousWeekday = clock.weekday === 1 ? 7 : clock.weekday - 1;
  const open = rules.some((rule) => {
    if (
      rule.weekday === clock.weekday &&
      isDateInRule(clock.date, rule) &&
      clock.time >= rule.startTime.slice(0, 5) &&
      (rule.endsNextDay || clock.time < rule.endTime.slice(0, 5))
    ) {
      return true;
    }
    return (
      rule.endsNextDay &&
      rule.weekday === previousWeekday &&
      isDateInRule(yesterday, rule) &&
      clock.time < rule.endTime.slice(0, 5)
    );
  });
  return open ? "open" : "closed";
}

export interface NextOpening {
  /** ISO 8601 weekday (Mon=1 … Sun=7). */
  weekday: number;
  /** Opening time as HH:MM. */
  time: string;
  /** Whole days from today: 0 = later today, 1 = tomorrow, up to 7. */
  daysAhead: number;
}

/**
 * The next moment the activity opens according to its weekly schedule rules,
 * searching today (later than now) through the following seven days. Returns
 * null when no rule opens within a week. Exceptions are not projected forward —
 * they only affect the current day's live status.
 */
export function nextOpening({
  now,
  rules,
}: {
  now: Date;
  rules: PublicScheduleRule[];
}): NextOpening | null {
  const clock = parisClock(now);
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = offset === 0 ? clock.date : addDays(clock.date, offset);
    const weekday = ((clock.weekday - 1 + offset) % 7) + 1;
    const candidates = rules
      .filter(
        (rule) =>
          rule.weekday === weekday &&
          isDateInRule(date, rule) &&
          (offset > 0 || rule.startTime.slice(0, 5) > clock.time),
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const rule = candidates[0];
    if (rule) {
      return { weekday, time: rule.startTime.slice(0, 5), daysAhead: offset };
    }
  }
  return null;
}
