import type { PublicLocale } from "@infokit/shared/i18n";
import { publicSupportedLocales } from "@infokit/shared/i18n";

import {
  listPublicCoordinationEvents,
  type CoordinationEventRecord,
} from "~/server/content/coordination-events";
import {
  listPublishedActivities,
  listPublishedArticleRoutes,
  listPublishedOrganizations,
} from "~/server/content/public-content";
import { listPublishedSimulators } from "~/server/content/public-simulator";

/**
 * Every URL the public site is willing to have indexed.
 *
 * The sitemap is a claim about what exists, so it is assembled from the public
 * read model and nothing else: an unpublished activity, an unverified
 * organisation or a draft article is absent here for the same reason it is
 * absent from the site. Anything a crawler should reach but not index — the
 * simulator previews, the console, the sign-in flow — belongs in `robots.ts`
 * instead and never appears below.
 */

export type ChangeFrequency = "daily" | "weekly" | "monthly" | "yearly";

export interface PublicRouteEntry {
  /**
   * The path in each public locale, locale segment excluded. One page's eleven
   * URLs are one entry, so the sitemap can list them as alternates of each
   * other rather than as eleven unrelated pages.
   */
  paths: Record<PublicLocale, string>;
  /** When the content behind the page last changed, where the record says. */
  lastModified?: Date;
  changeFrequency: ChangeFrequency;
  priority: number;
}

/** A path that reads the same in every language. */
function everywhere(path: string): Record<PublicLocale, string> {
  return Object.fromEntries(
    publicSupportedLocales.map((locale) => [locale, path]),
  ) as Record<PublicLocale, string>;
}

/**
 * The pages that exist whatever the database holds. Priorities rank them
 * against each other only: the four content surfaces are what someone arrives
 * looking for, and `/about` explains the site rather than helping anyone today.
 */
const FIXED_ROUTES: Array<{
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/activities", changeFrequency: "daily", priority: 0.9 },
  { path: "/events", changeFrequency: "daily", priority: 0.8 },
  { path: "/articles", changeFrequency: "weekly", priority: 0.8 },
  { path: "/simulator", changeFrequency: "weekly", priority: 0.7 },
  { path: "/about", changeFrequency: "monthly", priority: 0.4 },
  // Indexed, and last: an app store and a reader checking who publishes this
  // both need to reach them by URL, and neither is what anyone searched for.
  { path: "/legal", changeFrequency: "yearly", priority: 0.2 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
];

/** The most recent of a set of stamps, ignoring the ones nothing recorded. */
function latest(
  ...stamps: Array<Date | string | null | undefined>
): Date | undefined {
  const times = stamps
    .flatMap((stamp) => (stamp ? [new Date(stamp).getTime()] : []))
    .filter((time) => Number.isFinite(time));
  return times.length > 0 ? new Date(Math.max(...times)) : undefined;
}

export async function listPublicRoutes(): Promise<PublicRouteEntry[]> {
  // French is the source language every other locale falls back to, so it is
  // the list guaranteed to contain every published record. Slugs are shared
  // across languages for all of these — articles are the exception, and carry
  // their own per-locale paths below.
  const [activities, articles, organizations, simulators, events] =
    await Promise.all([
      listPublishedActivities("fr"),
      listPublishedArticleRoutes(),
      listPublishedOrganizations(),
      listPublishedSimulators("fr"),
      listPublicCoordinationEvents({ locale: "fr", from: new Date() }),
    ]);

  return [
    ...FIXED_ROUTES.map((route) => ({
      paths: everywhere(route.path),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    // An activity page answers "can I eat today", so its hours and its state
    // change more often than its text: verification is the honest stamp.
    ...activities.map((activity) => ({
      paths: everywhere(`/activities/${activity.slug}`),
      lastModified: latest(activity.lastVerifiedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...articles.map((article) => ({
      paths: Object.fromEntries(
        publicSupportedLocales.map((locale) => [
          locale,
          `/articles/${article.slugs[locale]}`,
        ]),
      ) as Record<PublicLocale, string>,
      lastModified: article.lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...simulators.map(({ document }) => ({
      paths: everywhere(`/simulator/${document.slug}`),
      lastModified: latest(document.lastReviewedAt, document.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...organizations.map((organization) => ({
      paths: everywhere(`/organizations/${organization.slug}`),
      lastModified: organization.lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    // Only what is still to come. A past event keeps its page for anyone
    // holding the link, but announcing it invites a crawl of something that
    // cannot be attended.
    ...events.map((event: CoordinationEventRecord) => ({
      paths: everywhere(`/events/${event.id}`),
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
  ];
}
