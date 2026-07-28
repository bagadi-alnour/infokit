import { aboutStrings } from "@infokit/shared/about";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";

import { PublicHomeExperience } from "~/components/public/home-experience";
import { PublicSiteShell } from "~/components/public/public-site-shell";
import { JsonLd } from "~/components/seo/json-ld";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { publicMetadata } from "~/seo/metadata";
import { websiteJsonLd } from "~/seo/structured-data";
import { listPublicCoordinationEvents } from "~/server/content/coordination-events";
import {
  activityLabels,
  activitySummaries,
} from "~/server/content/public-activity-payload";
import {
  associationRoutes,
  basicInformationRoutes,
  serviceRoutes,
  urgentRoutes,
} from "~/server/content/public-basics-payload";
import {
  listPublishedActivities,
  listPublishedArticles,
  listPublishedOrganizations,
} from "~/server/content/public-content";
import { searchSuggestions } from "~/server/content/public-search-suggestions";
import { listPublishedSimulators } from "~/server/content/public-simulator";

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

/**
 * The page now carries a clock — "open now" is read off the schedules at request
 * time — so it is rebuilt every minute rather than served as it was at build.
 * A minute is finer than the information itself: opening hours are minutes, and
 * every card still carries the date it was last checked.
 */
export const revalidate = 60;

/** v0's hero showed six chips; the published set decides how many there are. */
const NEEDS_ON_THE_HERO = 8;
/** Two rows of the services grid. The whole set is a filter on the list. */
const SERVICES_IN_THE_BAND = 10;
/** One row of association cards; the rest are named on what they publish. */
const ASSOCIATIONS_IN_THE_BAND = 4;
/** Two rows of activity cards — a shelf, not a second copy of the list. */
const OPEN_NOW_IN_THE_BAND = 6;

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const locale = requirePublicRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "home");

  return publicMetadata({
    path: "/",
    locale,
    // The one page whose title is not suffixed: "Find practical help near you ·
    // InfoKit" reads as a section of somewhere else.
    absoluteTitle: true,
    title: messages["home.title"],
    description: messages["home.metaDescription"],
  });
}

export default async function HomePage({ params }: HomePageProps) {
  const locale = requirePublicRouteLocale((await params).locale);
  const [
    messages,
    publicMessages,
    activities,
    articles,
    simulators,
    organizations,
    events,
  ] = await Promise.all([
    loadPageCatalog(locale, "home"),
    loadPageCatalog(locale, "public-content"),
    listPublishedActivities(locale),
    listPublishedArticles(locale),
    listPublishedSimulators(locale),
    listPublishedOrganizations(),
    // The count of what is still to come, not the agenda payload: this page
    // only needs to know whether the route is worth offering.
    listPublicCoordinationEvents({ locale, from: new Date() }),
  ]);

  // Same presenter the activity list and the app's endpoint read, so an activity
  // says the same thing here as it does everywhere else.
  const summaries = activitySummaries({
    activities,
    locale,
    messages: publicMessages,
  });

  // Which associations have a profile page to open: the search box and the
  // associations band both need it, and both must only link what exists.
  const publishedSlugs = new Set(
    organizations.map((organization) => organization.slug),
  );

  return (
    <PublicSiteShell locale={locale} currentPath="/" messages={publicMessages}>
      <JsonLd
        data={websiteJsonLd({
          locale,
          description: messages["home.metaDescription"],
        })}
      />
      <PublicHomeExperience
        labels={{
          eyebrow: messages["home.eyebrow"],
          title: messages["home.title"],
          description: messages["home.description"],
          searchPlaceholder: messages["home.searchPlaceholder"],
          urgent: messages["home.urgent"],
          urgentBody: messages["home.urgentBody"],
          guideTeaser: messages["home.guideTeaser"],
          openNow: messages["home.openNow"],
          openNowBody: messages["home.openNowBody"],
          services: messages["home.services"],
          servicesBody: messages["home.servicesBody"],
          associations: messages["home.associations"],
          associationsBody: messages["home.associationsBody"],
          guidePrivate: messages["home.guidePrivate"],
          articles: messages["home.articles"],
          articlesDescription: messages["home.articlesDescription"],
          trust: messages["home.trust"],
          trustBody: messages["home.trustBody"],
          trustOffline: messages["home.trustOffline"],
          trustOfflineBody: messages["home.trustOfflineBody"],
          trustLanguagesBody: messages["home.trustLanguagesBody"],
          trustAnonymous: messages["home.trustAnonymous"],
          trustAnonymousBody: messages["home.trustAnonymousBody"],
          reliability: messages["home.reliability"],
          reliabilityDescription: messages["home.reliabilityDescription"],
          published: messages["home.open"],
          // Translated in all eleven languages, next to the content these words
          // introduce, rather than in the home catalogue's three.
          search: publicMessages["activities.search"],
          allNeeds: publicMessages["activities.allCategories"],
          allActivities: publicMessages["activities.title"],
          // The one counted phrase on the page, translated in all eleven
          // languages beside the list it counts rather than reinvented here.
          activityCount: publicMessages["activities.results"],
          guideEyebrow: publicMessages["simulator.eyebrow"],
          newHere: publicMessages["basics.newHere"],
          newHereBody: publicMessages["basics.newHereBody"],
          newHereAction: publicMessages["basics.newHereAction"],
          agenda: publicMessages["events.title"],
          agendaDescription: publicMessages["events.description"],
          // "Eleven languages" is the platform describing itself, and the About
          // page already says it in all eleven of them.
          trustLanguages: aboutStrings(locale).languages.title,
        }}
        links={{
          activities: localizedPath("/activities", locale),
          articles: localizedPath("/articles", locale),
          events: localizedPath("/events", locale),
          guide: localizedPath("/simulator", locale),
        }}
        counts={{
          articles: articles.length,
          events: events.length,
          guides: simulators.length,
        }}
        // The whole index the search box matches against, delivered with the
        // page: every kind of help, service, activity, place and association
        // that is published, in the reader's language.
        suggestions={searchSuggestions({
          activities,
          summaries,
          locale,
          messages: publicMessages,
          publishedSlugs,
        })}
        urgent={urgentRoutes({ activities, locale, messages: publicMessages })}
        basics={basicInformationRoutes({ activities, locale }).slice(
          0,
          NEEDS_ON_THE_HERO,
        )}
        services={serviceRoutes({ activities, locale }).slice(
          0,
          SERVICES_IN_THE_BAND,
        )}
        openNow={summaries
          .filter((summary) => summary.status === "open")
          .slice(0, OPEN_NOW_IN_THE_BAND)}
        activityLabels={activityLabels(publicMessages)}
        associations={associationRoutes({
          activities,
          locale,
          publishedSlugs,
        }).slice(0, ASSOCIATIONS_IN_THE_BAND)}
      />
    </PublicSiteShell>
  );
}
