import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { type PublicActivitySummary } from "@calais/ui";
import { notFound } from "next/navigation";

import { PublicActivityCardDetail } from "~/components/public/activity-map";
import {
  PublicPageHeader,
  PublicSiteShell,
} from "~/components/public/public-site-shell";
import {
  fallbackLabel,
  mapHref,
  nextOpeningLabel,
  organizationHref,
} from "~/lib/activity-presentation";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { loadPublishedActivityBySlug } from "~/server/content/public-content";

function scheduleLabel(
  schedule: {
    weekday: number;
    startTime: string;
    endTime: string;
    endsNextDay: boolean;
  },
  locale: string,
) {
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2024, 0, schedule.weekday)));
  return `${weekday} ${schedule.startTime.slice(0, 5)}–${schedule.endTime.slice(0, 5)}`;
}

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
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Europe/Paris",
  });
  const summary: PublicActivitySummary & {
    description: string;
    instructions: string;
    audienceLabel: string;
  } = {
    id: activity.id,
    slug: activity.slug,
    href: localizedPath(`/activities/${activity.slug}`, locale),
    name: activity.name,
    shortDescription: activity.shortDescription,
    description: activity.description,
    instructions: activity.instructions,
    categoryCode: activity.categoryCode,
    categoryLabel: activity.categoryLabel,
    categoryIcon: activity.categoryIcon,
    audienceCode: activity.audienceCode,
    audienceLabel: activity.audienceLabel,
    services: activity.services,
    providerNames: activity.providerNames,
    providers: activity.providers.map((provider) => ({
      name: provider.name,
      href: organizationHref(provider.slug, locale),
    })),
    placeName:
      activity.placeName ||
      (activity.precision === "contact_to_learn"
        ? messages["activities.contactForPlace"]
        : messages["activities.areaOnly"]),
    address: activity.address,
    mapHref: mapHref({
      address: activity.address,
      latitude: activity.latitude,
      longitude: activity.longitude,
    }),
    latitude: activity.latitude,
    longitude: activity.longitude,
    status: activity.status,
    nextOpeningLabel: nextOpeningLabel({
      messages,
      locale,
      opening: activity.nextOpening,
    }),
    fallbackUsed: activity.fallbackUsed,
    fallbackLabel: fallbackLabel({
      messages,
      locale,
      contentLanguage: activity.contentLanguage,
    }),
    lastVerifiedLabel: activity.lastVerifiedAt
      ? dateFormatter.format(activity.lastVerifiedAt)
      : messages["public.notAvailable"],
    scheduleLabels:
      activity.schedules.length > 0
        ? activity.schedules.map((schedule) => scheduleLabel(schedule, locale))
        : [messages["activities.confirmSchedule"]],
    coverImage: activity.coverImage,
  };

  return (
    <PublicSiteShell
      locale={locale}
      currentPath={`/activities/${slug}`}
      messages={messages}
    >
      <PublicPageHeader
        eyebrow={messages["activities.eyebrow"]}
        title={summary.name}
        description={summary.shortDescription}
      />
      <PublicActivityCardDetail
        activity={summary}
        labels={{
          search: messages["activities.search"],
          categoryFilter: messages["activities.filter.category"],
          allCategories: messages["activities.allCategories"],
          audienceFilter: messages["activities.filter.audience"],
          allAudiences: messages["activities.allAudiences"],
          serviceFilter: messages["activities.filter.services"],
          allServices: messages["activities.allServices"],
          statusFilter: messages["activities.filter.status"],
          allStatuses: messages["activities.allStatuses"],
          filters: messages["activities.filters"],
          clearAll: messages["activities.clearAll"],
          listView: messages["activities.listView"],
          mapView: messages["activities.mapView"],
          results: messages["activities.results"],
          empty: messages["activities.empty"],
          provider: messages["activities.provider"],
          services: messages["activities.services"],
          place: messages["activities.place"],
          schedule: messages["activities.schedule"],
          lastVerified: messages["activities.lastVerified"],
          fallback: messages["public.fallback"],
          open: messages["activities.open"],
          mapTitle: messages["activities.mapTitle"],
          mapHint: messages["activities.mapHint"],
          noMap: messages["activities.noMap"],
          statusOpen: messages["activities.status.open"],
          statusClosed: messages["activities.status.closed"],
          statusCancelled: messages["activities.status.cancelled"],
          statusUncertain: messages["activities.status.uncertain"],
          audience: messages["activities.audience"],
          instructions: messages["activities.instructions"],
        }}
      />
    </PublicSiteShell>
  );
}
