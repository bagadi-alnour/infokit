import type { PublicLocale } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ActivityCard } from "~/components/public/activity-card";
import {
  PublicPageHeader,
  PublicSiteShell,
} from "~/components/public/public-site-shell";
import {
  ActionAnchor,
  ActionLink,
  Callout,
  Chip,
  SurfaceCard,
} from "~/components/public/primitives";
import { JsonLd } from "~/components/seo/json-ld";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { metaDescription, publicMetadata } from "~/seo/metadata";
import { breadcrumbJsonLd, organizationJsonLd } from "~/seo/structured-data";
import { loadOrganizationDetailPayload } from "~/server/content/public-organization-payload";

interface OrganizationPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

/** Shared by `generateMetadata` and the page, so describing costs no query. */
const loadOrganization = cache(
  async (slug: string, locale: PublicLocale) =>
    await loadOrganizationDetailPayload(slug, locale),
);

export async function generateMetadata({
  params,
}: OrganizationPageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale = requirePublicRouteLocale(localeParam);
  const payload = await loadOrganization(slug, locale);
  if (!payload) return {};

  const { organization, labels } = payload;
  return publicMetadata({
    path: `/organizations/${slug}`,
    locale,
    title: organization.name,
    description: metaDescription(organization.purpose, labels.eyebrow),
  });
}

/**
 * One association: the profile they published, then everything of theirs that is
 * published. It reads the same presenter as the app's organisation screen, so a
 * reader is told the same things in the same words on both surfaces
 * (docs/UI-ARCHITECTURE.md §1).
 */
export default async function OrganizationPage({
  params,
}: OrganizationPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = requirePublicRouteLocale(localeParam);
  const [payload, messages] = await Promise.all([
    loadOrganization(slug, locale),
    loadPageCatalog(locale, "public-content"),
  ]);
  if (!payload) notFound();
  const { organization, activities, labels, activityLabels } = payload;

  const sections = [
    { label: labels.purpose, value: organization.purpose },
    ...(organization.goals
      ? [{ label: labels.goals, value: organization.goals }]
      : []),
    ...(organization.values
      ? [{ label: labels.values, value: organization.values }]
      : []),
  ];

  return (
    <PublicSiteShell
      locale={locale}
      currentPath={`/organizations/${slug}`}
      messages={messages}
      width="reading"
    >
      <JsonLd
        data={[
          organizationJsonLd({
            locale,
            slug,
            name: organization.name,
            description: organization.purpose,
            website: organization.website,
          }),
          breadcrumbJsonLd({
            locale,
            trail: [
              { name: messages["public.nav.home"], path: "/" },
              { name: messages["activities.title"], path: "/activities" },
              {
                name: organization.name,
                path: `/organizations/${slug}`,
              },
            ],
          }),
        ]}
      />
      <PublicPageHeader
        eyebrow={labels.eyebrow}
        title={organization.name}
        aside={
          organization.foundedLabel ? (
            <Chip>{`${labels.founded} ${organization.foundedLabel}`}</Chip>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-6">
        {organization.fallbackUsed ? (
          <Callout tone="info">{organization.fallbackLabel}</Callout>
        ) : null}

        <SurfaceCard as="section" className="flex flex-col gap-6 p-5 md:p-6">
          {sections.map((section) => (
            <div key={section.label} className="flex flex-col gap-2">
              <h2 className="text-copy-muted text-xs font-bold uppercase tracking-[0.08em]">
                {section.label}
              </h2>
              <p className="text-ink whitespace-pre-wrap leading-relaxed">
                {section.value}
              </p>
            </div>
          ))}

          {organization.website ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-copy-muted text-xs font-bold uppercase tracking-[0.08em]">
                {labels.website}
              </h2>
              <ActionAnchor
                href={organization.website}
                target="_blank"
                rel="noreferrer"
                tone="outline"
                size="compact"
                className="w-fit"
              >
                {organization.website}
              </ActionAnchor>
            </div>
          ) : null}
        </SurfaceCard>

        {/* What they run is the reason most readers are here: the same cards as
            the activities list, so nothing has to be learned twice. */}
        <section className="flex flex-col gap-4">
          <h2 className="text-ink text-xl font-bold tracking-tight">
            {labels.activities}
          </h2>
          {activities.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {activities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  labels={activityLabels}
                  layout="wide"
                />
              ))}
            </ul>
          ) : (
            <p className="text-copy-muted leading-relaxed">
              {labels.activitiesEmpty}
            </p>
          )}
        </section>

        <ActionLink
          href={localizedPath("/activities", locale)}
          tone="quiet"
          size="compact"
          className="w-fit"
        >
          {labels.backToActivities}
        </ActionLink>
      </div>
    </PublicSiteShell>
  );
}
