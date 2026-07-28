import { z } from "zod";

import { loadEventDetailPayload } from "~/server/content/public-event-payload";
import {
  publicJson,
  publicNotFound,
  requestedPublicLocale,
} from "~/server/content/public-api";

/** One public event by id. Any other tier is a 404 here, as on the site. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = z
    .string()
    .uuid()
    .safeParse((await params).id);
  if (!parsed.success) return publicNotFound();
  const payload = await loadEventDetailPayload(
    parsed.data,
    requestedPublicLocale(request),
  );
  return payload ? publicJson(payload) : publicNotFound();
}
