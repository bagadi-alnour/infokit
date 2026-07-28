export interface WelcomeFeature {
  title: string;
  body: string;
  /** Short supporting facts. Empty on the page that shows the status ramp. */
  points: string[];
}

export interface WelcomeStrings {
  languageTitle: string;
  /** Carries `{language}` — the phone's language, which starts out selected. */
  languageBody: string;
  /**
   * Carries `{language}`. Replaces `languageBody` as soon as the reader chooses
   * a language other than the phone's, where `languageBody`'s second clause
   * would be claiming the phone's language is the selected one.
   */
  languagePicked: string;
  detected: string;
  scrollHint: string;
  /** Carries `{language}`. */
  continueIn: string;
  skip: string;
  back: string;
  next: string;
  finish: string;
  /** Carries `{step}` and `{total}` — read by screen readers, not displayed. */
  stepOf: string;
  statusLegendLabel: string;
  /**
   * The status vocabulary of docs/DESIGN-SYSTEM.md §6. Repeated here rather
   * than read from a payload because the welcome teaches the ramp offline; the
   * wording follows each language's `activities.status.*` in
   * `packages/shared/src/i18n/messages`, so the four words a reader learns here
   * are the four words the content itself will use.
   */
  statusWords: {
    open: string;
    closed: string;
    uncertain: string;
    cancelled: string;
  };
  /** Words for the three working demonstrations on the feature pages. */
  visuals: {
    now: string;
    dayLabel: string;
    /** Labels the ageing date as an example, not as a real entry (rule 5). */
    example: string;
    checkedToday: string;
    /** Carries `{days}`, always eleven or more — see feature-visuals.tsx. */
    checkedDaysAgo: string;
    stale: string;
    neverAsked: string;
    neverAskedItems: [string, string, string, string];
  };
  features: [WelcomeFeature, WelcomeFeature, WelcomeFeature];
}
