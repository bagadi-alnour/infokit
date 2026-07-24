import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { PublicHomeExperience } from "@calais/ui";
import type { Metadata } from "next";

import { PublicSiteShell } from "~/components/public/public-site-shell";
import { WebsiteJsonLd } from "~/components/seo/website-json-ld";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { languageAlternates, localizedPath } from "~/i18n/routing";
import { absoluteUrl } from "~/seo/site";
import {
  listPublishedActivities,
  listPublishedArticles,
} from "~/server/content/public-content";
import { listPublishedSimulators } from "~/server/content/public-simulator";

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const locale = requirePublicRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "home");
  const url = localizedPath("/", locale);

  return {
    title: { absolute: messages["home.title"] },
    description: messages["home.metaDescription"],
    alternates: {
      canonical: url,
      languages: languageAlternates("/"),
    },
    openGraph: {
      type: "website",
      title: messages["home.title"],
      description: messages["home.metaDescription"],
      url,
      locale,
    },
    twitter: {
      card: "summary",
      title: messages["home.title"],
      description: messages["home.metaDescription"],
    },
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const locale = requirePublicRouteLocale((await params).locale);
  const [messages, publicMessages, activities, articles, simulators] =
    await Promise.all([
      loadPageCatalog(locale, "home"),
      loadPageCatalog(locale, "public-content"),
      listPublishedActivities(locale),
      listPublishedArticles(locale),
      listPublishedSimulators(locale),
    ]);
  const url = localizedPath("/", locale);

  return (
    <PublicSiteShell locale={locale} currentPath="/" messages={publicMessages}>
      <WebsiteJsonLd
        locale={locale}
        description={messages["home.metaDescription"]}
        url={absoluteUrl(url)}
      />
      <PublicHomeExperience
        labels={{
          eyebrow: messages["home.eyebrow"],
          title: messages["home.title"],
          description: messages["home.description"],
          primaryAction: messages["home.primaryAction"],
          activities: messages["home.activities"],
          activitiesDescription: messages["home.activitiesDescription"],
          articles: messages["home.articles"],
          articlesDescription: messages["home.articlesDescription"],
          guide: messages["home.guide"],
          guideDescription: messages["home.guideDescription"],
          reliability: messages["home.reliability"],
          reliabilityDescription: messages["home.reliabilityDescription"],
          published: messages["home.open"],
        }}
        links={{
          activities: localizedPath("/activities", locale),
          articles: localizedPath("/articles", locale),
          guide: localizedPath("/simulator", locale),
        }}
        counts={{
          activities: activities.length,
          articles: articles.length,
          guides: simulators.length,
        }}
      />
    </PublicSiteShell>
  );
}
