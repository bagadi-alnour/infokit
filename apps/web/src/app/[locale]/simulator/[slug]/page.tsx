import type { PublicLocale } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { SimulatorPage } from "~/components/public/simulator-page";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { metaDescription, publicMetadata } from "~/seo/metadata";
import { loadPublishedSimulator } from "~/server/content/public-simulator";

interface PublishedSimulatorPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

/** Shared by `generateMetadata` and the page, so describing costs no query. */
const loadSimulator = cache(
  async (slug: string, locale: PublicLocale) =>
    await loadPublishedSimulator(slug, locale),
);

export async function generateMetadata({
  params,
}: PublishedSimulatorPageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale = requirePublicRouteLocale(localeParam);
  const [document, messages] = await Promise.all([
    loadSimulator(slug, locale),
    loadPageCatalog(locale, "public-content"),
  ]);
  if (!document) return {};

  return publicMetadata({
    path: `/simulator/${slug}`,
    locale,
    title: document.title,
    description: metaDescription(
      document.summary,
      messages["simulator.description"],
    ),
  });
}

export default async function PublishedSimulatorPage({
  params,
}: PublishedSimulatorPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = requirePublicRouteLocale(localeParam);
  const [document, messages, navigationMessages] = await Promise.all([
    loadSimulator(slug, locale),
    loadPageCatalog(locale, "public-simulator"),
    loadPageCatalog(locale, "public-content"),
  ]);
  if (!document) notFound();
  return (
    <SimulatorPage
      locale={locale}
      document={document}
      messages={messages}
      navigationMessages={navigationMessages}
    />
  );
}
