import type { PublicLocale } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PublicArticleDetailView } from "~/components/public/article-detail";
import { PublicSiteShell } from "~/components/public/public-site-shell";
import { JsonLd } from "~/components/seo/json-ld";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { metaDescription, publicMetadata } from "~/seo/metadata";
import { articleJsonLd, breadcrumbJsonLd } from "~/seo/structured-data";
import {
  articleDetail,
  articleLabels,
  articlePageLabels,
} from "~/server/content/public-article-payload";
import {
  listPublishedArticleRoutes,
  loadPublishedArticle,
} from "~/server/content/public-content";

interface ArticleDetailPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

/** Shared by `generateMetadata` and the page, so describing costs no query. */
const loadArticle = cache(
  async (slug: string, locale: PublicLocale) =>
    await loadPublishedArticle(slug, locale),
);

/**
 * The paths this article occupies in the other ten languages. Its slug comes
 * from its own title in each of them, so hreflang cannot be derived from the
 * URL the reader arrived on.
 *
 * Keyed by the slug in the URL rather than by the article's id, so it can be
 * read beside the article instead of after it. Metadata that settles later than
 * the page's own data misses the first flush of HTML, and Next then streams the
 * tags into `<body>`, where the head is what a crawler and a link unfurler
 * read — the whole head block went missing while this waited on `article.id`.
 */
const articlePaths = cache(async (slug: string) => {
  const [routes] = await listPublishedArticleRoutes(slug);
  if (!routes) return undefined;
  const paths: Partial<Record<PublicLocale, string>> = {};
  for (const [locale, slug] of Object.entries(routes.slugs)) {
    paths[locale as PublicLocale] = `/articles/${slug}`;
  }
  return paths;
});

export async function generateMetadata({
  params,
}: ArticleDetailPageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale = requirePublicRouteLocale(localeParam);
  const [article, messages, localizedPaths] = await Promise.all([
    loadArticle(slug, locale),
    loadPageCatalog(locale, "public-content"),
    articlePaths(slug),
  ]);
  if (!article) return {};

  return publicMetadata({
    path: `/articles/${article.slug}`,
    localizedPaths,
    locale,
    title: article.title,
    // An article always has a body; the summary is optional, so the opening of
    // the text is a better description than the generic collection line.
    description: metaDescription(
      article.summary,
      article.body,
      messages["articles.description"],
    ),
    image: article.coverImage,
    type: "article",
    publishedTime: article.publishedAt.toISOString(),
    modifiedTime: article.lastReviewedAt?.toISOString(),
    authors: article.ownerNames,
  });
}

export default async function ArticleDetailPage({
  params,
}: ArticleDetailPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = requirePublicRouteLocale(localeParam);
  const [article, messages] = await Promise.all([
    loadArticle(slug, locale),
    loadPageCatalog(locale, "public-content"),
  ]);
  if (!article) notFound();
  const page = articlePageLabels(messages);

  return (
    <PublicSiteShell
      locale={locale}
      currentPath={`/articles/${slug}`}
      messages={messages}
      width="reading"
    >
      <JsonLd
        data={[
          articleJsonLd({
            locale,
            // This locale's own slug, matching the canonical: the URL the
            // reader arrived on may be another language's path for the same
            // read.
            slug: article.slug,
            title: article.title,
            description: metaDescription(article.summary, article.body),
            publishedAt: article.publishedAt.toISOString(),
            modifiedAt: article.lastReviewedAt?.toISOString(),
            authors: article.ownerNames,
            image: article.coverImage?.url,
            inLanguage: article.languageCode,
          }),
          breadcrumbJsonLd({
            locale,
            trail: [
              { name: messages["public.nav.home"], path: "/" },
              { name: page.title, path: "/articles" },
              { name: article.title, path: `/articles/${article.slug}` },
            ],
          }),
        ]}
      />
      <PublicArticleDetailView
        eyebrow={page.eyebrow}
        article={articleDetail({ article, locale, messages })}
        labels={articleLabels(messages)}
      />
    </PublicSiteShell>
  );
}
