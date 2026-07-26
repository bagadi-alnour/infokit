import { loadActivityListPayload } from "~/server/content/public-activity-payload";
import { publicJson, requestedPublicLocale } from "~/server/content/public-api";

/** The published activities of the reader's language, already presented. */
export async function GET(request: Request) {
  const locale = requestedPublicLocale(request);
  return publicJson(await loadActivityListPayload(locale));
}
