import { APIError } from "better-auth/api";

import { recordAudit } from "~/server/audit";
import { authServer } from "~/server/auth";
import { memberViewer } from "~/server/auth/member-viewer";
import { loadMemberSessionPayload } from "~/server/content/member-payload";
import {
  memberJson,
  memberUnauthorized,
  requestedPublicLocale,
} from "~/server/content/public-api";

/**
 * Who is reading this device. Signed out is a 200, not a 401: the app asks this
 * on every start, and "nobody" is a legitimate answer that carries the door's
 * words with it.
 */
export async function GET(request: Request) {
  const viewer = await memberViewer(request);
  const payload = await loadMemberSessionPayload({
    viewer,
    locale: requestedPublicLocale(request),
  });
  return memberJson(payload);
}

/**
 * Signing out. Better Auth deletes the session row, so the phone stops being
 * trusted here and not only in its own storage — a lost phone is revoked from
 * anywhere.
 *
 * The app can also call `authClient.signOut()` directly. This endpoint stays
 * because it answers in the same shape as the `GET` above, so the app clears the
 * session and the member payload it caches in one round trip.
 */
export async function DELETE(request: Request) {
  const viewer = await memberViewer(request);
  if (!viewer) return memberUnauthorized();
  try {
    await authServer.api.signOut({ headers: request.headers });
  } catch (error) {
    // The session was already gone. The caller asked to be signed out and is,
    // so this is not a failure worth reporting to a phone.
    if (!(error instanceof APIError)) throw error;
  }
  await recordAudit({
    action: "auth.member_session.signed_out",
    subjectType: "auth.session",
    subjectId: viewer.userId,
    actorUserId: viewer.userId,
  });
  return memberJson({ signedOut: true });
}
