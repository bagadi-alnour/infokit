import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { notFound } from "next/navigation";

import { PublicActivityDetailView } from "~/components/public/activity-card";
import {
  PublicPageHeader,
  PublicSiteShell,
} from "~/components/public/public-site-shell";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import {
  activityDetail,
  activityLabels,
} from "~/server/content/public-activity-payload";
import { loadPublishedActivityBySlug } from "~/server/content/public-content";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: localeParam, slug } = await params;
  const locale = requirePublicRouteLocale(localeParam);
  const [activity, messages] = await Promise.all([
    loadPublishedActivityBySlug(slug, locale),
    loadPageCatalog(locale, "public-content"),
  ]);
  if (!activity) notFound();
  const detail = activityDetail({ activity, locale, messages });

  return (
    <PublicSiteShell
      locale={locale}
      currentPath={`/activities/${slug}`}
      messages={messages}
    >
      <PublicPageHeader
        eyebrow={messages["activities.eyebrow"]}
        title={detail.name}
        description={detail.shortDescription}
      />
      <PublicActivityDetailView
        activity={detail}
        labels={activityLabels(messages)}
      />
    </PublicSiteShell>
  );
}
