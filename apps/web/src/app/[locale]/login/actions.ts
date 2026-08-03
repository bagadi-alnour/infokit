"use server";

import { resolveLocale, type Locale } from "@infokit/shared/i18n";
import {
  magicLinkRequestSchema,
  passwordResetSchema,
  passwordSignInSchema,
  smsVerificationSchema,
} from "@infokit/validation/auth";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "~/env";
import { localeCookieName } from "~/i18n/constants";
import { authPath, localizedPath } from "~/i18n/routing";
import { recordAudit } from "~/server/audit";
import { clientAddress } from "~/server/audit/context";
import { authServer } from "~/server/auth";
import { canSignIn } from "~/server/auth/eligibility";
import { safeReturnTo } from "~/server/auth/return-to";
import {
  grantTrustedDevice,
  trustDeviceGrant,
} from "~/server/auth/trusted-device";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";

/**
 * The sign-in surface, on top of Better Auth.
 *
 * Every action here is a thin translation: the form's fields into a Better Auth
 * call, and Better Auth's refusal into a message this product already has words
 * for. What deliberately stays on this side of the line:
 *
 * - **Eligibility.** `canSignIn` is enforced inside Better Auth's own database
 *   hooks (`~/server/auth/server`), which is what makes it unbypassable. It is
 *   consulted *again* here for one reason only: to tell an unknown address apart
 *   from a wrong password, because the recovery UX asks for that distinction and
 *   Better Auth — correctly, for anti-enumeration — refuses to make it.
 * - **The audit trail.** A refused sign-in is the row a security review opens
 *   with, and the address is never written into it.
 */

function formLocale(formData: FormData): Locale {
  const value = formData.get("locale");
  return resolveLocale(typeof value === "string" ? value : undefined);
}

/**
 * Remember the language before handing off to Better Auth: its senders are
 * given the `Request` and read the locale back off this cookie, since the form
 * state does not travel into the library.
 */
async function rememberLocale(locale: Locale) {
  (await cookies()).set(localeCookieName, locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
}

/** The account behind an address, for a refusal that needs to name an id. */
async function accountFor(email: string): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row ?? null;
}

/**
 * Whether this address may sign in, and which refusal to show when it may not.
 * `unavailable` means the account exists but is no longer entitled — a
 * membership that ended — and `account_not_found` means nobody was ever
 * recorded, which is the one a mistyped address needs to see.
 */
async function refusalFor(
  email: string,
  action: string,
  subjectType: string,
): Promise<"account_not_found" | "unavailable" | null> {
  if (await canSignIn(email)) return null;
  const account = await accountFor(email);
  // The address is not retained in the trail even though the form is about to
  // say that no account is attached to it: a typo must not become stored data.
  await recordAudit({
    action,
    subjectType,
    subjectId: account?.id ?? null,
    actorUserId: account?.id ?? null,
    outcome: "denied",
    severity: "warning",
    errorCode: "not_eligible",
    actorType: account ? "user" : "system",
  });
  return account ? "unavailable" : "account_not_found";
}

export type MagicLinkRequestState = {
  error?: "account_not_found" | "invalid" | "unavailable";
};
export type PasswordResetRequestState = {
  error?: "account_not_found" | "invalid" | "unavailable";
};
export type PasswordSignInState = {
  error?: "account_not_found" | "invalid_credentials" | "invalid";
};

/**
 * What a sign-in returns when a second factor stands in the way.
 *
 * Better Auth answers with `{ twoFactorRedirect: true, twoFactorMethods }` and
 * mints no session, but its declared return type describes only the case where
 * it *did* mint one — so the interception has to be read through a shape of our
 * own rather than by narrowing theirs.
 */
interface TwoFactorInterception {
  twoFactorRedirect?: boolean;
  twoFactorMethods?: string[];
}

