import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SimulatorPage } from "~/components/public/simulator-page";
import { requireRouteLocale } from "~/i18n/route-locale";
import { requirePermission } from "~/server/auth/require";
import { loadSimulatorPreview } from "~/server/content/public-simulator";

export const metadata: Metadata = {
  title: "Simulator preview",
  robots: { index: false, follow: false },
};

export default async function SimulatorPreviewPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: localeParam, id } = await params;
  const locale = requireRouteLocale(localeParam);
  await requirePermission("content.simulator.review", locale);
  const [document, messages, navigationMessages] = await Promise.all([
    loadSimulatorPreview(id, locale),
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
      preview
    />
  );
}
