/**
 * The choices an activity offers, in one place.
 *
 * The console asks these questions and the action stores the answers, so both
 * read the tuples from here: an option the form can offer is an option the
 * server accepts, and a renamed value fails typecheck instead of failing a save.
 *
 * This lives outside the server actions because a `use server` module may only
 * export async functions, so shared vocabulary has to sit beside them.
 */

/** How wide an activity's reach is: one city, or everywhere. */
export const activityScopes = ["city", "global"] as const;
export type ActivityScope = (typeof activityScopes)[number];

/**
 * Where the activity happens: at a place already on file, at one the editor is
 * describing now, or nowhere fixed — a helpline, a round, a service that travels.
 */
export const activityLocationModes = ["existing", "new", "mobile"] as const;
export type ActivityLocationMode = (typeof activityLocationModes)[number];

/** RISKS.md R5: how precisely a place may be published. */
export const placePrecisions = [
  "exact",
  "area_only",
  "contact_to_learn",
] as const;
export type PlacePrecision = (typeof placePrecisions)[number];

/** Why a date departs from the usual hours. */
export const scheduleExceptionKinds = [
  "closure",
  "cancellation",
  "exceptional_opening",
  "uncertain",
] as const;
export type ScheduleExceptionKind = (typeof scheduleExceptionKinds)[number];
