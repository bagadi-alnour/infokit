import type { ChipTone } from "~/components/admin/workspace";

/**
 * The states a content record can be found in, and the colour each one wears.
 * The list is also what the status filter offers, so a state added here reaches
 * the table's header menu without anyone having to remember it twice. Plain
 * module on purpose: a server page and a client table both read from it.
 */

/**
 * An activity's state is derived, not stored: a manual override answers first,
 * then whether any language is live or waiting for its moment.
 */
export const ACTIVITY_STATES = [
  "published",
  "scheduled",
  "draft",
  "cancelled",
  "uncertain",
] as const;

export type ActivityStateValue = (typeof ACTIVITY_STATES)[number];

export const activityStateTone: Record<ActivityStateValue, ChipTone> = {
  published: "ok",
  scheduled: "accent",
  draft: "neutral",
  cancelled: "danger",
  uncertain: "warn",
};

/** An article's workflow state, plus the two states publication puts it in. */
export const ARTICLE_STATES = [
  "draft",
  "in_review",
  "published",
  "scheduled",
  "unpublished",
  "archived",
] as const;

export type ArticleStateValue = (typeof ARTICLE_STATES)[number];

export const articleStateTone: Record<ArticleStateValue, ChipTone> = {
  draft: "neutral",
  in_review: "warn",
  published: "ok",
  scheduled: "accent",
  // Taken down and archived are both "not public", and neither is a fault.
  unpublished: "neutral",
  archived: "neutral",
};

/**
 * A simulator path's state: the status of the version a visitor would reach, or
 * that the path is out of the workspace altogether. Versions are immutable, so
 * "retired" is what a published version becomes when a newer one replaces it.
 */
export const SIMULATOR_STATES = [
  "draft",
  "published",
  "retired",
  "archived",
] as const;

export type SimulatorStateValue = (typeof SIMULATOR_STATES)[number];

export const simulatorStateTone: Record<SimulatorStateValue, ChipTone> = {
  draft: "neutral",
  published: "ok",
  retired: "neutral",
  archived: "neutral",
};
