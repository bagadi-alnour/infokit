import type { LanguageReviewStage } from "~/lib/language-review";

/**
 * What saving a newly written record does with it. `team` and `platform` ask
 * somebody to read it first (see `server/content/language-review.ts`); only
 * `now` and `scheduled` reach the public.
 */
export type PublicationMode =
  "draft" | "team" | "platform" | "now" | "scheduled";

/** Whether this choice puts the text in front of readers. */
export function publishesOnSave(mode: PublicationMode): boolean {
  return mode === "now" || mode === "scheduled";
}

/**
 * The stage a create-time choice asks for, or null where it asks nobody. The
 * team read is skippable and the platform's is not, so choosing `platform`
 * outright is the ordinary path for a record that is ready.
 */
export function requestedReviewStage(
  mode: PublicationMode,
): LanguageReviewStage | null {
  if (mode === "team") return "team_requested";
  if (mode === "platform") return "platform_requested";
  return null;
}

export function parseScheduledPublication(
  mode: PublicationMode,
  value: string | null,
  now = new Date(),
) {
  if (mode !== "scheduled") return null;
  const scheduledFor = value ? new Date(value) : null;
  if (!scheduledFor || Number.isNaN(scheduledFor.getTime())) {
    throw new Error("Choose a valid publication date and time");
  }
  if (scheduledFor <= now) {
    throw new Error("The scheduled publication time must be in the future");
  }
  return scheduledFor;
}

export function isScheduledPublication(
  scheduledFor: Date | null,
  now = new Date(),
) {
  return scheduledFor !== null && scheduledFor > now;
}