export async function requestMagicLink(
  _previousState: MagicLinkRequestState,
  formData: FormData,
): Promise<MagicLinkRequestState> {
  const parsed = magicLinkRequestSchema.safeParse({
    email: formData.get("email"),
    locale: formData.get("locale"),
    returnTo: formData.get("returnTo"),
  });
  if (!parsed.success) return { error: "invalid" };

  const returnTo = safeReturnTo(parsed.data.returnTo, parsed.data.locale);
  await rememberLocale(parsed.data.locale);

  const refusal = await refusalFor(
    parsed.data.email,
    "auth.magic_link.refused",
    "auth.session",
  );
  if (refusal) return { error: refusal };

  try {
    await authServer.api.signInMagicLink({
      body: { email: parsed.data.email, callbackURL: returnTo },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) return { error: "unavailable" };
    throw error;
  }
  redirect(authPath("check", parsed.data.locale));
}

/**
 * Password recovery. The emailed link lands on `/login/reset/<token>`, which
 * grants no session — so a reset is not gated by the second factor, and cannot
 * be used as a way around it.
 */
export async function requestPasswordReset(
  _previousState: PasswordResetRequestState,
  formData: FormData,
): Promise<PasswordResetRequestState> {
  const locale = formLocale(formData);
  const parsed = magicLinkRequestSchema.safeParse({
    email: formData.get("email"),
    locale: formData.get("locale"),
    returnTo: localizedPath("/dashboard/account/password", locale),
  });
  if (!parsed.success) return { error: "invalid" };

  await rememberLocale(parsed.data.locale);

  const refusal = await refusalFor(
    parsed.data.email,
    "auth.password.reset_refused",
    "auth.user",
  );
  if (refusal) return { error: refusal };

  try {
    await authServer.api.requestPasswordReset({
      body: {
        email: parsed.data.email,
        redirectTo: `${env.SITE_URL}${localizedPath("/login", parsed.data.locale)}`,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) return { error: "unavailable" };
    throw error;
  }
  redirect(authPath("check", parsed.data.locale));
}

/** Consume a reset token and set the new password. */
export async function resetPassword(formData: FormData) {
  const locale = formLocale(formData);
  const token = formData.get("token");
  const tokenValue = typeof token === "string" ? token : "";
  const parsed = passwordResetSchema.safeParse({
    token: tokenValue,
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) {
    redirect(
      `${localizedPath(`/login/reset/${tokenValue}`, locale)}?error=password`,
    );
  }

  let failed = false;
  try {
    await authServer.api.resetPassword({
      body: { newPassword: parsed.data.password, token: parsed.data.token },
      headers: await headers(),
    });
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    failed = true;
  }
  if (failed) {
    redirect(authPath("login", parsed.data.locale, { error: "reset" }));
  }
  redirect(authPath("login", parsed.data.locale, { status: "reset" }));
}

export async function signInWithPassword(
  _previousState: PasswordSignInState,
  formData: FormData,
): Promise<PasswordSignInState> {
  const locale = formLocale(formData);
  const parsed = passwordSignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    locale: formData.get("locale"),
    returnTo: formData.get("returnTo"),
  });
  const returnTo = safeReturnTo(formData.get("returnTo"), locale);
  if (!parsed.success) return { error: "invalid" };

  await rememberLocale(parsed.data.locale);

  // Told apart before Better Auth is asked, because Better Auth answers both
  // with the same 401 by design and this form needs to distinguish them.
  if (!(await canSignIn(parsed.data.email))) {
    const account = await accountFor(parsed.data.email);
    await recordAudit({
      action: "auth.password.signin_failed",
      subjectType: "auth.session",
      subjectId: account?.id ?? null,
      actorUserId: account?.id ?? null,
      actorType: account ? "user" : "system",
      outcome: "denied",
      severity: "warning",
      errorCode: account ? "not_eligible" : "account_not_found",
    });
    return { error: account ? "invalid_credentials" : "account_not_found" };
  }

  // `redirect()` throws, so the outcome is decided first and acted on after —
  // inside the `try` its control-flow error would be caught as a failure.
  let pendingSecondFactor: string[] | null = null;
  try {
    const result = await authServer.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    });
    // Widened rather than narrowed: the declared type has none of these
    // properties, so `in` cannot reach them (see `TwoFactorInterception`).
    const outcome = result as typeof result & TwoFactorInterception;
    if (outcome.twoFactorRedirect) {
      pendingSecondFactor = outcome.twoFactorMethods ?? [];
    }
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    const account = await accountFor(parsed.data.email);
    await recordAudit({
      action: "auth.password.signin_failed",
      subjectType: "auth.session",
      subjectId: account?.id ?? null,
      actorUserId: account?.id ?? null,
      actorType: account ? "user" : "system",
      outcome: "denied",
      severity: "warning",
      errorCode: "invalid_credentials",
    });
    return { error: "invalid_credentials" };
  }

  if (pendingSecondFactor) {
    redirect(
      authPath("verify", parsed.data.locale, {
        returnTo,
        methods: pendingSecondFactor.join(",") || undefined,
      }),
    );
  }
  // No factor armed: Better Auth has already minted the session, and the
  // console's own gate decides whether a role obliges this account to enrol.
  redirect(returnTo);
}

