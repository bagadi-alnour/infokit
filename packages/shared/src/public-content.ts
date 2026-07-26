/**
 * Data contracts for the public reading surfaces (web pages and the mobile
 * app). They live in @infokit/shared because both surfaces render the same
 * server-prepared payloads: every string is already localized and formatted by
 * the server, so a client never formats a date or picks a translation.
 */

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
  lastVerifiedLabel: string;
  scheduleLabels: string[];
  coverImage: PublicContentImage | null;
}

/** A single activity page: the summary plus the long-form authored fields. */
export interface PublicActivityDetail extends PublicActivitySummary {
  description: string;
  instructions: string;
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
  fallback: string;
  open: string;
  mapTitle: string;
  mapHint: string;
  noMap: string;
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

export interface PublicArticleSummary {
  id: string;
  href: string;
  title: string;
  summary: string;
  articleDateLabel: string;
  ownerNames: string[];
  lastReviewedLabel: string;
  fallbackUsed: boolean;
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
  unreliable: boolean;
  unreliableFromLabel: string;
  coverImage: PublicContentImage | null;
}

export interface PublicArticleLabels {
  empty: string;
  read: string;
  publishedBy: string;
  lastReviewed: string;
  fallback: string;
  unreliable: string;
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
