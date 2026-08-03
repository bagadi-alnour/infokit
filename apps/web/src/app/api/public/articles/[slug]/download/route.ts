import { loadArticleDetailPayload } from "~/server/content/public-article-payload";
import {
  publicNotFound,
  requestedPublicLocale,
} from "~/server/content/public-api";

/**
 * A small, data-light text copy of one published article. It uses the same
 * public read model as the page and API, so drafts and unverified content
 * cannot reach the download route.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const locale = requestedPublicLocale(request);
  const payload = await loadArticleDetailPayload(slug, locale);
  if (!payload) return publicNotFound();

  const { article, labels } = payload;
  const body = [
    article.title,
    article.summary,
    article.articleDateLabel,
    "",
    article.body,
    "",
    `${labels.publishedBy}: ${article.ownerNames.join(", ")}`,
    `${labels.lastReviewed}: ${article.lastReviewedLabel}`,
  ].join("\n");
  const localizedFilename = `${article.title.replaceAll(/[\\/]/g, "-")}.txt`;

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=60, must-revalidate",
      "Content-Disposition": `attachment; filename="infokit-article.txt"; filename*=UTF-8''${encodeURIComponent(localizedFilename)}`,
      "Content-Type": "text/plain; charset=utf-8",
      Vary: "Accept-Language",
    },
  });
}