/* ------------------------------------------------------------------------- */
/* The second factor, at sign-in                                             */
/*                                                                           */
/* These run with no session: Better Auth mints one only once a code comes    */
/* back, and until then the pending account is carried by its own signed      */
/* cookie. That is why nothing here takes a user id — the cookie on the       */
/* request is the subject, and reading it is the library's business.          */
/* ------------------------------------------------------------------------- */

/**
 * Where a failed or partial attempt lands: back on the page, saying why.
 *
 * `trust` rides along so that a device the reader asked to trust is still asked
 * for after a mistyped code — or after the redirect that sends the SMS, where the
 * ticked box is on a form that verifies nothing. It grants nothing by itself:
 * the trust is recorded only once a code has actually been accepted.
 */
function verifyPath(
  locale: Locale,
  returnTo: string,
  methods: string | null,
  outcome: { status?: string; error?: string; trust?: boolean },
) {
  const { trust, ...rest } = outcome;
  return authPath("verify", locale, {
    returnTo,
    methods: methods ?? undefined,
    trust: trust ? "1" : undefined,
    ...rest,
  });
}

function challengeContext(formData: FormData) {
  const locale = formLocale(formData);
  const methods = formData.get("methods");
  return {
    locale,
    returnTo: safeReturnTo(formData.get("returnTo"), locale),
    methods: typeof methods === "string" && methods ? methods : null,
    trust: trustDeviceGrant(formData),
  };
}

/** Send a one-time code to the number enrolled on the pending account. */
export async function sendSmsChallenge(formData: FormData) {
  const { locale, returnTo, methods, trust } = challengeContext(formData);
  let outcome: { status?: string; error?: string; trust?: boolean } = {
    status: "sent",
    trust,
  };
  try {
    await authServer.api.sendTwoFactorOTP({
      body: {},
      headers: await headers(),
    });
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    // Told apart because they need different words: a rate limit will pass,
    // a missing number never will until somebody enrols one.
    outcome = {
      error:
        error.body?.code === "NO_PHONE_ENROLLED"
          ? "no_phone"
          : error.status === "TOO_MANY_REQUESTS"
            ? "rate_limited"
            : "send_error",
      trust,
    };
  }
  redirect(verifyPath(locale, returnTo, methods, outcome));
}

/**
 * Confirm a code. Which kind it is comes from the form rather than from a guess:
 * an authenticator code and an SMS code are both six digits, and offering one to
 * the wrong verifier would spend an attempt out of the five before the account
 * locks itself.
 */
export async function confirmSecondFactorCode(formData: FormData) {
  const {
    locale,
    returnTo,
    methods,
    trust: trustDevice,
  } = challengeContext(formData);
  const method = formData.get("method") === "otp" ? "otp" : "totp";
  const parsed = smsVerificationSchema.safeParse({
    code: formData.get("code"),
    locale: formData.get("locale"),
    returnTo: formData.get("returnTo"),
  });
  if (!parsed.success) {
    redirect(
      verifyPath(locale, returnTo, methods, {
        error: "invalid",
        trust: trustDevice,
      }),
    );
  }

  /**
   * "Trust this device", both halves of it.
   *
   * `trustDevice` is Better Auth's, and it is honoured only where this code is
   * answering an intercepted *password* sign-in; on a step-up — which is what an
   * emailed link produces, and so what most codes here are answering — the
   * library ignores it. `grantTrustedDevice` is the durable half, and the one
   * every path actually reads. `~/server/auth/trusted-device` explains why it
   * takes two.
   */
  const requestHeaders = await headers();

  let failed: string | null = null;
  let verifiedUserId: string | null = null;
  try {
    const request = {
      body: { code: parsed.data.code, trustDevice },
      headers: requestHeaders,
    };
    const result =
      method === "otp"
        ? await authServer.api.verifyTwoFactorOTP(request)
        : await authServer.api.verifyTOTP(request);
    /**
     * Who the code belonged to. Read from the response rather than from a
     * session, because on the interception path there was no session until this
     * call returned — the pending account was carried by Better Auth's own
     * cookie, and its `user` is the only thing here that names it.
     */
    const verified = result as { user?: { id?: unknown } } | undefined;
    verifiedUserId =
      typeof verified?.user?.id === "string" ? verified.user.id : null;
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    failed = error.status === "TOO_MANY_REQUESTS" ? "locked" : "invalid";
  }

  if (failed) {
    // Better Auth counts the failure and locks the account itself; the trail
    // records that a wrong code was offered, never the code.
    await recordAudit({
      action: "auth.second_factor.failed",
      subjectType: "auth.session",
      actorType: "system",
      outcome: "denied",
      severity: "warning",
      errorCode: failed === "locked" ? "locked_out" : "invalid_code",
    });
    redirect(
      verifyPath(locale, returnTo, methods, {
        error: failed,
        trust: trustDevice,
      }),
    );
  }

  /**
   * Recorded after the code was accepted, never before: the factor is what earns
   * the trust. A grant that cannot name its account is skipped rather than
   * guessed at — the sign-in itself has already succeeded, so the only cost is
   * being asked for a code again next time.
   */
  if (trustDevice && verifiedUserId) {
    await grantTrustedDevice({
      userId: verifiedUserId,
      userAgent: requestHeaders.get("user-agent"),
      ipAddress: clientAddress(requestHeaders),
    });
  }
  redirect(returnTo);
}

