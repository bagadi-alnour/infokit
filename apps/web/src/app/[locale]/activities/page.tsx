import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";

import { PublicActivitiesExplorer } from "~/components/public/activities-explorer";
import {
  PublicPageHeader,
  PublicSiteShell,
} from "~/components/public/public-site-shell";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { languageAlternates } from "~/i18n/routing";
import {
  activityLabels,
  activitySummaries,
} from "~/server/content/public-activity-payload";
import { listPublishedActivities } from "~/server/content/public-content";

export const metadata: Metadata = {
  title: "Activities",
  alternates: { languages: languageAlternates("/activities") },
};

export default async function ActivitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requirePublicRouteLocale((await params).locale);
  const [activities, messages] = await Promise.all([
    listPublishedActivities(locale),
    loadPageCatalog(locale, "public-content"),
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
      <PublicPageHeader
        eyebrow={messages["activities.eyebrow"]}
        title={messages["activities.title"]}
        description={messages["activities.description"]}
      />
      <PublicActivitiesExplorer
        activities={summaries}
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
