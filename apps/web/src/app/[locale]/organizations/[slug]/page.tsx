import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { fallbackLabel } from "~/lib/activity-presentation";

import {
  PublicPageHeader,
  PublicSiteShell,
} from "~/components/public/public-site-shell";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { loadPublishedOrganization } from "~/server/content/public-content";

export const metadata: Metadata = {
  title: "Organisation",
};

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: localeParam, slug } = await params;
  const locale = requirePublicRouteLocale(localeParam);
  const [organization, messages] = await Promise.all([
    loadPublishedOrganization(slug, locale),
    loadPageCatalog(locale, "public-content"),
  ]);
  if (!organization) notFound();

  const sections: { label: string; value: string }[] = [
    { label: messages["organization.purpose"], value: organization.purpose },
    ...(organization.goals
      ? [{ label: messages["organization.goals"], value: organization.goals }]
      : []),
    ...(organization.values
      ? [{ label: messages["organization.values"], value: organization.values }]
      : []),
  ];

  return (
    <PublicSiteShell
      locale={locale}
      currentPath={`/organizations/${slug}`}
      messages={messages}
    >
      <PublicPageHeader
        eyebrow={messages["organization.eyebrow"]}
        title={organization.displayName}
        description=""
      />

      <Card className="hover:ring-brand/40 transition-shadow hover:shadow-md">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge className="bg-brand-soft text-brand gap-1.5 border-transparent px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide">
              {messages["organization.eyebrow"]}
            </Badge>
            {organization.foundedYear ? (
              <span className="text-copy-muted text-xs font-semibold">
                {messages["organization.founded"]}{" "}
                {String(organization.foundedYear)}
              </span>
            ) : null}
          </div>
          <CardTitle className="text-xl leading-snug">
            {organization.displayName}
          </CardTitle>
        </CardHeader>
        <CardContent className="mt-4 flex flex-col gap-5">
          {organization.fallbackUsed ? (
            <p className="bg-brand-soft text-brand w-fit rounded-md px-2.5 py-1 text-xs font-semibold">
              {fallbackLabel({
                messages,
                locale,
                contentLanguage: organization.contentLanguage,
              })}
            </p>
          ) : null}

          {sections.map((section) => (
            <section key={section.label} className="flex flex-col gap-2">
              <h2 className="text-copy-muted text-[0.7rem] font-bold uppercase tracking-wide">
                {section.label}
              </h2>
              <p className="text-ink whitespace-pre-wrap text-sm leading-relaxed">
                {section.value}
              </p>
            </section>
          ))}

          {organization.website ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-copy-muted text-[0.7rem] font-bold uppercase tracking-wide">
                {messages["organization.website"]}
              </h2>
              <a
                href={organization.website}
                target="_blank"
                rel="noreferrer"
                className="text-brand w-fit text-sm font-medium underline-offset-2 hover:underline"
              >
                {organization.website}
              </a>
            </section>
          ) : null}

          <Separator />
          <Link
            href={localizedPath("/activities", locale)}
            className="text-brand w-fit text-sm font-semibold underline-offset-2 hover:underline"
          >
            {messages["organization.backToActivities"]}
          </Link>
        </CardContent>
      </Card>
    </PublicSiteShell>
  );
}
