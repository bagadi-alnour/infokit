import { createAuthMiddleware } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";
import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { sessions } from "~/server/db/schema";
import { forgetAllTrustedDevices, trustedDeviceFor } from "./trusted-device";

/**
 * Records, on the session row, that this session passed a second factor.
 *
 * Better Auth does not track this, because in its model it does not need to: the
 * factor is a *sign-in interception*, so a session either exists (the code was
 * given) or it does not. That reasoning holds only for the three paths the
 * twoFactor plugin actually intercepts — `/sign-in/email`, `/sign-in/username`
 * and `/sign-in/phone-number`. A magic link is none of them, and neither is the
 * one-time-token hand-off the phone app uses, so both would otherwise mint a
 * complete session for an account whose role *mandates* a factor without ever
 * asking for a code.
 *
 * Hence a per-session fact, written here and read by `requireEditor`. It lives
 * in a plugin rather than in the server actions because the phone app calls
 * Better Auth's verify endpoints directly — a stamp applied in our own actions
 * would cover the browser and quietly miss the app.
 *
 * There are two ways a session comes to hold the stamp, and they are two hooks
 * below: a code was confirmed, or the device was already trusted.
 */

/** A token to stamp, from wherever this response happens to carry one. */
async function stampSession(token: string): Promise<void> {
  await db
    .update(sessions)
    .set({ secondFactorVerifiedAt: new Date() })
    .where(eq(sessions.token, token));
}

export function secondFactorSessionStamp(): BetterAuthPlugin {
  return {
    id: "second-factor-session-stamp",
    hooks: {
      after: [
        /**
         * A code was confirmed.
         *
         * The two verification shapes give the session token in different
         * places, so both are consulted:
         *
         * - Finishing a sign-in, or arming the factor, creates a *new* session —
         *   `context.newSession`.
         * - Stepping an existing session up creates nothing and simply returns
         *   the current token — the response body.
         *
         * If neither yields a token the stamp is skipped, which fails in the safe
         * direction: the column stays null, the gate asks again.
         */
        {
          matcher: (context) =>
            context.path === "/two-factor/verify-totp" ||
            context.path === "/two-factor/verify-otp" ||
            context.path === "/two-factor/verify-backup-code",
          handler: createAuthMiddleware(async (ctx) => {
            const created = ctx.context.newSession?.session.token;
            const returned = ctx.context.returned as
              { token?: unknown } | undefined;
            const token =
              created ??
              (typeof returned?.token === "string" ? returned.token : null);
            if (!token) {
              console.warn(
                "[auth] second factor verified but no session token to stamp",
              );
              return;
            }
            await stampSession(token);
          }),
        },

        /**
         * The device was already trusted, so no code was asked for.
         *
         * This is the half of "trust this device" that Better Auth cannot do
         * (see `./trusted-device`). Its own marker suppresses its own
         * interception on a password sign-in and nothing else; a magic link — the
         * usual way in here — is never intercepted, so a trusted device would
         * still be stopped by `requireEditor` for a step-up unless the session it
         * just minted carries the stamp. That is what this writes.
         *
         * Two paths, because those are the two that mint a session for a browser:
         * the password form and the emailed link. The phone app's hand-off
         * (`/one-time-token/apply`) is deliberately absent — trust belongs to a
         * cookie jar, and the app's is not the browser's, so a device trusted in
         * Safari must not silently vouch for a session in the app.
         *
         * The trust is read against the *user the session belongs to*, so a
         * cookie left in a shared browser by somebody else matches nothing.
         */
        {
          matcher: (context) =>
            context.path === "/sign-in/email" ||
            context.path === "/magic-link/verify",
          handler: createAuthMiddleware(async (ctx) => {
            const created = ctx.context.newSession;
            /**
             * Null while a code is still owed: the twoFactor plugin deletes the
             * session it found here and resets `newSession` when it intercepts.
             * Nothing to stamp then, and nothing to skip — the code is about to
             * be asked for.
             */
            if (!created) return;
            /**
             * No factor armed, nothing to skip — and this guard is a security
             * control, not an optimisation. `requireEditor` reads the stamp only
             * to decide whether an account that *must* hold a factor has proved
             * it on this session, and it treats "armed" and "mandated by a role"
             * alike. Stamping an unarmed account would therefore wave a mandated
             * role straight past the enrolment it is being sent to, on the
             * strength of a device trusted while some earlier factor was armed.
             * Trust is cleared when a factor is disabled (below), so this should
             * be unreachable; it is cheap, and the failure it prevents is the
             * expensive kind.
             */
            if (!created.user.twoFactorEnabled) return;
            const trusted = await trustedDeviceFor({
              userId: created.user.id,
              cookieHeader: ctx.headers?.get("cookie") ?? null,
            });
            if (!trusted) return;
            await stampSession(created.session.token);
          }),
        },

        /**
         * The factor was turned off, so nothing may still be trusted to skip it.
         *
         * Here rather than in the server action that offers the button, for the
         * reason this whole plugin exists: the phone app calls Better Auth's
         * endpoints directly, so a cleanup written into our own action would
         * cover the browser and quietly miss every other caller. Better Auth
         * clears its own marker inside this endpoint; this clears the rows that
         * are the real record.
         *
         * A factor turned back on later starts from no trusted devices, which is
         * the honest default: the codes it will issue are new, and consent to
         * skip the old ones was not consent to skip these.
         */
        {
          matcher: (context) => context.path === "/two-factor/disable",
          handler: createAuthMiddleware(async (ctx) => {
            // The endpoint rotates the session, so the new one is the reliable
            // name here; the pre-handler session is the fallback for a response
            // that minted none.
            const userId =
              ctx.context.newSession?.user.id ?? ctx.context.session?.user.id;
            if (!userId) return;
            await forgetAllTrustedDevices(userId);
          }),
        },
      ],
    },
  };
}
