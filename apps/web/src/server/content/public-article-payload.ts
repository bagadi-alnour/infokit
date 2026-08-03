/**
 * One presenter for the public article payloads, read by the web pages and by
 * the public JSON endpoints. Dates, owners and the "no longer reliable" state
 * are decided here once, so the site and the phone app never disagree about
 * when an article was last checked (`@infokit/shared/public-content`).
 */
import { localeMetadata, type PublicLocale } from "@infokit/shared/i18n";
import {
  loadPageCatalog,
  type PageCatalog,
} from "@infokit/shared/i18n/catalogs";
import type {
  PublicArticleDetail,
  PublicArticleDetailPayload,
  PublicArticleLabels,
  PublicArticleListPayload,
  PublicArticlePageLabels,
  PublicArticleSummary,
} from "@infokit/shared/public-content";

import {
  fallbackLabel,
  verificationFormatters,
  verifiedAgoLabel,
} from "~/lib/activity-presentation";
import { localizedPath } from "~/i18n/routing";
import {
  listPublishedArticles,
  loadPublishedArticle,
  type PublishedArticle,
} from "~/server/content/public-content";

type Messages = PageCatalog<"public-content">;

/**
 * The words the article list and page need. The fallback notice is not among
 * them: it names the language the text was read in, which differs per article,
 * so each one carries its own (`fallbackLabel` below).
 */
export function articleLabels(messages: Messages): PublicArticleLabels {
  return {
    empty: messages["articles.empty"],
    read: messages["articles.read"],
    share: messages["articles.share"],
    shareCopied: messages["articles.shareCopied"],
    listen: messages["listen.play"],
    pauseListening: messages["listen.pause"],
    resumeListening: messages["listen.resume"],
    listenLoading: messages["listen.loading"],
    listenRetry: messages["listen.retry"],
    listenDisclosure: messages["listen.aiDisclosure"],
    download: messages["articles.download"],
    publishedBy: messages["articles.publishedBy"],
    lastReviewed: messages["articles.lastReviewed"],
    unreliable: messages["articles.unreliable"],
  };
}

export function articlePageLabels(messages: Messages): PublicArticlePageLabels {
  return {
    eyebrow: messages["articles.eyebrow"],
    title: messages["articles.title"],
    description: messages["articles.description"],
  };
}

/** Long dates: an article is read, not scanned in a list of opening hours. */
function dateFormatterFor(locale: PublicLocale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  });
}

/** A date-only column, read at midday so no timezone can move the day. */
function formatDay(value: string, dateFormatter: Intl.DateTimeFormat) {
  return dateFormatter.format(new Date(`${value}T12:00:00Z`));
}

function unreliableToday(article: PublishedArticle, today: string) {
  return Boolean(article.unreliableFrom && article.unreliableFrom <= today);
}

/** An article with no named owner is the platform's own — say so, plainly. */
function owners(article: PublishedArticle, messages: Messages) {
  return article.ownerNames.length > 0
    ? article.ownerNames
    : [messages["public.platform"]];
}

export function articleSummaries({
  articles,
  locale,
  messages,
}: {
  articles: PublishedArticle[];
  locale: PublicLocale;
  messages: Messages;
}): PublicArticleSummary[] {
  const dateFormatter = dateFormatterFor(locale);
  const reviewFormatters = verificationFormatters(locale);
  const today = new Date().toISOString().slice(0, 10);
  return articles.map((article) => ({
    id: article.id,
    href: localizedPath(`/articles/${article.slug}`, locale),
    title: article.title,
    summary: article.summary,
    articleDateLabel: article.articleDate
      ? formatDay(article.articleDate, dateFormatter)
      : dateFormatter.format(article.publishedAt),
    ownerNames: owners(article, messages),
    lastReviewedLabel: article.lastReviewedAt
      ? verifiedAgoLabel({
          verifiedAt: article.lastReviewedAt,
          format: reviewFormatters.ago,
        })
      : messages["public.notAvailable"],
    lastReviewedDateLabel: article.lastReviewedAt
      ? reviewFormatters.date.format(article.lastReviewedAt)
      : messages["public.notAvailable"],
    lastReviewedIso: article.lastReviewedAt?.toISOString() ?? null,
    fallbackUsed: article.fallbackUsed,
    fallbackLabel: fallbackLabel({
      messages,
      locale,
      contentLanguage: article.languageCode,
    }),
    unreliable: unreliableToday(article, today),
    coverImage: article.coverImage,
  }));
}

export function articleDetail({
  article,
  locale,
  messages,
}: {
  article: PublishedArticle;
  locale: PublicLocale;
  messages: Messages;
}): PublicArticleDetail {
  const dateFormatter = dateFormatterFor(locale);
  const today = new Date().toISOString().slice(0, 10);
  return {
    title: article.title,
    summary: article.summary,
    body: article.body,
    articleDateLabel: article.articleDate
      ? formatDay(article.articleDate, dateFormatter)
      : dateFormatter.format(article.publishedAt),
    lastReviewedLabel: article.lastReviewedAt
      ? dateFormatter.format(article.lastReviewedAt)
      : messages["public.notAvailable"],
    ownerNames: owners(article, messages),
    fallbackUsed: article.fallbackUsed,
    fallbackLabel: fallbackLabel({
      messages,
      locale,
      contentLanguage: article.languageCode,
    }),
    unreliable: unreliableToday(article, today),
    unreliableFromLabel: article.unreliableFrom
      ? formatDay(article.unreliableFrom, dateFormatter)
      : "",
    coverImage: article.coverImage,
  };
}

/** Everything a client needs for the article list, in one round trip. */
export async function loadArticleListPayload(
  locale: PublicLocale,
): Promise<PublicArticleListPayload> {
  const [articles, messages] = await Promise.all([
    listPublishedArticles(locale),
    loadPageCatalog(locale, "public-content"),
  ]);
  return {
    locale,
    direction: localeMetadata[locale].direction,
    articles: articleSummaries({ articles, locale, messages }),
    labels: articleLabels(messages),
    page: articlePageLabels(messages),
  };
}

/** Null when nothing is published under this slug in any language. */
export async function loadArticleDetailPayload(
  slug: string,
  locale: PublicLocale,
): Promise<PublicArticleDetailPayload | null> {
  const [article, messages] = await Promise.all([
    loadPublishedArticle(slug, locale),
    loadPageCatalog(locale, "public-content"),
  ]);
  if (!article) return null;
  return {
    locale,
    direction: localeMetadata[locale].direction,
    article: articleDetail({ article, locale, messages }),
    labels: articleLabels(messages),
  };
}
