import { z } from "zod";

import {
  hasScheduleRuleOverlap,
  type WeeklyScheduleInterval,
} from "~/lib/schedule-overlap";

/**
 * The vocabulary of opening hours, in one place.
 *
 * The client forms validate a schedule before posting it and the server actions
 * validate it again on arrival. Sharing the enums, the time format and the
 * cross-row rules keeps those two answers identical: the editor sees the
 * problem inline, and a tampered or stale post still fails the same way.
 *
 * This lives outside the server actions on purpose — a `use server` module may
 * only export async functions, so shared vocabulary has to sit beside them.
 */

export const scheduleTypes = ["recurring", "one_off"] as const;
export type ScheduleType = (typeof scheduleTypes)[number];

export const scheduleTimingModes = ["fixed", "flexible"] as const;
export type ScheduleTimingMode = (typeof scheduleTimingModes)[number];

export const scheduleTypeSchema = z.enum(scheduleTypes);
export const scheduleTimingModeSchema = z.enum(scheduleTimingModes);

/** ISO weekday, Monday first — what `scheduleRules.weekday` stores. */
export const weekdayNumbers = [1, 2, 3, 4, 5, 6, 7] as const;

/** A weekday arriving from `FormData`, where every value is a string. */
export const weekdayNumberSchema = z.coerce.number().int().min(1).max(7);

/** A weekday as a form control holds it, so client values stay strings. */
export const weekdayValueSchema = z.string().regex(/^[1-7]$/);

/** `HH:MM`, exactly what an `<input type="time">` reports. */
export const timeOfDayPattern = /^([01]\d|2[0-3]):[0-5]\d$/;

/** One row of opening hours as `FormData` carries it. */
export const scheduleRowSchema = z.object({
  weekday: weekdayNumberSchema,
  timingMode: scheduleTimingModeSchema,
  startTime: z.string().regex(timeOfDayPattern),
  endTime: z.string().regex(timeOfDayPattern),
});

/** The mistakes a set of opening hours can make, as a catalog-key suffix. */
export type ScheduleIssue = "invalidRange" | "overlap";

/** The first mistake in a set of hours, and which row made it. */
export type ScheduleRowProblem = { issue: ScheduleIssue; index: number };

/**
 * Check a set of hours the way both the form and the action need it checked.
 *
 * Rows are compared against each other as well as against `existingRules`,
 * because two new rows can collide before either reaches the database. A
 * one-off date carries no weekday, so overlap does not apply to it — only the
 * range check does.
 *
 * The row is named because a form that edits several at once has to put the
 * message on the one that is wrong; a caller judging the whole set can use
 * `scheduleRowsIssue` below instead.
 */
export function scheduleRowProblem(
  scheduleType: ScheduleType,
  rows: readonly WeeklyScheduleInterval[],
  existingRules: readonly WeeklyScheduleInterval[] = [],
): ScheduleRowProblem | null {
  for (const [index, row] of rows.entries()) {
    // Hours that run past midnight legitimately end "before" they start.
    if (!row.endsNextDay && row.startTime >= row.endTime) {
      return { issue: "invalidRange", index };
    }
  }

  if (scheduleType === "one_off") {
    return null;
  }

  for (const [index, row] of rows.entries()) {
    if (
      hasScheduleRuleOverlap(row, [...existingRules, ...rows.slice(0, index)])
    ) {
      return { issue: "overlap", index };
    }
  }

  return null;
}

/** The same answer for a caller that rejects the set rather than a row. */
export function scheduleRowsIssue(
  scheduleType: ScheduleType,
  rows: readonly WeeklyScheduleInterval[],
  existingRules: readonly WeeklyScheduleInterval[] = [],
): ScheduleIssue | null {
  return scheduleRowProblem(scheduleType, rows, existingRules)?.issue ?? null;
}
