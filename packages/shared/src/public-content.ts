/**
 * Data contracts for the public reading surfaces (web pages and the mobile
 * app). They live in @infokit/shared because both surfaces render the same
 * server-prepared payloads: every string is already localized and formatted by
 * the server, so a client never formats a date or picks a translation.
 */
import type {
  PublicSimulatorDocument,
  PublicSimulatorLabels,
} from "./public-simulator";

export interface PublicContentImage {
  url: string;
  alt: string;
  decorative: boolean;
}

/** The four status roles of docs/DESIGN-SYSTEM.md §6. */
export type PublicActivityStatus =
  "open" | "closed" | "cancelled" | "uncertain";

export interface PublicActivityService {
  id: string;
  label: string;
  icon: string;
}

export interface PublicActivityProvider {
  name: string;
  href: string;
}

/**
 * One way in on public transport, for a reader who is deciding whether they can
 * get there at all.
 *
 * The mode arrives twice on purpose. `modeLabel` is the word — already in the
 * reader's language, because "bus" is not a word everybody knows in French —
 * and `mode` is the stable key a client picks an icon by, never shown as text.
 * The line and the stop are the network's own names, left exactly as they are
 * printed on the pole: a stop nobody can read out to a driver is no help.
 */
export interface PublicTransitLink {
  mode:
    "bus" | "tram" | "metro" | "train" | "coach" | "ferry" | "bike" | "other";
  modeLabel: string;
  line: string | null;
  stopName: string | null;
  /** "4 min walk", localized. Null when nobody has measured the walk. */
  walkLabel: string | null;
  /** The whole row on one line, for a surface with no room for the parts. */
  label: string;
}

export interface PublicActivitySummary {
  id: string;
  slug: string;
  href: string;
  name: string;
  shortDescription: string;
  categoryCode: string;
  categoryLabel: string;
  categoryIcon: string;
  audienceCode: string;
  audienceLabel: string;
  services: PublicActivityService[];
  providerNames: string[];
  /** Providers with a link to their public organisation page. */
  providers: PublicActivityProvider[];
  placeName: string;
  address: string;
  /** External map link for the address, or null when no exact location. */
  mapHref: string | null;
  latitude: number | null;
  longitude: number | null;
  status: PublicActivityStatus;
  /** Localized "opens next …" line, shown when currently closed. */
  nextOpeningLabel: string | null;
  fallbackUsed: boolean;
  /** Localized fallback notice with the content language name filled in. */
  fallbackLabel: string;
  /**
   * How long ago the check was — "3 days ago". A reader deciding whether to walk
   * across a town judges a verification by its age, and a calendar date makes
   * them subtract today from it first.
   */
  lastVerifiedLabel: string;
  /** The same check as a date in the city's clock — every claim stays dated. */
  lastVerifiedDateLabel: string;
  /** The instant itself, for a `<time>` element. Null when never verified. */
  lastVerifiedIso: string | null;
  scheduleLabels: string[];
  /**
   * The same week on one line — "Mon–Fri 13:00–17:00" — for the shelves that
   * show an activity beside others rather than on its own page. Days that share
   * their hours are collapsed by the server, in the reader's language.
   */
  scheduleSummary: string;
  coverImage: PublicContentImage | null;
}

/** A single activity page: the summary plus the long-form authored fields. */
export interface PublicActivityDetail extends PublicActivitySummary {
  description: string;
  instructions: string;
  /**
   * How to get there without a car, in the order the editors listed. Empty when
   * nobody has recorded it — never guessed from the address. Carried by the
   * detail only: a card is for choosing between activities, and the journey
   * matters once one has been chosen.
   */
  transit: PublicTransitLink[];
  /**
   * The place on Google Maps, for the walking directions a reader leaves with.
   * Only the single-activity surfaces carry it — a shelf of cards is for
   * choosing, not for setting off. Null when the place is an area only.
   */
  googleMapsHref: string | null;
}

