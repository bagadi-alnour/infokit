import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicArticleDetailView } from "~/components/public/article-detail";
import { PublicSiteShell } from "~/components/public/public-site-shell";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { loadPublishedArticle } from "~/server/content/public-content";

export const metadata: Metadata = {
  title: "Article",
};

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: localeParam, slug } = await params;
  const locale = requirePublicRouteLocale(localeParam);
  const [article, messages] = await Promise.all([
    loadPublishedArticle(slug, locale),
    loadPageCatalog(locale, "public-content"),
  ]);
  if (!article) notFound();
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  });
  const today = new Date().toISOString().slice(0, 10);
  const unreliable = Boolean(
    article.unreliableFrom && article.unreliableFrom <= today,
  );

  return (
    <PublicSiteShell
      locale={locale}
      currentPath={`/articles/${slug}`}
      messages={messages}
      width="reading"
    >
      <PublicArticleDetailView
        eyebrow={messages["articles.eyebrow"]}
        article={{
          title: article.title,
          summary: article.summary,
          body: article.body,
          articleDateLabel: article.articleDate
            ? dateFormatter.format(new Date(`${article.articleDate}T12:00:00Z`))
            : dateFormatter.format(article.publishedAt),
          lastReviewedLabel: article.lastReviewedAt
            ? dateFormatter.format(article.lastReviewedAt)
            : messages["public.notAvailable"],
          ownerNames:
            article.ownerNames.length > 0
              ? article.ownerNames
              : [messages["public.platform"]],
          fallbackUsed: article.fallbackUsed,
          unreliable,
          unreliableFromLabel: article.unreliableFrom
            ? dateFormatter.format(
                new Date(`${article.unreliableFrom}T12:00:00Z`),
              )
            : "",
          coverImage: article.coverImage,
        }}
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
