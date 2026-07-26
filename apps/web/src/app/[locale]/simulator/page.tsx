import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { PublicSimulatorSummary } from "@infokit/shared/public-content";
import type { Metadata } from "next";

import { PublicSimulatorCollection } from "~/components/public/simulator-collection";
import {
  PublicPageHeader,
  PublicSiteShell,
} from "~/components/public/public-site-shell";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { languageAlternates, localizedPath } from "~/i18n/routing";
import { listPublishedSimulators } from "~/server/content/public-simulator";

export const metadata: Metadata = {
  title: "Information simulator",
  alternates: { languages: languageAlternates("/simulator") },
};

export default async function SimulatorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requirePublicRouteLocale((await params).locale);
  const [simulators, messages] = await Promise.all([
    listPublishedSimulators(locale),
    loadPageCatalog(locale, "public-content"),
  ]);
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  });
  const languageLabels = {
    fr: messages["public.language.fr"],
    en: messages["public.language.en"],
    ar: messages["public.language.ar"],
  };
  const summaries: PublicSimulatorSummary[] = simulators.map(
    ({ document, cityLabel }) => ({
      id: document.flowId,
      href: localizedPath(`/simulator/${document.slug}`, locale),
      title: document.title,
      summary: document.summary,
      cityLabel: cityLabel || messages["simulator.allCities"],
      lastReviewedLabel: document.lastReviewedAt
        ? dateFormatter.format(new Date(document.lastReviewedAt))
        : messages["public.notAvailable"],
      sourceLanguageLabel: languageLabels[document.sourceLanguage],
    }),
  );

  return (
    <PublicSiteShell
      locale={locale}
      currentPath="/simulator"
      messages={messages}
    >
      <PublicPageHeader
        eyebrow={messages["simulator.eyebrow"]}
        title={messages["simulator.title"]}
        description={messages["simulator.description"]}
      />
      <PublicSimulatorCollection
        simulators={summaries}
        labels={{
          empty: messages["simulator.empty"],
          open: messages["simulator.open"],
          city: messages["simulator.city"],
          lastReviewed: messages["simulator.lastReviewed"],
          sourceLanguage: messages["simulator.sourceLanguage"],
          privacy: messages["simulator.privacy"],
        }}
      />
    </PublicSiteShell>
  );
}
