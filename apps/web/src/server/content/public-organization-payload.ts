/**
 * One presenter for the public organisation page. The site's page and the public
 * JSON endpoint both read it, so a visitor on the phone app and a visitor on the
 * site are told the same things about the same association, in the same words:
 * every string here is already localized and formatted, and no client picks a
 * translation or formats a year (`@infokit/shared/public-content`).
 */
import { localeMetadata, type PublicLocale } from "@infokit/shared/i18n";
import {
  loadPageCatalog,
  type PageCatalog,
} from "@infokit/shared/i18n/catalogs";
import type {
  PublicOrganizationDetailPayload,
  PublicOrganizationLabels,
  PublicOrganizationProfile,
} from "@infokit/shared/public-content";

import { fallbackLabel, organizationHref } from "~/lib/activity-presentation";
import {
  activityLabels,
  activitySummaries,
} from "~/server/content/public-activity-payload";
import {
  listPublishedActivities,
  loadPublishedOrganization,
  type PublishedOrganization,
} from "~/server/content/public-content";

type Messages = PageCatalog<"public-content">;

export function organizationLabels(
  messages: Messages,
): PublicOrganizationLabels {
  return {
    eyebrow: messages["organization.eyebrow"],
    purpose: messages["organization.purpose"],
    goals: messages["organization.goals"],
    values: messages["organization.values"],
    website: messages["organization.website"],
    founded: messages["organization.founded"],
    activities: messages["organization.activities"],
    activitiesEmpty: messages["organization.activitiesEmpty"],
    backToActivities: messages["organization.backToActivities"],
  };
}

export function organizationProfile({
  organization,
  locale,
  messages,
}: {
  organization: PublishedOrganization;
  locale: PublicLocale;
  messages: Messages;
}): PublicOrganizationProfile {
  return {
    slug: organization.slug,
    href: organizationHref(organization.slug, locale),
    name: organization.displayName,
    purpose: organization.purpose,
    goals: organization.goals,
    values: organization.values,
    website: organization.website,
    // A year is a number a reader reads, so it is written in their own digits
    // and never grouped — 2016, not 2,016.
    foundedLabel:
      organization.foundedYear === null
        ? null
        : new Intl.NumberFormat(locale, { useGrouping: false }).format(
            organization.foundedYear,
          ),
    fallbackUsed: organization.fallbackUsed,
    fallbackLabel: fallbackLabel({
      messages,
      locale,
      contentLanguage: organization.contentLanguage,
    }),
  };
}

/**
 * Null when no verified organisation has published a profile under this slug.
 *
 * The activities are the published ones this organisation runs, read through the
 * same list the activities screen reads: a card here cannot show anything the
 * public list would not show, and it cannot go stale separately from it.
 */
export async function loadOrganizationDetailPayload(
  slug: string,
  locale: PublicLocale,
): Promise<PublicOrganizationDetailPayload | null> {
  const [organization, messages] = await Promise.all([
    loadPublishedOrganization(slug, locale),
    loadPageCatalog(locale, "public-content"),
  ]);
  if (!organization) return null;

  const activities = (await listPublishedActivities(locale)).filter(
    (activity) => activity.providers.some((provider) => provider.slug === slug),
  );

  return {
    locale,
    direction: localeMetadata[locale].direction,
    organization: organizationProfile({ organization, locale, messages }),
    activities: activitySummaries({ activities, locale, messages }),
    labels: organizationLabels(messages),
    activityLabels: activityLabels(messages),
  };
}
