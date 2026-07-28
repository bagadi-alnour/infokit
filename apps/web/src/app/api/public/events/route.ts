import { loadEventListPayload } from "~/server/content/public-event-payload";
import {
  publicJson,
  requestedMonth,
  requestedPublicLocale,
} from "~/server/content/public-api";

/**
 * The public agenda: only events an organisation deliberately opened to
 * everyone. `?month=YYYY-MM` moves the calendar labels, never the reach.
 */
export async function GET(request: Request) {
  const locale = requestedPublicLocale(request);
  const payload = await loadEventListPayload(locale, requestedMonth(request));
  return publicJson(payload);
}
