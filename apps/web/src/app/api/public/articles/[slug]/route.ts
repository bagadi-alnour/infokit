import { loadArticleDetailPayload } from "~/server/content/public-article-payload";
import {
  publicJson,
  publicNotFound,
  requestedPublicLocale,
} from "~/server/content/public-api";

/** One published article by slug, or 404 when nothing is published under it. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const payload = await loadArticleDetailPayload(
    slug,
    requestedPublicLocale(request),
  );
  return payload ? publicJson(payload) : publicNotFound();
}
