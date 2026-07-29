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
  googleMapsHref,
  mapHref,
  nextOpeningLabel,
  organizationHref,
  verificationFormatters,
  verifiedAgoLabel,
  type VerificationFormatters,
} from "~/lib/activity-presentation";
import { presentTransitLinks } from "~/lib/transit-presentation";
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

/** Three days in a row read as a range; two are shorter written out. */
const DAYS_WORTH_A_RANGE = 3;

/**
 * The week on one line: the days that share their hours are collapsed into a
 * range — "Mon–Fri 13:00–17:00" — and the reader's own language joins what is
 * left of them. It says exactly what the seven rows on the detail page say, in
 * the space a card beside other cards has, and it needs no new words in eleven
 * catalogues: `Intl` owns the short weekday names and the conjunction.
 */
function scheduleSummary(
  schedules: PublishedActivity["schedules"],
  locale: PublicLocale,
) {
  const weekdaysByHours = new Map<string, number[]>();
  for (const schedule of schedules) {
    const hours = `${schedule.startTime.slice(0, 5)}–${schedule.endTime.slice(0, 5)}`;
    const weekdays = weekdaysByHours.get(hours);
    if (weekdays) weekdays.push(schedule.weekday);
    else weekdaysByHours.set(hours, [schedule.weekday]);
  }

  // Weekday 1 is Monday, and 1 January 2024 was a Monday.
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
  const weekdayName = (weekday: number) =>
    formatter.format(new Date(Date.UTC(2024, 0, weekday)));
  const list = new Intl.ListFormat(locale, {
    style: "short",
    type: "conjunction",
  });

  return Array.from(weekdaysByHours)
    .map(([hours, weekdays]) => {
      const runs: number[][] = [];
      for (const weekday of Array.from(new Set(weekdays)).sort(
        (a, b) => a - b,
      )) {
        const run = runs.at(-1);
        if (run && weekday === (run.at(-1) ?? 0) + 1) run.push(weekday);
        else runs.push([weekday]);
      }
      const spans = runs.flatMap((run) => {
        const first = run.at(0);
        const last = run.at(-1);
        if (first === undefined || last === undefined) return [];
        return run.length >= DAYS_WORTH_A_RANGE
          ? [`${weekdayName(first)}–${weekdayName(last)}`]
          : run.map(weekdayName);
      });
      return `${list.format(spans)} ${hours}`;
    })
    .join(" · ");
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
    open: messages["activities.open"],
    share: messages["activities.share"],
    shareCopied: messages["activities.shareCopied"],
    downloadPdf: messages["activities.downloadPdf"],
    openInGoogleMaps: messages["activities.openInGoogleMaps"],
    mapTitle: messages["activities.mapTitle"],
    mapHint: messages["activities.mapHint"],
    noMap: messages["activities.noMap"],
    gettingHere: messages["transit.gettingHere"],
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
  verified,
}: {
  activity: PublishedActivity;
  locale: PublicLocale;
  messages: Messages;
  verified: VerificationFormatters;
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
    // Named field by field, not spread: the read model also carries each
    // service's taxonomy code, and the payload is the contract the app reads —
    // it ships what `PublicActivityService` declares and nothing more.
    services: activity.services.map(({ id, label, icon }) => ({
      id,
      label,
      icon,
    })),
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
      ? verifiedAgoLabel({
          verifiedAt: activity.lastVerifiedAt,
          format: verified.ago,
        })
      : messages["public.notAvailable"],
    lastVerifiedDateLabel: activity.lastVerifiedAt
      ? verified.date.format(activity.lastVerifiedAt)
      : messages["public.notAvailable"],
    lastVerifiedIso: activity.lastVerifiedAt?.toISOString() ?? null,
    scheduleLabels:
      activity.schedules.length > 0
        ? activity.schedules.map((schedule) => scheduleLabel(schedule, locale))
        : [messages["activities.confirmSchedule"]],
    scheduleSummary:
      activity.schedules.length > 0
        ? scheduleSummary(activity.schedules, locale)
        : messages["activities.confirmSchedule"],
    coverImage: activity.coverImage,
  };
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
  const verified = verificationFormatters(locale);
  return activities.map((activity) =>
    summarize({ activity, locale, messages, verified }),
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
      verified: verificationFormatters(locale),
    }),
    description: activity.description,
    instructions: activity.instructions,
    transit: presentTransitLinks({
      links: activity.transit,
      messages,
      locale,
    }),
    googleMapsHref: googleMapsHref({
      address: activity.address,
      latitude: activity.latitude,
      longitude: activity.longitude,
    }),
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
