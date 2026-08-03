import { recordAudit } from "~/server/audit";
import { authServer } from "~/server/auth";

/**
 * Who is calling a member endpoint, from whichever surface.
 *
 * This replaces the hand-rolled device-session reader, and with it the whole
 * hand-off dance the phone app used to perform: it opened the site's sign-in in
 * a browser, the browser minted a nine-digit grant, and the app traded that for
 * a row in a bespoke bearer table. The app signs in for itself now
 * (`@better-auth/expo`), so there is one kind of session again and Better Auth
 * reads it whether it arrives as a cookie or as `Authorization: Bearer …` — the
 * `bearer()` plugin is what makes the second form work.
 *
 * The old reader deliberately ignored cookies, so that a cross-site request
 * could not be authenticated on one. That protection has moved rather than
 * vanished: Better Auth checks the request's origin against `trustedOrigins`,
 * which is a stronger version of the same idea and covers the browser callers
 * this endpoint now legitimately has.
 */
export interface MemberViewer {
  userId: string;
  /** Whether a second factor is armed on the account behind this session. */
  secondFactorVerified: boolean;
  expiresAt: Date;
}

export async function memberViewer(
  request: Request,
): Promise<MemberViewer | null> {
  const result = await authServer.api
    .getSession({ headers: request.headers })
    .catch(() => null);

  if (!result?.user) {
    /**
     * A credential was offered and it opens nothing — revoked, expired, or never
     * ours. The member endpoints answer all three with the same silent 401,
     * which is right for the caller and useless for a review, so the attempt is
     * recorded here: this is the only place that knows one was offered at all. A
     * request with no credential is skipped, because an unauthenticated call to
     * a members-only URL is a crawler.
     *
     * The token never appears in the row. A stolen one is worth nothing here,
     * and the trail is not the place to keep the thing being guessed.
     */
    const presented =
      request.headers.has("authorization") || request.headers.has("cookie");
    if (presented) {
      await recordAudit({
        action: "auth.member_session.rejected",
        subjectType: "auth.session",
        actorType: "system",
        outcome: "denied",
        severity: "warning",
        errorCode: "session_unknown_or_expired",
      });
    }
    return null;
  }

  return {
    userId: result.user.id,
    secondFactorVerified: Boolean(result.user.twoFactorEnabled),
    expiresAt: result.session.expiresAt,
  };
}