export interface PublicActivityLabels {
  search: string;
  categoryFilter: string;
  allCategories: string;
  audienceFilter: string;
  allAudiences: string;
  serviceFilter: string;
  allServices: string;
  statusFilter: string;
  allStatuses: string;
  filters: string;
  clearAll: string;
  listView: string;
  mapView: string;
  results: string;
  empty: string;
  provider: string;
  services: string;
  place: string;
  schedule: string;
  lastVerified: string;
  open: string;
  /** Hand this activity to someone else — the device's own share sheet. */
  share: string;
  /** Said after the link went to the clipboard instead of a share sheet. */
  shareCopied: string;
  /** Save the page as a sheet of paper or a file. */
  downloadPdf: string;
  /** Hand the place to the maps app most of these phones already have. */
  openInGoogleMaps: string;
  mapTitle: string;
  mapHint: string;
  noMap: string;
  /** Heading over the transport links — "Getting here". */
  gettingHere: string;
  statusOpen: string;
  statusClosed: string;
  statusCancelled: string;
  statusUncertain: string;
  audience?: string;
  instructions?: string;
}

/** Page-level chrome for an activities screen, localized by the server. */
export interface PublicActivityPageLabels {
  eyebrow: string;
  title: string;
  description: string;
  /** Standing reminder that opening times move and cards carry a date. */
  freshnessNotice: string;
}

/**
 * What the public activities endpoint returns: the same payload the web page
 * renders server-side, plus the labels that go with it, so a native client can
 * draw the screen without carrying an interface catalogue of its own.
 */
export interface PublicActivityListPayload {
  locale: string;
  /** "rtl" for ar, fa, prs, ps, ckb — the client mirrors its own layout. */
  direction: "ltr" | "rtl";
  activities: PublicActivitySummary[];
  labels: PublicActivityLabels;
  page: PublicActivityPageLabels;
}

export interface PublicActivityDetailPayload {
  locale: string;
  direction: "ltr" | "rtl";
  activity: PublicActivityDetail;
  labels: PublicActivityLabels;
  page: PublicActivityPageLabels;
}

/**
 * One organisation's public profile: who they are, in their own published
 * words. Only verified organisations that have published a profile ever reach a
 * reader, and the text falls back to French before it falls back to nothing —
 * `fallbackLabel` names the language it is actually being read in.
 */
export interface PublicOrganizationProfile {
  slug: string;
  href: string;
  name: string;
  purpose: string;
  goals: string | null;
  values: string | null;
  website: string | null;
  /** The founding year in the reader's own digits, or null when unknown. */
  foundedLabel: string | null;
  fallbackUsed: boolean;
  /** Localized fallback notice with the content language name filled in. */
  fallbackLabel: string;
}

export interface PublicOrganizationLabels {
  eyebrow: string;
  purpose: string;
  goals: string;
  values: string;
  website: string;
  founded: string;
  /** Heading over what this organisation runs. */
  activities: string;
  /** Said plainly when nothing of theirs is published — never an empty page. */
  activitiesEmpty: string;
  backToActivities: string;
}

/**
 * An organisation page: the profile, and everything published that they run.
 * The activities arrive as the same summaries the list screens draw, so a card
 * here is the card the reader already knows.
 */
export interface PublicOrganizationDetailPayload {
  locale: string;
  direction: "ltr" | "rtl";
  organization: PublicOrganizationProfile;
  activities: PublicActivitySummary[];
  labels: PublicOrganizationLabels;
  /** The activity vocabulary, so those cards read as they do everywhere else. */
  activityLabels: PublicActivityLabels;
}

export interface PublicArticleSummary {
  id: string;
  href: string;
  title: string;
  summary: string;
  articleDateLabel: string;
  ownerNames: string[];
  lastReviewedLabel: string;
  fallbackUsed: boolean;
  /** Localized fallback notice with the content language name filled in. */
  fallbackLabel: string;
  unreliable: boolean;
  coverImage: PublicContentImage | null;
}

