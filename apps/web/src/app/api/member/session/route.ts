import {
  deviceViewer,
  revokeDeviceSession,
} from "~/server/auth/device-session";
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
  const viewer = await deviceViewer(request);
  const payload = await loadMemberSessionPayload({
    viewer,
    locale: requestedPublicLocale(request),
  });
  return memberJson(payload);
}

/**
 * Signing out. The session row goes, so the phone stops being trusted here and
 * not only in its own storage — a lost phone is revoked from anywhere.
 */
export async function DELETE(request: Request) {
  const viewer = await deviceViewer(request);
  if (!viewer) return memberUnauthorized();
  await revokeDeviceSession(viewer);
  return memberJson({ signedOut: true });
}
