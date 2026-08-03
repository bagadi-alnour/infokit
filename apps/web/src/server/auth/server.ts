import { expo } from "@better-auth/expo";
import { isLocale, type Locale } from "@infokit/shared/i18n";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import {
  bearer,
  magicLink,
  oneTimeToken,
  twoFactor,
} from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { env } from "~/env";
import { localeCookieName } from "~/i18n/constants";
import { localizedPath } from "~/i18n/routing";
import { recordAudit } from "~/server/audit";
import { db } from "~/server/db";
import {
  accounts,
  rateLimits,
  sessions,
  twoFactors,
  users,
  verificationTokens,
} from "~/server/db/schema";
import { sendMagicLinkEmail, sendPasswordResetEmail, sendSmsCode } from "./aws";
import { canSignIn } from "./eligibility";
import { linkPendingMemberships } from "./link-memberships";
import { secondFactorSessionStamp } from "./second-factor-stamp";
import { secondFactorNumber } from "./second-factor";
import { trustedDeviceMaxAgeSeconds } from "./trusted-device";

/**
 * The Better Auth instance: the one place that mints sessions.
 *
 * It is exported as `auth` because that is the name Better Auth's own CLI and
 * documentation use, and because `~/server/auth` re-exports it as `authServer`
 * so that `auth()` can keep meaning "the signed-in editor" everywhere in the
 * console. Read `./index.ts` before importing either.
 *
 * What the library now owns, and what it replaced:
 *
 * - Sign-in by emailed link (`magicLink`), by password (`emailAndPassword`),
 *   and the second factor on top of both (`twoFactor`). Four bespoke tables of
 *   single-use tokens and challenges collapsed into Better Auth's
 *   `verification_tokens`, so single-use is implemented once.
 * - Sessions for the phone app as well as the browser: `expo()` trusts the
 *   app's scheme, `bearer()` lets a native client present the session as an
 *   `Authorization` header instead of a cookie. The app therefore signs in
 *   itself rather than borrowing a browser session through a hand-off code.
 *
 * What it deliberately does not own: who is *allowed* to hold a session. There
 * is no public signup anywhere in this product, so `canSignIn` still decides,
 * and it is wired into the database hooks below rather than into a login form —
 * a gate on the form only guards the form.
 */

/**
 * The reader's language for a message Better Auth is about to send.
 *
 * Better Auth hands its senders the request, not our form state, so the locale
 * is read from the cookie the login page sets before asking for a link. The
 * argument is typed structurally because the library is not consistent about it:
 * some senders receive a bare `Request`, others the endpoint context that wraps
 * one. Both carry the headers, which is all this needs.
 *
 * French is the fallback because it is the platform's first language, not
 * because the cookie is expected to be missing.
 */
function localeFromRequest(
  source?: { request?: Request; headers?: Headers } | Request,
): Locale {
  const headers =
    source instanceof Request
      ? source.headers
      : (source?.request?.headers ?? source?.headers);
  const cookie = headers?.get("cookie");
  if (!cookie) return "fr";
  const value = cookie
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === localeCookieName)?.[1];
  const decoded = value ? decodeURIComponent(value) : null;
  return isLocale(decoded) ? decoded : "fr";
}

/** The address behind a user id, for the gates that are handed only an id. */
async function emailForUser(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.email ?? null;
}

/** The one refusal an ineligible address ever sees, whichever gate said no. */
function notEligible(): APIError {
  return new APIError("FORBIDDEN", {
    code: "NOT_ELIGIBLE",
    message: "This address is not allowed to sign in.",
  });
}

