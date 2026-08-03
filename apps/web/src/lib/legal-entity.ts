/**
 * Who publishes InfoKit, and on whose machines it runs.
 *
 * French law requires a public site to name its publisher, and the GDPR requires
 * the controller of the data to be reachable — facts about an organisation that
 * no part of the code can know. They live here, in one editable table, rather
 * than inside the legal pages' catalogue text, so settling them is one edit in
 * one file instead of the same address written out in three languages.
 *
 * A fact that is not settled yet stays `null`, and the page says so in the
 * reader's own language: a legal notice is the last place to invent a plausible
 * value (AGENTS.md rule 5).
 */

export interface LegalPublisher {
  /** Registered name of the association or company publishing the service. */
  name: string | null;
  /** "Association loi 1901", "SAS", "SCIC" — as registered. */
  legalForm: string | null;
  /** Whichever number identifies the publisher: RNA (W…), SIREN or SIRET. */
  registration: string | null;
  /** The registered office, on one line, as it would be written on an envelope. */
  address: string | null;
  /** Where a reader, an association or a supervisory authority can write. */
  email: string | null;
  phone: string | null;
  /** Directeur ou directrice de la publication: a named person, not a role. */
  publicationDirector: string | null;
  /**
   * Where a data-protection request goes. Left `null`, the pages fall back to
   * `email`, which is the common case: a small publisher answers both from one
   * address rather than pretending to a separate department.
   */
  dataProtectionEmail: string | null;
}

/**
 * TODO(legal): fill these in before the site is announced publicly. Every value
 * below is a fact somebody has to decide or look up — a registered name, a
 * number from the RNA or SIRENE, an address, an inbox someone reads — and each
 * one that is still `null` is a row the two legal pages render as "not yet
 * published" instead of a fiction.
 */
export const legalPublisher: LegalPublisher = {
  name: null,
  legalForm: null,
  registration: null,
  address: null,
  email: null,
  phone: null,
  publicationDirector: null,
  dataProtectionEmail: null,
};

/** Where a data-protection request should be sent, given what is filled in. */
export function dataProtectionContact(
  publisher: LegalPublisher = legalPublisher,
): string | null {
  return publisher.dataProtectionEmail ?? publisher.email;
}

/** What a provider does for the service; the catalogue holds the wording. */
export type ProviderRole =
  | "hosting"
  | "database"
  | "storage"
  | "messaging"
  | "ai"
  | "maps"
  | "imagery"
  | "geocoding";

/** Where the data sits, as a key the catalogue translates. */
export type ProviderRegion = "france" | "europeanUnion" | "unitedStates";

export interface TechnicalProvider {
  role: ProviderRole;
  /** The company or foundation, named as it names itself. */
  name: string;
  /**
   * `null` where this deployment does not pin one and the code cannot read it
   * back — better an unstated region than a wrong one.
   */
  region: ProviderRegion | null;
}

/**
 * The providers this deployment actually uses, read off its own configuration:
 * `AWS_REGION` (eu-west-3, Paris) governs the database, the asset bucket and
 * the login email and SMS; `AI_TRANSLATION_PROVIDER` and `AI_SPEECH_MODEL` name
 * the model provider; `map-tiles.ts` names the tile sources the browser fetches;
 * `/api/addresses` names the address service the console searches.
 *
 * TODO(legal): confirm the web hosting row — and set its region — against the
 * project's actual deployment before publishing, and add any provider a later
 * slice introduces. A list that is out of date is the one way this page misleads
 * someone reading it in good faith.
 */
export const technicalProviders: TechnicalProvider[] = [
  { role: "hosting", name: "Vercel Inc.", region: null },
  {
    role: "database",
    name: "Amazon Web Services (Amazon RDS)",
    region: "france",
  },
  {
    role: "storage",
    name: "Amazon Web Services (Amazon S3)",
    region: "france",
  },
  {
    role: "messaging",
    name: "Amazon Web Services (Amazon SES, Amazon SNS)",
    region: "france",
  },
  { role: "ai", name: "OpenAI", region: "unitedStates" },
  // The last two are fetched by the reader's own browser, which is why their
  // role labels say so: those providers see the reader's address, not ours.
  { role: "maps", name: "OpenStreetMap Foundation", region: "europeanUnion" },
  { role: "imagery", name: "Esri", region: "unitedStates" },
  {
    role: "geocoding",
    name: "IGN — Géoplateforme (data.geopf.fr)",
    region: "france",
  },
];

/**
 * The day the two legal pages last changed, as a plain date in Europe/Paris —
 * the same wall clock every public date on this site is read in. It is written
 * by hand because it is a claim about an editorial act, not about a deployment:
 * a build that only moves a button must not restamp a legal notice.
 */
export const legalLastUpdated = "2026-08-03";