export interface PublicArticleDetail {
  title: string;
  summary: string;
  body: string;
  articleDateLabel: string;
  lastReviewedLabel: string;
  ownerNames: string[];
  fallbackUsed: boolean;
  /** Localized fallback notice with the content language name filled in. */
  fallbackLabel: string;
  unreliable: boolean;
  unreliableFromLabel: string;
  coverImage: PublicContentImage | null;
}

export interface PublicArticleLabels {
  empty: string;
  read: string;
  publishedBy: string;
  lastReviewed: string;
  unreliable: string;
}

/** Page chrome for an articles screen, localized by the server. */
export interface PublicArticlePageLabels {
  eyebrow: string;
  title: string;
  description: string;
}

export interface PublicArticleListPayload {
  locale: string;
  direction: "ltr" | "rtl";
  articles: PublicArticleSummary[];
  labels: PublicArticleLabels;
  page: PublicArticlePageLabels;
}

export interface PublicArticleDetailPayload {
  locale: string;
  direction: "ltr" | "rtl";
  article: PublicArticleDetail;
  labels: PublicArticleLabels;
}

/**
 * The three reaches of the shared agenda (docs/DATABASE-SCHEMA.md §13). The
 * server decides which of them a reader may see; a client only ever renders the
 * word that comes with the event.
 */
export type PublicEventReach = "organization" | "inter_organization" | "public";

/**
 * One event of the agenda, dated and placed by the server in the city's own
 * clock. `reachLabel` is the plain-words tier — colour is never the only
 * signal (docs/DESIGN-SYSTEM.md §6).
 */
export interface PublicEventSummary {
  id: string;
  href: string;
  title: string;
  description: string | null;
  /** Sortable day key in the city's timezone, "2026-07-26". */
  dayKey: string;
  /** Last day the event runs, for the multi-day rows of a month grid. */
  endDayKey: string;
  dateLabel: string;
  timeLabel: string;
  /** Start only, for a calendar chip that has no room for a range. */
  chipTimeLabel: string;
  allDay: boolean;
  whereLabel: string | null;
  mapHref: string | null;
  /** How to get there on public transport; empty when nobody recorded it. */
  transit: PublicTransitLink[];
  cityName: string;
  hostName: string | null;
  hostHref: string | null;
  contactLabel: string | null;
  contactValue: string | null;
  cancelled: boolean;
  cancellationReason: string | null;
  /** Add-to-calendar link (ICS); member events carry the same route. */
  icsHref: string;
  reach: PublicEventReach;
  reachLabel: string;
  coverImage: PublicContentImage | null;
}

export interface PublicEventLabels {
  empty: string;
  emptyPast: string;
  upcoming: string;
  past: string;
  when: string;
  where: string;
  city: string;
  /** Heading over the transport links — "Getting here". */
  gettingHere: string;
  host: string;
  platform: string;
  contact: string;
  allDay: string;
  cancelled: string;
  cancelledNoReason: string;
  addToCalendar: string;
  openMap: string;
  checkBefore: string;
  details: string;
  notAvailable: string;
  /** Weekday initials of the month grid, Monday first. */
  weekdayInitials: string[];
  monthLabel: string;
  previousMonth: string;
  nextMonth: string;
  today: string;
}

export interface PublicEventPageLabels {
  eyebrow: string;
  title: string;
  description: string;
  /** "This is an agenda, not a service list" — with the link's own words. */
  occasional: string;
  occasionalLink: string;
}

export interface PublicEventListPayload {
  locale: string;
  direction: "ltr" | "rtl";
  /** Today in the first city's clock, so a client highlights the right cell. */
  todayKey: string;
  /** The month a grid opens on, "2026-07" — `labels.monthLabel` names it. */
  month: string;
  upcoming: PublicEventSummary[];
  past: PublicEventSummary[];
  labels: PublicEventLabels;
  page: PublicEventPageLabels;
}

export interface PublicEventDetailPayload {
  locale: string;
  direction: "ltr" | "rtl";
  event: PublicEventSummary;
  labels: PublicEventLabels;
}

