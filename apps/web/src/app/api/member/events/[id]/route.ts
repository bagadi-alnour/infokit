import { z } from "zod";

import { deviceViewer } from "~/server/auth/device-session";
import { loadMemberEventPayload } from "~/server/content/member-payload";
import {
  memberJson,
  memberUnauthorized,
  requestedPublicLocale,
} from "~/server/content/public-api";

/**
 * One coordination event in full. An event this member may not read answers 404
 * rather than 403: whether a meeting exists is itself part of what a tier hides.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await deviceViewer(request);
  if (!viewer) return memberUnauthorized();
  const parsed = z
    .string()
    .uuid()
    .safeParse((await params).id);
  if (!parsed.success) return memberJson({ error: "not_found" }, 404);
  const payload = await loadMemberEventPayload({
    viewer,
    locale: requestedPublicLocale(request),
    eventId: parsed.data,
  });
  return payload
    ? memberJson(payload)
    : memberJson({ error: "not_found" }, 404);
}
