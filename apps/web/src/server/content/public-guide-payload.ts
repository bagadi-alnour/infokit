/**
 * The guides (the "simulator" flows) as a payload. The web pages resolve the
 * same labels inline through their components; this presenter exists so the
 * native app walks exactly the same document with exactly the same words, and
 * so the two cannot drift on what "last reviewed" means.
 */
import { localeMetadata, type PublicLocale } from "@infokit/shared/i18n";
import {
  loadPageCatalog,
  type PageCatalog,
} from "@infokit/shared/i18n/catalogs";
import type {
  PublicGuideDetailPayload,
  PublicGuideListPayload,
  PublicSimulatorSummary,
} from "@infokit/shared/public-content";
import type { PublicSimulatorLabels } from "@infokit/shared/public-simulator";

import { localizedPath } from "~/i18n/routing";
import {
  listPublishedSimulators,
  loadPublishedSimulator,
} from "~/server/content/public-simulator";

type GuideMessages = PageCatalog<"public-simulator">;
type ContentMessages = PageCatalog<"public-content">;

/** The words the walk itself needs, in the reader's language. */
export function guideLabels(messages: GuideMessages): PublicSimulatorLabels {
  return {
    brand: messages["simulator.brand"],
    privacy: messages["simulator.privacy"],
    privacyDetail: messages["simulator.privacyDetail"],
    source: messages["simulator.source"],
    lastReviewed: messages["simulator.lastReviewed"],
    reviewDue: messages["simulator.reviewDue"],
    notAvailable: messages["simulator.notAvailable"],
    fallback: messages["simulator.fallback"],
    preview: messages["simulator.preview"],
    previewDetail: messages["simulator.previewDetail"],
    begin: messages["simulator.begin"],
    continue: messages["simulator.continue"],
    back: messages["simulator.back"],
    startAgain: messages["simulator.startAgain"],
    step: messages["simulator.step"],
    question: messages["simulator.question"],
    information: messages["simulator.information"],
    result: messages["simulator.result"],
    disclaimer: messages["simulator.disclaimer"],
  };
}

function reviewFormatter(locale: PublicLocale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  });
}

function reviewLabel(
  value: string | null,
  formatter: Intl.DateTimeFormat,
  unavailable: string,
): string {
  return value ? formatter.format(new Date(value)) : unavailable;
}

/** Every published guide, as cards. */
export async function loadGuideListPayload(
  locale: PublicLocale,
): Promise<PublicGuideListPayload> {
  const [guides, messages] = await Promise.all([
    listPublishedSimulators(locale),
    loadPageCatalog(locale, "public-content"),
  ]);
  const formatter = reviewFormatter(locale);
  const languageLabels: Record<"fr" | "en" | "ar", string> = {
    fr: messages["public.language.fr"],
    en: messages["public.language.en"],
    ar: messages["public.language.ar"],
  };
  const summaries: PublicSimulatorSummary[] = guides.map(
    ({ document, cityLabel }) => ({
      id: document.flowId,
      // The slug, not the id: the app opens a guide by the same handle a link
      // on the site would use.
      href: localizedPath(`/simulator/${document.slug}`, locale),
      title: document.title,
      summary: document.summary,
      cityLabel: cityLabel || messages["simulator.allCities"],
      lastReviewedLabel: reviewLabel(
        document.lastReviewedAt,
        formatter,
        messages["public.notAvailable"],
      ),
      sourceLanguageLabel: languageLabels[document.sourceLanguage],
    }),
  );

  return {
    locale,
    direction: localeMetadata[locale].direction,
    guides: summaries,
    labels: collectionLabels(messages),
    page: {
      eyebrow: messages["simulator.eyebrow"],
      title: messages["simulator.title"],
      description: messages["simulator.description"],
    },
  };
}

function collectionLabels(messages: ContentMessages) {
  return {
    empty: messages["simulator.empty"],
    open: messages["simulator.open"],
    city: messages["simulator.city"],
    lastReviewed: messages["simulator.lastReviewed"],
    sourceLanguage: messages["simulator.sourceLanguage"],
    privacy: messages["simulator.privacy"],
  };
}

/** One published guide by slug, or null when nothing is published under it. */
export async function loadGuideDetailPayload(
  slug: string,
  locale: PublicLocale,
): Promise<PublicGuideDetailPayload | null> {
  const [document, messages] = await Promise.all([
    loadPublishedSimulator(slug, locale),
    loadPageCatalog(locale, "public-simulator"),
  ]);
  if (!document) return null;
  const formatter = reviewFormatter(locale);
  const unavailable = messages["simulator.notAvailable"];

  return {
    locale,
    direction: localeMetadata[locale].direction,
    document,
    labels: guideLabels(messages),
    lastReviewedLabel: reviewLabel(
      document.lastReviewedAt,
      formatter,
      unavailable,
    ),
    reviewDueLabel: reviewLabel(document.reviewDueAt, formatter, unavailable),
  };
}
