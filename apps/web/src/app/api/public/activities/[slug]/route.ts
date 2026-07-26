import { loadActivityDetailPayload } from "~/server/content/public-activity-payload";
import {
  publicJson,
  publicNotFound,
  requestedPublicLocale,
} from "~/server/content/public-api";

/** One published activity by slug, or 404 when nothing is published under it. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const payload = await loadActivityDetailPayload(
    slug,
    requestedPublicLocale(request),
  );
  return payload ? publicJson(payload) : publicNotFound();
}
