import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { PublicActivitySummary } from "@infokit/shared/public-content";
import type { Metadata } from "next";

import {
  PublicActivitiesExplorer,
  type ActivityFilterEntry,
} from "~/components/public/activities-explorer";
import {
  PublicPageHeader,
  PublicSiteShell,
} from "~/components/public/public-site-shell";
import { JsonLd } from "~/components/seo/json-ld";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { publicMetadata } from "~/seo/metadata";
import { collectionJsonLd } from "~/seo/structured-data";
import {
  activityLabels,
  activitySummaries,
} from "~/server/content/public-activity-payload";
import { listPublishedActivities } from "~/server/content/public-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = requirePublicRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "public-content");
  return publicMetadata({
    path: "/activities",
    locale,
    title: messages["activities.title"],
    description: messages["activities.description"],
  });
}

const statusValues = ["open", "closed", "uncertain", "cancelled"];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The filters a link is allowed to arrive with — a category, a service, a state,
 * and words someone typed — kept only when the published list actually contains
 * them. A stale or hand-typed link therefore opens the full list rather than an
 * empty one with an unnamed filter the reader cannot see to remove.
 *
 * Free text is the exception: it is the reader's own words, arriving from the
 * home page's search box, so it is kept as typed and only bounded in length. It
 * lands in the search field they can see and clear.
 */
function entryFilters(
  summaries: PublicActivitySummary[],
  search: Record<string, string | string[] | undefined>,
): ActivityFilterEntry {
  const category = first(search.category);
  const service = first(search.service);
  const status = first(search.status);
  const q = first(search.q)?.trim().slice(0, 100);
  return {
    // An empty search box is not a filter.
    q: q === "" ? undefined : q,
    category: summaries.some((item) => item.categoryCode === category)
      ? category
      : undefined,
    service: summaries.some((item) =>
      item.services.some((entry) => entry.id === service),
    )
      ? service
      : undefined,
    status: status && statusValues.includes(status) ? status : undefined,
  };
}

export default async function ActivitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = requirePublicRouteLocale((await params).locale);
  const [activities, messages, search] = await Promise.all([
    listPublishedActivities(locale),
    loadPageCatalog(locale, "public-content"),
    searchParams,
  ]);
  // Same presenter the public JSON endpoint uses, so the app and the site show
  // the same words for the same activity.
  const summaries = activitySummaries({ activities, locale, messages });

  return (
    <PublicSiteShell
      locale={locale}
      currentPath="/activities"
      messages={messages}
    >
      <JsonLd
        data={collectionJsonLd({
          locale,
          name: messages["activities.title"],
          description: messages["activities.description"],
          // The published set, not the filtered view: a crawler arriving with
          // a filter in the URL should still describe the whole collection.
          items: summaries.map((summary) => ({
            name: summary.name,
            path: `/activities/${summary.slug}`,
          })),
        })}
      />
      <PublicPageHeader
        eyebrow={messages["activities.eyebrow"]}
        title={messages["activities.title"]}
        description={messages["activities.description"]}
      />
      <PublicActivitiesExplorer
        activities={summaries}
        entry={entryFilters(summaries, search)}
        labels={activityLabels(messages)}
        mapLabels={{
          useLocation: messages["activities.location.use"],
          locating: messages["activities.location.locating"],
          locationPrivacy: messages["activities.location.privacy"],
          locationFound: messages["activities.location.found"],
          locationDenied: messages["activities.location.denied"],
          locationUnavailable: messages["activities.location.unavailable"],
          locationError: messages["activities.location.error"],
          yourLocation: messages["activities.location.you"],
          mapAttribution: messages["activities.map.attribution"],
          mapTitle: messages["activities.mapTitle"],
          mapHint: messages["activities.mapHint"],
          noMap: messages["activities.noMap"],
        }}
      />
    </PublicSiteShell>
  );
}
