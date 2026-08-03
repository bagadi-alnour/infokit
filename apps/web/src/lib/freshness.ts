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

/** Why a record is waiting on an editor — the freshness mechanic, verbatim. */
export type AttentionKind =
  "never" | "overdue" | "uncertain" | "noSchedule" | "dueSoon";

/**
 * The one classifier behind the notification bell, the runbook's attention
 * rail, and the runbook calendar's attention dot. It lives beside `freshnessOf`
 * so those three readings of the same record cannot drift apart.
 */
export function attentionKindOf(record: {
  manualStatus: string | null;
  lastVerifiedAt: Date | null;
  reviewDueAt: Date | null;
  hasSchedule: boolean;
}): AttentionKind | null {
  /**
   * A cancelled record is not running, so there is nothing about it to confirm
   * and it never belongs in the queue — not even when its review date passes.
   *
   * This is checked before anything else because the queue is a list of things
   * an editor can *act on*, and here the only available action made things
   * worse: confirming an occurrence sets `manual_status` back to `normal`
   * (`dashboard/actions.ts`), so the one way to clear the notification was to
   * silently un-cancel the activity. It therefore sat in the bell permanently,
   * which is what "the count never goes down" looked like from outside.
   *
   * Cancelling is still visible where it belongs — on the record and on the
   * public page. What it stops being is a chore.
   */
  if (record.manualStatus === "cancelled") return null;
  if (record.manualStatus === "uncertain") return "uncertain";
  if (!record.hasSchedule) return "noSchedule";
  const freshness = freshnessOf(record);
  if (freshness === "never") return "never";
  if (freshness === "overdue") return "overdue";
  if (freshness === "due_soon") return "dueSoon";
  return null;
}
