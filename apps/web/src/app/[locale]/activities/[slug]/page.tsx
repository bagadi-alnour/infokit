import type { PublicLocale } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PublicActivityDetailView } from "~/components/public/activity-card";
import { ActivityLocationCard } from "~/components/public/activity-location";
import {
  PublicPageHeader,
  PublicSiteShell,
} from "~/components/public/public-site-shell";
import { JsonLd } from "~/components/seo/json-ld";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { metaDescription, publicMetadata } from "~/seo/metadata";
import { activityJsonLd, breadcrumbJsonLd } from "~/seo/structured-data";
import {
  activityDetail,
  activityLabels,
} from "~/server/content/public-activity-payload";
import { loadPublishedActivityBySlug } from "~/server/content/public-content";

interface ActivityDetailPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

/**
 * `generateMetadata` and the page itself need the same record. Caching per
 * request means describing a page costs no extra query — without this every
 * activity page would read the database twice.
 */
const loadActivity = cache(
  async (slug: string, locale: PublicLocale) =>
    await loadPublishedActivityBySlug(slug, locale),
);

export async function generateMetadata({
  params,
}: ActivityDetailPageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale = requirePublicRouteLocale(localeParam);
  const [activity, messages] = await Promise.all([
    loadActivity(slug, locale),
    loadPageCatalog(locale, "public-content"),
  ]);
  // An unpublished slug renders the 404 below; describing it would invite a
  // crawler to index a page that does not exist.
  if (!activity) return {};

  const detail = activityDetail({ activity, locale, messages });
  return publicMetadata({
    path: `/activities/${slug}`,
    locale,
    title: detail.name,
    description: metaDescription(
      detail.shortDescription,
      detail.description,
      messages["activities.description"],
    ),
    image: detail.coverImage,
  });
}

export default async function ActivityDetailPage({
  params,
}: ActivityDetailPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = requirePublicRouteLocale(localeParam);
  const [activity, messages] = await Promise.all([
    loadActivity(slug, locale),
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
      <JsonLd
        data={[
          activityJsonLd({ activity, locale }),
          breadcrumbJsonLd({
            locale,
            trail: [
              { name: messages["public.nav.home"], path: "/" },
              { name: messages["activities.title"], path: "/activities" },
              { name: detail.name, path: `/activities/${slug}` },
            ],
          }),
        ]}
      />
      <PublicPageHeader
        eyebrow={messages["activities.eyebrow"]}
        title={detail.name}
        description={detail.shortDescription}
      />
      <PublicActivityDetailView
        activity={detail}
        labels={activityLabels(messages)}
        location={
          <ActivityLocationCard
            placeName={detail.placeName}
            address={detail.address}
            latitude={detail.latitude}
            longitude={detail.longitude}
            googleMapsHref={detail.googleMapsHref}
            labels={{
              place: messages["activities.place"],
              mapTitle: messages["activities.mapTitle"],
              openInGoogleMaps: messages["activities.openInGoogleMaps"],
              mapAttribution: messages["activities.map.attribution"],
            }}
          />
        }
      />
    </PublicSiteShell>
  );
}
