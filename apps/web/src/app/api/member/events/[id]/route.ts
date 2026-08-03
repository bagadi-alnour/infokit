import { z } from "zod";

import { recordRestrictedRead } from "~/server/audit/reads";
import { memberViewer } from "~/server/auth/member-viewer";
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
  const viewer = await memberViewer(request);
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
  if (!payload) {
    // A member session asking by id for an event its memberships do not open.
    // The answer stays 404 — the tier hides existence — and the attempt is
    // written down, because a phone walking a list of ids looks like nothing at
    // all from one request.
    await recordRestrictedRead({
      action: "event.detail_read_refused",
      subjectType: "coordination_event",
      subjectId: parsed.data,
      actorUserId: viewer.userId,
      outcome: "denied",
      errorCode: "event_not_readable",
    });
    return memberJson({ error: "not_found" }, 404);
  }
  return memberJson(payload);
}
