import { loadGuideDetailPayload } from "~/server/content/public-guide-payload";
import {
  publicJson,
  publicNotFound,
  requestedPublicLocale,
} from "~/server/content/public-api";

/**
 * One guide, flattened into the graph a client walks. Answers stay on the
 * device: nothing about a walk is ever sent back here.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const payload = await loadGuideDetailPayload(
    slug,
    requestedPublicLocale(request),
  );
  return payload ? publicJson(payload) : publicNotFound();
}
