import { aboutStrings, type AboutSection } from "@infokit/shared/about";
import {
  isPublicLocale,
  localeMetadata,
  publicSupportedLocales,
  type PublicLocale,
} from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";

import type { PublicSpeechKind } from "~/lib/public-speech";
import { presentTransitLinks } from "~/lib/transit-presentation";
import { articleDetail } from "~/server/content/public-article-payload";
import {
  findPublicCoordinationEvent,
  type CoordinationEventRecord,
} from "~/server/content/coordination-events";
import {
  eventWhereLabel,
  formatEventRange,
  listCityViews,
} from "~/server/content/event-presentation";
import { loadPublishedArticle } from "~/server/content/public-content";

function lines(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

function sectionText(section: AboutSection): string {
  return lines([section.title, section.body, ...section.points]);
}

function aboutSpeechText(
  locale: PublicLocale,
  messages: Awaited<ReturnType<typeof loadPageCatalog<"public-content">>>,
): string {
  const about = aboutStrings(locale);
  const statusRows = [
    [messages["activities.status.open"], about.statuses.meanings.open].join(
      ". ",
    ),
    [messages["activities.status.closed"], about.statuses.meanings.closed].join(
      ". ",
    ),
    [
      messages["activities.status.uncertain"],
      about.statuses.meanings.uncertain,
    ].join(". "),
    [
      messages["activities.status.cancelled"],
      about.statuses.meanings.cancelled,
    ].join(". "),
  ];
  const languages = publicSupportedLocales.map(
    (code) => localeMetadata[code].label,
  );

  return lines([
    about.title,
    about.tagline,
    about.intro,
    sectionText(about.independence),
    sectionText(about.what),
    sectionText(about.source),
    sectionText(about.freshness),
    lines([about.statuses.title, about.statuses.body, ...statusRows]),
    lines([about.languages.title, about.languages.body, ...languages]),
    sectionText(about.privacy),
    sectionText(about.security),
    sectionText(about.collaboration),
    sectionText(about.associations),
    sectionText(about.cities),
    sectionText(about.limits),
  ]);
}

async function articleSpeechText(
  slug: string,
  locale: PublicLocale,
  messages: Awaited<ReturnType<typeof loadPageCatalog<"public-content">>>,
): Promise<PublicSpeechContent | null> {
  const article = await loadPublishedArticle(slug, locale);
  if (!article) return null;
  const presented = articleDetail({ article, locale, messages });
  return {
    text: lines([
      presented.title,
      presented.summary,
      presented.unreliable
        ? `${messages["articles.unreliable"]}. ${presented.unreliableFromLabel}`
        : null,
      presented.fallbackUsed ? presented.fallbackLabel : null,
      presented.articleDateLabel,
      presented.body,
      `${messages["articles.publishedBy"]}: ${presented.ownerNames.join(", ")}`,
      `${messages["articles.lastReviewed"]}: ${presented.lastReviewedLabel}`,
    ]),
    contentLocale: isPublicLocale(article.languageCode)
      ? article.languageCode
      : locale,
  };
}

function eventSpeechText({
  event,
  locale,
  city,
  messages,
}: {
  event: CoordinationEventRecord;
  locale: PublicLocale;
  city: Awaited<ReturnType<typeof listCityViews>>[number] | undefined;
  messages: Awaited<ReturnType<typeof loadPageCatalog<"public-content">>>;
}): string {
  const range = formatEventRange(event, city, locale, {
    allDay: messages["events.allDay"],
  });
  const where = eventWhereLabel(event);
  const transit = presentTransitLinks({
    links: event.transit,
    messages,
    locale,
  });

  return lines([
    event.title,
    event.status === "cancelled"
      ? lines([
          messages["events.cancelled"],
          event.cancellationReason ?? messages["events.cancelledNoReason"],
        ])
      : null,
    event.description,
    `${messages["events.when"]}: ${range.dateLabel}. ${range.timeLabel}`,
    `${messages["events.where"]}: ${where ?? messages["public.notAvailable"]}`,
    `${messages["events.city"]}: ${city?.name ?? messages["public.notAvailable"]}`,
    transit.length > 0
      ? lines([
          messages["transit.gettingHere"],
          ...transit.map((link) => link.label),
        ])
      : null,
    `${messages["events.host"]}: ${event.hostName ?? messages["public.platform"]}`,
    event.contactValue
      ? `${messages["events.contact"]}: ${event.contactLabel ?? ""}. ${event.contactValue}`
      : null,
    messages["events.checkBefore"],
  ]);
}

function eventContentLocale(
  event: CoordinationEventRecord,
  requestedLocale: PublicLocale,
): PublicLocale {
  const candidates = [
    requestedLocale,
    event.sourceLanguageCode,
    "fr",
    ...Object.keys(event.translations),
  ];
  return (
    candidates.find(
      (candidate): candidate is PublicLocale =>
        isPublicLocale(candidate) && Boolean(event.translations[candidate]),
    ) ?? requestedLocale
  );
}

export interface PublicSpeechContent {
  text: string;
  /** The language the published main content is actually written in. */
  contentLocale: PublicLocale;
}

/**
 * Rebuild the narration from the public read model. Callers can select a
 * published page, but cannot turn this endpoint into an arbitrary-text TTS
 * proxy or expose a private event/article.
 */
export async function publicSpeechContent({
  kind,
  id,
  locale,
}: {
  kind: PublicSpeechKind;
  id?: string;
  locale: PublicLocale;
}): Promise<PublicSpeechContent | null> {
  const messages = await loadPageCatalog(locale, "public-content");
  if (kind === "about") {
    return { text: aboutSpeechText(locale, messages), contentLocale: locale };
  }
  if (!id) return null;
  if (kind === "article") return articleSpeechText(id, locale, messages);

  const [event, cities] = await Promise.all([
    findPublicCoordinationEvent({ eventId: id, locale }),
    listCityViews(locale),
  ]);
  if (!event) return null;
  return {
    text: eventSpeechText({
      event,
      locale,
      city: cities.find((candidate) => candidate.id === event.cityId),
      messages,
    }),
    contentLocale: eventContentLocale(event, locale),
  };
}
