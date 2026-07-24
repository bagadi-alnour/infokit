import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SimulatorPage } from "~/components/public/simulator-page";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { languageAlternates, localizedPath } from "~/i18n/routing";
import { loadPublishedSimulator } from "~/server/content/public-simulator";

interface PublishedSimulatorPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: PublishedSimulatorPageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale = requirePublicRouteLocale(localeParam);
  const document = await loadPublishedSimulator(slug, locale);
  if (!document) return {};
  const path = `/simulator/${slug}`;
  return {
    title: document.title,
    description: document.summary,
    alternates: {
      canonical: localizedPath(path, locale),
      languages: languageAlternates(path),
    },
  };
}

export default async function PublishedSimulatorPage({
  params,
}: PublishedSimulatorPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = requirePublicRouteLocale(localeParam);
  const [document, messages, navigationMessages] = await Promise.all([
    loadPublishedSimulator(slug, locale),
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
