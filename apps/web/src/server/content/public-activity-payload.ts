/**
 * One presenter for the public activity payloads. The web pages and the public
 * JSON endpoints both read it, so a visitor on the phone app and a visitor on
 * the site see the same words for the same activity: every string here is
 * already localized and formatted, and no client picks a translation or formats
 * a date (`@infokit/shared/public-content`).
 */
import { localeMetadata, type PublicLocale } from "@infokit/shared/i18n";
import {
  loadPageCatalog,
  type PageCatalog,
} from "@infokit/shared/i18n/catalogs";
import type {
  PublicActivityDetail,
  PublicActivityDetailPayload,
  PublicActivityLabels,
  PublicActivityListPayload,
  PublicActivityPageLabels,
  PublicActivitySummary,
} from "@infokit/shared/public-content";

import {
  fallbackLabel,
  mapHref,
  nextOpeningLabel,
  organizationHref,
} from "~/lib/activity-presentation";
import { localizedPath } from "~/i18n/routing";
import {
  listPublishedActivities,
  loadPublishedActivityBySlug,
  type PublishedActivity,
} from "~/server/content/public-content";

/** The public-content catalogue: every key below is typed, not guessed. */
type Messages = PageCatalog<"public-content">;

function scheduleLabel(
  schedule: PublishedActivity["schedules"][number],
  locale: string,
) {
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2024, 0, schedule.weekday)));
  return `${weekday} ${schedule.startTime.slice(0, 5)}–${schedule.endTime.slice(0, 5)}`;
}

/** The label set the activity list and detail views need, in reading order. */
export function activityLabels(messages: Messages): PublicActivityLabels {
  return {
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
  };
}

/** Page chrome, for clients that draw the whole screen from the payload. */
export function activityPageLabels(
  messages: Messages,
): PublicActivityPageLabels {
  return {
    eyebrow: messages["activities.eyebrow"],
    title: messages["activities.title"],
    description: messages["activities.description"],
    freshnessNotice: messages["activities.freshnessNotice"],
  };
}

function summarize({
  activity,
  locale,
  messages,
  dateFormatter,
}: {
  activity: PublishedActivity;
  locale: PublicLocale;
  messages: Messages;
  dateFormatter: Intl.DateTimeFormat;
}): PublicActivitySummary {
  return {
    id: activity.id,
    slug: activity.slug,
    href: localizedPath(`/activities/${activity.slug}`, locale),
    name: activity.name,
    shortDescription: activity.shortDescription,
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
    // An empty place name is a deliberate state, not missing data: the place is
    // an area only, or the visitor has to contact the team to learn where.
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
}

function dateFormatterFor(locale: PublicLocale) {
  // Wall-clock Europe/Paris is the contract for every public date.
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Europe/Paris",
  });
}

export function activitySummaries({
  activities,
  locale,
  messages,
}: {
  activities: PublishedActivity[];
  locale: PublicLocale;
  messages: Messages;
}): PublicActivitySummary[] {
  const dateFormatter = dateFormatterFor(locale);
  return activities.map((activity) =>
    summarize({ activity, locale, messages, dateFormatter }),
  );
}

export function activityDetail({
  activity,
  locale,
  messages,
}: {
  activity: PublishedActivity;
  locale: PublicLocale;
  messages: Messages;
}): PublicActivityDetail {
  return {
    ...summarize({
      activity,
      locale,
      messages,
      dateFormatter: dateFormatterFor(locale),
    }),
    description: activity.description,
    instructions: activity.instructions,
  };
}

/** Everything a client needs for the activity list, in one round trip. */
export async function loadActivityListPayload(
  locale: PublicLocale,
): Promise<PublicActivityListPayload> {
  const [activities, messages] = await Promise.all([
    listPublishedActivities(locale),
    loadPageCatalog(locale, "public-content"),
  ]);
  return {
    locale,
    direction: localeMetadata[locale].direction,
    activities: activitySummaries({ activities, locale, messages }),
    labels: activityLabels(messages),
    page: activityPageLabels(messages),
  };
}

/** Null when nothing is published under this slug in any language. */
export async function loadActivityDetailPayload(
  slug: string,
  locale: PublicLocale,
): Promise<PublicActivityDetailPayload | null> {
  const [activity, messages] = await Promise.all([
    loadPublishedActivityBySlug(slug, locale),
    loadPageCatalog(locale, "public-content"),
  ]);
  if (!activity) return null;
  return {
    locale,
    direction: localeMetadata[locale].direction,
    activity: activityDetail({ activity, locale, messages }),
    labels: activityLabels(messages),
    page: activityPageLabels(messages),
  };
}
