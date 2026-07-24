export type PublicationMode = "draft" | "now" | "scheduled";

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
