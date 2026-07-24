import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { PublicArticleCollection, type PublicArticleSummary } from "@calais/ui";
import type { Metadata } from "next";

import {
  PublicPageHeader,
  PublicSiteShell,
} from "~/components/public/public-site-shell";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { languageAlternates, localizedPath } from "~/i18n/routing";
import { listPublishedArticles } from "~/server/content/public-content";

export const metadata: Metadata = {
  title: "Articles",
  alternates: { languages: languageAlternates("/articles") },
};

export default async function ArticlesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requirePublicRouteLocale((await params).locale);
  const [articles, messages] = await Promise.all([
    listPublishedArticles(locale),
    loadPageCatalog(locale, "public-content"),
  ]);
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  });
  const today = new Date().toISOString().slice(0, 10);
  const summaries: PublicArticleSummary[] = articles.map((article) => ({
    id: article.id,
    href: localizedPath(`/articles/${article.slug}`, locale),
    title: article.title,
    summary: article.summary,
    articleDateLabel: article.articleDate
      ? dateFormatter.format(new Date(`${article.articleDate}T12:00:00Z`))
      : dateFormatter.format(article.publishedAt),
    ownerNames:
      article.ownerNames.length > 0
        ? article.ownerNames
        : [messages["public.platform"]],
    lastReviewedLabel: article.lastReviewedAt
      ? dateFormatter.format(article.lastReviewedAt)
      : messages["public.notAvailable"],
    fallbackUsed: article.fallbackUsed,
    unreliable: Boolean(
      article.unreliableFrom && article.unreliableFrom <= today,
    ),
    coverImage: article.coverImage,
  }));

  return (
    <PublicSiteShell
      locale={locale}
      currentPath="/articles"
      messages={messages}
    >
      <PublicPageHeader
        eyebrow={messages["articles.eyebrow"]}
        title={messages["articles.title"]}
        description={messages["articles.description"]}
      />
      <PublicArticleCollection
        articles={summaries}
        labels={{
          empty: messages["articles.empty"],
          read: messages["articles.read"],
          publishedBy: messages["articles.publishedBy"],
          lastReviewed: messages["articles.lastReviewed"],
          fallback: messages["public.fallback"],
          unreliable: messages["articles.unreliable"],
        }}
      />
    </PublicSiteShell>
  );
}