/**
 * The way back in when the phone is gone. Each code works once.
 *
 * Trust can be granted from here too, and deliberately so: a backup code is a
 * factor like any other, there are only ten of them, and somebody whose phone is
 * gone would otherwise spend the list one morning at a time. The device is
 * trusted for the same fortnight, and the console still prompts them to arm a new
 * factor.
 */
export async function confirmBackupCode(formData: FormData) {
  const {
    locale,
    returnTo,
    methods,
    trust: trustDevice,
  } = challengeContext(formData);
  const code = formData.get("code");
  const value = typeof code === "string" ? code.trim() : "";
  if (!value) {
    redirect(
      verifyPath(locale, returnTo, methods, {
        error: "invalid",
        trust: trustDevice,
      }),
    );
  }

  const requestHeaders = await headers();
  let failed = false;
  let verifiedUserId: string | null = null;
  try {
    const result = await authServer.api.verifyBackupCode({
      body: { code: value, trustDevice },
      headers: requestHeaders,
    });
    const verified = result as { user?: { id?: unknown } } | undefined;
    verifiedUserId =
      typeof verified?.user?.id === "string" ? verified.user.id : null;
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    failed = true;
  }
  if (failed) {
    await recordAudit({
      action: "auth.second_factor.failed",
      subjectType: "auth.session",
      actorType: "system",
      outcome: "denied",
      severity: "warning",
      errorCode: "invalid_backup_code",
    });
    redirect(
      verifyPath(locale, returnTo, methods, {
        error: "invalid",
        trust: trustDevice,
      }),
    );
  }
  // Worth its own event: a backup code is spent, and somebody who needed one has
  // lost their factor and should be prompted to arm a new one.
  await recordAudit({
    action: "auth.second_factor.backup_code_used",
    subjectType: "auth.session",
    severity: "warning",
  });
  if (trustDevice && verifiedUserId) {
    await grantTrustedDevice({
      userId: verifiedUserId,
      userAgent: requestHeaders.get("user-agent"),
      ipAddress: clientAddress(requestHeaders),
    });
  }
  redirect(returnTo);
}

export async function endEditorSession(formData: FormData) {
  const locale = formLocale(formData);
  // Recorded before the session goes, while there is still a session to name
  // as the actor.
  await recordAudit({
    action: "auth.session.signed_out",
    subjectType: "auth.session",
  });
  try {
    await authServer.api.signOut({ headers: await headers() });
  } catch (error) {
    // A session that has already expired cannot be signed out of, and the
    // person asking to leave should still arrive at the login page.
    if (!(error instanceof APIError)) throw error;
  }
  /**
   * Signing out is usually the end of the errand, so the login page is the
   * destination. The exception is the person who signed out *in order to* get
   * somewhere — an invitation addressed to their other account — and
   * `safeReturnTo` is what keeps that a first-party path.
   */
  const requested = formData.get("returnTo");
  redirect(
    authPath("login", locale, {
      returnTo:
        typeof requested === "string" && requested
          ? safeReturnTo(requested, locale)
          : undefined,
    }),
  );
}