/** One organisation this reader belongs to, as the account sheet shows it. */
export interface MemberOrganization {
  id: string;
  name: string;
  verified: boolean;
  /** Localized "Verified organisation" / "Not verified yet". */
  statusLabel: string;
  /** Why the state matters for what they can read. */
  statusHint: string;
}

export interface MemberLabels {
  agendaTitle: string;
  agendaDescription: string;
  /** Segmented filter over the reaches, in the order a client shows them. */
  filterAll: string;
  filterOwn: string;
  filterShared: string;
  filterPublic: string;
  empty: string;
  whoSees: string;
  reachOrganization: string;
  reachInterOrganization: string;
  reachPublic: string;
  reachOrganizationHint: string;
  reachInterOrganizationHint: string;
  reachPublicHint: string;
  organizations: string;
  organizationVerified: string;
  organizationVerifiedHint: string;
  organizationPending: string;
  organizationPendingHint: string;
  readOnly: string;
  signOut: string;
  sessionEnds: string;
  account: string;
}

/**
 * The words on the members' door — the only member strings a signed-out client
 * needs, so they travel with the "nobody is signed in" answer rather than being
 * baked into a build.
 */
export interface MemberDoorLabels {
  doorTitle: string;
  doorBody: string;
  signInTitle: string;
  signInBody: string;
  signInButton: string;
  signInPrivacy: string;
  signInCancelled: string;
  signInFailed: string;
}

/** Who is signed in, and what the app may offer them. */
export interface MemberIdentityPayload {
  locale: string;
  direction: "ltr" | "rtl";
  userId: string;
  email: string;
  displayName: string;
  /** Two letters for the header button, computed by the server. */
  initials: string;
  organizations: MemberOrganization[];
  /** Reads every tier — a platform steward (docs/DATABASE-SCHEMA.md §13). */
  platformSteward: boolean;
  /** When this device session expires, already worded for the reader. */
  sessionEndsLabel: string;
  labels: MemberLabels;
}

/**
 * The one answer to "who is reading this device": an identity, or the door with
 * the words to open it. Never cached — a session is not a public fact.
 */
export type MemberSessionPayload =
  | ({ signedIn: true } & MemberIdentityPayload)
  | {
      signedIn: false;
      locale: string;
      direction: "ltr" | "rtl";
      door: MemberDoorLabels;
    };

export interface MemberAgendaPayload {
  locale: string;
  direction: "ltr" | "rtl";
  todayKey: string;
  month: string;
  events: PublicEventSummary[];
  labels: PublicEventLabels;
  member: MemberLabels;
}

export interface MemberEventPayload {
  locale: string;
  direction: "ltr" | "rtl";
  event: PublicEventSummary;
  labels: PublicEventLabels;
  member: MemberLabels;
}

export interface PublicSimulatorSummary {
  id: string;
  href: string;
  title: string;
  summary: string;
  cityLabel: string;
  lastReviewedLabel: string;
  sourceLanguageLabel: string;
}

export interface PublicSimulatorCollectionLabels {
  empty: string;
  open: string;
  city: string;
  lastReviewed: string;
  sourceLanguage: string;
  privacy: string;
}

export interface PublicGuidePageLabels {
  eyebrow: string;
  title: string;
  description: string;
}

export interface PublicGuideListPayload {
  locale: string;
  direction: "ltr" | "rtl";
  guides: PublicSimulatorSummary[];
  labels: PublicSimulatorCollectionLabels;
  page: PublicGuidePageLabels;
}

/**
 * One guide, flattened. The document is the graph the client walks; the two
 * date labels are formatted here because a reader judges a guide by how
 * recently it was checked.
 */
export interface PublicGuideDetailPayload {
  locale: string;
  direction: "ltr" | "rtl";
  document: PublicSimulatorDocument;
  labels: PublicSimulatorLabels;
  lastReviewedLabel: string;
  reviewDueLabel: string;
}
