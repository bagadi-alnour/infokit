import { loadGuideListPayload } from "~/server/content/public-guide-payload";
import { publicJson, requestedPublicLocale } from "~/server/content/public-api";

/** Every published guide, as cards the reader can start. */
export async function GET(request: Request) {
  const locale = requestedPublicLocale(request);
  return publicJson(await loadGuideListPayload(locale));
}
