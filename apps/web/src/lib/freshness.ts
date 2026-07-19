const PARIS_TZ = "Europe/Paris";

const WEEKDAYS: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/** Current date in Europe/Paris: ISO date string + ISO weekday (1 = Monday). */
export function parisToday(): { isoDate: string; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    isoDate: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: WEEKDAYS[get("weekday")] ?? 1,
  };
}

export function isSameParisDay(date: Date | null | undefined): boolean {
  if (!date) return false;
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    dateStyle: "short",
  });
  return format.format(date) === format.format(new Date());
}

/**
 * Freshness classification (docs/DESIGN-BRIEF.md §11): the product's core
 * mechanic, computed — never stored — from verification metadata.
 */
export type Freshness = "today" | "current" | "due_soon" | "overdue" | "never";

const DUE_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function freshnessOf(record: {
  lastVerifiedAt: Date | null;
  reviewDueAt: Date | null;
}): Freshness {
  if (!record.lastVerifiedAt) return "never";
  if (isSameParisDay(record.lastVerifiedAt)) return "today";
  if (record.reviewDueAt) {
    const remaining = record.reviewDueAt.getTime() - Date.now();
    if (remaining < 0) return "overdue";
    if (remaining < DUE_SOON_WINDOW_MS) return "due_soon";
  }
  return "current";
}
