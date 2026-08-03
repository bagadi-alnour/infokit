export interface AboutSection {
  title: string;
  body: string;
  /** Short supporting facts. Empty where the paragraph already says it all. */
  points: string[];
}

export interface AboutStrings {
  /** The page's title: the app's sheet header, the site's heading. */
  title: string;
  /** One line under the wordmark: the whole app in a breath. */
  tagline: string;
  /** Who the app is for, and the question it answers. */
  intro: string;
  /**
   * What the platform is not affiliated with, and what it does not help anyone
   * do. It sits directly under the intro rather than beside the other limits at
   * the end, because "who is behind this, and are they with the authorities" is
   * asked before "what can I find" — by a reader deciding whether opening the
   * app is safe, and by anyone checking what the platform claims to be. The same
   * words are the legal notice's opening section (`/legal`), so the answer is
   * worded once and read in all eleven languages wherever it is needed.
   */
  independence: AboutSection;
  what: AboutSection;
  source: AboutSection;
  freshness: AboutSection;
  /**
   * The status ramp. Only the explanations live here: each surface passes the
   * four words it already uses — the app's welcome table, the site's own status
   * labels — so the vocabulary explained on this page is character-for-character
   * the vocabulary the reader meets in the content (docs/DESIGN-SYSTEM.md §6).
   */
  statuses: {
    title: string;
    body: string;
    meanings: {
      open: string;
      closed: string;
      uncertain: string;
      cancelled: string;
    };
  };
  /**
   * The eleven languages. No `points`: the surface lists the languages from
   * `localeMetadata`, each in its own script, which needs no translating.
   */
  languages: AboutSection;
  /**
   * What is never asked for. No `points` either — the items are the ones the
   * surface already promises elsewhere, so the promise is worded once.
   */
  privacy: AboutSection;
  /**
   * How the areas of the platform are kept apart, in detail: what the public
   * area holds, what it can never hold, and how a member reaches the rest. The
   * one section that answers "what could leak" rather than "what can I find".
   */
  security: AboutSection;
  cities: AboutSection;
  /**
   * What the platform does for the organisations themselves — publishing in one
   * place, and one shared agenda to coordinate through. The platform is not only
   * for the people looking for help (docs/PRODUCT.md §1).
   */
  collaboration: AboutSection;
  associations: AboutSection;
  /** The product boundary in plain language: information and coordination, not casework. */
  limits: AboutSection;
  /** Precedes the build's version number. */
  versionLabel: string;
}