export const auth = betterAuth({
  appName: "InfoKit",
  baseURL: env.SITE_URL,
  /**
   * The existing 32-byte application secret, kept under its own name. Better
   * Auth would also read `BETTER_AUTH_SECRET`, but renaming it would mean
   * re-keying every deployment for no gain — and rotating it would sign every
   * live session out, which is a decision, not a migration step.
   */
  secret: env.AUTH_SECRET,
  /**
   * Where a sign-in may be initiated from. The site itself, plus the phone
   * app's scheme; Expo's development scheme is added by `expo()` in
   * development only.
   */
  trustedOrigins: [env.SITE_URL, "infokit://"],

  database: drizzleAdapter(db, {
    provider: "pg",
    /**
     * Keyed by Better Auth's model names, valued with our tables — the tables
     * are plural and live in the `auth` PostgreSQL schema, which the library
     * has no opinion about. Field names are read off the Drizzle property
     * names, and those already match Better Auth's (`expiresAt`, `userId`,
     * `twoFactorEnabled`), so no field mapping is needed.
     */
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verificationTokens,
      twoFactor: twoFactors,
      rateLimit: rateLimits,
    },
  }),

  advanced: {
    database: {
      /**
       * Let PostgreSQL mint the keys. Better Auth's default is a random text
       * id, and this database's `users.id` is a real `uuid` that eighty-odd
       * columns point at (docs/DATABASE-SCHEMA.md §4).
       */
      generateId: "uuid",
    },
  },

  session: {
    /** The same eight hours the console has always granted. */
    expiresIn: 8 * 60 * 60,
    updateAge: 60 * 60,
    additionalFields: {
      /**
       * Whether *this* session passed a second factor — declared so Better
       * Auth's adapter carries the column, and `input: false` so no client can
       * assert it. Written by `secondFactorSessionStamp()` below; the schema
       * module explains why the account-level flag is not a substitute.
       */
      secondFactorVerifiedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
    /**
     * Deliberately no `cookieCache`. It would let `getSession` answer from a
     * signed cookie instead of the table, which is faster and would also mean a
     * revoked session kept working until the cache expired. Revocation is a
     * security control here — an administrator ending a session, a person
     * signing a lost phone out — so every read goes to the row that can be
     * deleted.
     */
  },

  emailAndPassword: {
    enabled: true,
    /**
     * An account exists because somebody was invited, so the address is known
     * good before a password is ever set; the emailed link is what proves the
     * mailbox, and it is a sign-in method in its own right.
     */
    requireEmailVerification: false,
    minPasswordLength: 12,
    sendResetPassword: async ({ user, token }, request) => {
      const locale = localeFromRequest(request);
      // Our own localized page rather than Better Auth's redirect: the reset
      // form is a page in the site's language, and the token is all it needs.
      const url = `${env.SITE_URL}${localizedPath(`/login/reset/${token}`, locale)}`;
      await sendPasswordResetEmail({ email: user.email, url, locale });
    },
    onPasswordReset: async ({ user }) => {
      await recordAudit({
        action: "auth.password.reset_completed",
        subjectType: "auth.user",
        subjectId: user.id,
        actorUserId: user.id,
      });
    },
  },

  plugins: [
    twoFactor({
      issuer: "InfoKit",
      /**
       * The console's sign-in is usually an emailed link, so most accounts hold
       * no password at all. Without this, enrolling a second factor would
       * demand one and the people whose roles *mandate* the factor would be the
       * ones unable to arm it.
       */
      allowPasswordless: true,
      totpOptions: { digits: 6, period: 30 },
      backupCodeOptions: {
        amount: 10,
        length: 10,
        /** Encrypted at rest with the application secret, never plain. */
        storeBackupCodes: "encrypted",
      },
      otpOptions: {
        /** Minutes, which is Better Auth's unit here. */
        period: 10,
        digits: 6,
        /** Only a digest reaches the table; the code lives in the message. */
        storeOTP: "hashed",
        sendOTP: async ({ user, otp }, request) => {
          const recipient = await secondFactorNumber(user.id);
          // An account with no number cannot be sent a code, and saying so is
          // better than a silent success that looks like a lost message.
          if (!recipient) {
            throw new APIError("BAD_REQUEST", {
              code: "NO_PHONE_ENROLLED",
              message: "No mobile number is enrolled on this account.",
            });
          }
          await sendSmsCode({
            phone: recipient.phone,
            code: otp,
            locale: localeFromRequest(request),
            userId: user.id,
          });
        },
      },
      /**
       * A stolen phone must not be brute-forceable at leisure. Better Auth
       * counts failures on the account's own row and locks it out; five is the
       * same ceiling the hand-rolled SMS challenge used.
       */
      accountLockout: {
        enabled: true,
        maxFailedAttempts: 5,
        durationSeconds: 15 * 60,
      },
      /**
       * How long the library's own trust marker lives, kept equal to the
       * lifetime of the row that is the real record. `./trusted-device`
       * explains why there are two: the marker suppresses Better Auth's own
       * interception on a password sign-in, which nothing outside the library
       * can do, and the row is what every other path reads.
       */
      trustDeviceMaxAge: trustedDeviceMaxAgeSeconds,
    }),

    magicLink({
      expiresIn: 15 * 60,
      /**
       * A link may create the account it belongs to: accepting an invitation is
       * how this product makes an invited person's account. The eligibility
       * hooks below are what keep that from becoming public signup.
       */
      disableSignUp: false,
      sendMagicLink: async ({ email, url }, request) => {
        // `sendMagicLinkEmail` refuses unknown addresses itself and records the
        // refusal, so an outsider probing the form gets the same generic
        // response as anyone else and no message is sent.
        await sendMagicLinkEmail({
          email,
          url,
          locale: localeFromRequest(request),
        });
      },
    }),

    /**
     * How a magic link finishes in the phone app.
     *
     * The link can only be verified where it is opened — the system browser —
     * and Better Auth sets the session cookie in *that* jar, which the app
     * cannot read. So the browser lands on `/login/device`, which mints a
     * short-lived token from the session it now holds and deep-links it to the
     * app; the app trades it for the same session through its own client, and
     * `expoClient` stores the cookie that comes back.
     *
     * This is the device hand-off the migration deleted, rebuilt on the library:
     * Better Auth owns the token, its expiry and its single use, instead of a
     * bespoke `device_grants` table doing all three by hand.
     */
    oneTimeToken({
      /** Minutes. Long enough to cross an app switch, not a coffee break. */
      expiresIn: 2,
      /** Only a digest reaches the table, as with every other code here. */
      storeToken: "hashed",
    }),

    /**
     * Marks the session row when a factor is passed, or when the device it was
     * passed on is trusted. Must come after the `twoFactor` plugin whose
     * endpoints it observes — and the order is load-bearing for the second case,
     * not merely tidy: the trusted-device hook reads `newSession` to tell "signed
     * in" from "a code is still owed", and it is the twoFactor hook that clears
     * `newSession` when it intercepts.
     */
    secondFactorSessionStamp(),

    /** The phone app's own sessions: its scheme is trusted for deep links. */
    expo(),
    /**
     * …and it may present that session as `Authorization: Bearer <token>`.
     * Native clients have no cookie jar worth relying on, and the member
     * endpoints already spoke bearer.
     */
    bearer(),

    /**
     * Must stay last: it is what lets a server action's `Set-Cookie` survive.
     * Any plugin after it would have its cookies dropped.
     */
    nextCookies(),
  ],

  /**
   * Eligibility and the audit trail, applied to the *table* rather than to any
   * one form — so a new sign-in method inherits both without being asked to
   * remember them.
   */
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // The gate that makes this platform invitation-only. A magic link
          // that reached an address nobody recorded stops here rather than
          // creating the account it names.
          if (!(await canSignIn(user.email))) throw notEligible();
          return { data: user };
        },
        after: async (user) => {
          await recordAudit({
            action: "auth.user.created",
            subjectType: "auth.user",
            subjectId: user.id,
            actorUserId: user.id,
          });
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          /**
           * Re-checked per session, not only per account: eligibility can be
           * withdrawn — a membership ended, an invitation revoked — and an
           * account that already exists would otherwise keep signing in
           * forever on the strength of having once been invited.
           */
          const email = await emailForUser(session.userId);
          if (!email || !(await canSignIn(email))) throw notEligible();
          return { data: session };
        },
        after: async (session) => {
          const email = await emailForUser(session.userId);
          if (email) {
            // An invited person's memberships are waiting on their address
            // until an account exists to attach them to.
            await linkPendingMemberships({ userId: session.userId, email });
          }
          // The actor is named explicitly: this runs while the session is still
          // being established, so asking who is signed in would answer nobody.
          await recordAudit({
            action: "auth.session.created",
            subjectType: "auth.session",
            subjectId: session.userId,
            actorUserId: session.userId,
          });
        },
      },
    },
  },

  /**
   * Throttling, counted in the database so the limit belongs to the deployment
   * rather than to whichever process took the request. These are the paths
   * worth guessing at: a password, a code, or somebody else's mailbox.
   */
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-in/magic-link": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
      "/two-factor/send-otp": { window: 60, max: 2 },
      "/two-factor/verify-otp": { window: 60, max: 5 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 5 },
      "/two-factor/enable": { window: 60, max: 5 },
      "/two-factor/disable": { window: 60, max: 5 },
    },
  },
});
