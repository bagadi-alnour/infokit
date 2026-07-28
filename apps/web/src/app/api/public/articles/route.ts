import { loadArticleListPayload } from "~/server/content/public-article-payload";
import { publicJson, requestedPublicLocale } from "~/server/content/public-api";

/** The published articles of the reader's language, already presented. */
export async function GET(request: Request) {
  const locale = requestedPublicLocale(request);
  return publicJson(await loadArticleListPayload(locale));
}
