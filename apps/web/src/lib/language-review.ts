/**
 * The vocabulary of the per-language review chain, on both sides of the wire.
 *
 * The rules live on the server (`~/server/content/language-review`); what is
 * here is only the shape of the words, because the menu that offers an editor
 * "send this to the platform" has to name the same stages the action writes.
 */

export const reviewEntityKinds = ["editorial_entry", "activity"] as const;
export type ReviewEntityKind = (typeof reviewEntityKinds)[number];

export const languageReviewStages = [
  "none",
  "team_requested",
  "team_validated",
  "platform_requested",
  "platform_verified",
  "changes_requested",
] as const;
export type LanguageReviewStage = (typeof languageReviewStages)[number];

/** Somebody has been asked and has not answered yet. */
export function reviewPending(stage: LanguageReviewStage): boolean {
  return stage === "team_requested" || stage === "platform_requested";
}
