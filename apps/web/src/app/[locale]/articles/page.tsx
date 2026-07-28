import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";

import { PublicArticleCollection } from "~/components/public/article-collection";
import {
  PublicPageHeader,
  PublicSiteShell,
} from "~/components/public/public-site-shell";
import { JsonLd } from "~/components/seo/json-ld";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { publicMetadata } from "~/seo/metadata";
import { collectionJsonLd } from "~/seo/structured-data";
import {
  articleLabels,
  articlePageLabels,
  articleSummaries,
} from "~/server/content/public-article-payload";
import { listPublishedArticles } from "~/server/content/public-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = requirePublicRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "public-content");
  const page = articlePageLabels(messages);
  return publicMetadata({
    path: "/articles",
    locale,
    title: page.title,
    description: page.description,
  });
}

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
  const page = articlePageLabels(messages);

  return (
    <PublicSiteShell
      locale={locale}
      currentPath="/articles"
      messages={messages}
    >
      <JsonLd
        data={collectionJsonLd({
          locale,
          name: page.title,
          description: page.description,
          items: articles.map((article) => ({
            name: article.title,
            path: `/articles/${article.slug}`,
          })),
        })}
      />
      <PublicPageHeader
        eyebrow={page.eyebrow}
        title={page.title}
        description={page.description}
        family="article"
      />
      <PublicArticleCollection
        articles={articleSummaries({ articles, locale, messages })}
        labels={articleLabels(messages)}
      />
    </PublicSiteShell>
  );
}
