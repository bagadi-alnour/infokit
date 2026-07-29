"use server";

import {
  magicLinkRequestSchema,
  passwordResetSchema,
  passwordSignInSchema,
  passwordUpdateSchema,
  secondFactorEnrolmentSchema,
  smsChallengeRequestSchema,
  smsVerificationSchema,
} from "@infokit/validation/auth";
import { resolveLocale, type Locale } from "@infokit/shared/i18n";
import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { localeCookieName } from "~/i18n/constants";
import { authPath, localizedPath } from "~/i18n/routing";
import { env } from "~/env";
import { auth, signIn, signOut } from "~/server/auth";
import { sendPasswordResetEmail } from "~/server/auth/aws";
import { createDatabaseSession } from "~/server/auth/database-session";
import { canSignIn } from "~/server/auth/eligibility";
import { linkPendingMemberships } from "~/server/auth/link-memberships";
import { authenticatePassword, hashPassword } from "~/server/auth/password";
import {
  issuePasswordResetToken,
  resetPasswordWithToken,
} from "~/server/auth/password-reset";
import { requireEditor } from "~/server/auth/require";
import {
  createSecondFactorChallenge,
  enrolSecondFactorNumber,
  verifySecondFactorCode,
  type SendChallengeResult,
} from "~/server/auth/second-factor";
import { safeReturnTo } from "~/server/auth/return-to";
import { recordAudit } from "~/server/audit";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";

function formLocale(formData: FormData): Locale {
  const value = formData.get("locale");
  return resolveLocale(typeof value === "string" ? value : undefined);
}

export type PasswordResetRequestState = {
  error?: "account_not_found" | "invalid" | "unavailable";
};

export type MagicLinkRequestState = {
  error?: "account_not_found" | "invalid" | "unavailable";
};

export type PasswordSignInState = {
  error?: "account_not_found" | "invalid_credentials" | "invalid";
};

export async function requestMagicLink(
  _previousState: MagicLinkRequestState,
  formData: FormData,
): Promise<MagicLinkRequestState> {
  const parsed = magicLinkRequestSchema.safeParse({
    email: formData.get("email"),
    locale: formData.get("locale"),
    returnTo: formData.get("returnTo"),
  });
  if (!parsed.success) {
    return { error: "invalid" };
  }

  const returnTo = safeReturnTo(parsed.data.returnTo, parsed.data.locale);
  (await cookies()).set(localeCookieName, parsed.data.locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });

  // Reject an unknown address before Auth.js creates a token or invokes any
  // delivery provider. A live invitation still counts as a known identity:
  // accepting one is how the product creates the invited person's account.
  if (!(await canSignIn(parsed.data.email))) {
    const [account] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);
    // The address is not retained in the trail even though the form now says
    // that no account is attached to it: a typo must not become stored data.
    await recordAudit({
      action: "auth.magic_link.refused",
      subjectType: "auth.session",
      subjectId: account?.id ?? null,
      actorUserId: account?.id ?? null,
      outcome: "denied",
      severity: "warning",
      errorCode: "not_eligible",
      actorType: account ? "user" : "system",
    });
    return { error: account ? "unavailable" : "account_not_found" };
  }

  try {
    await signIn("ses", {
      email: parsed.data.email,
      locale: parsed.data.locale,
      redirectTo: returnTo,
      redirect: false,
    });
    redirect(authPath("check", parsed.data.locale));
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "unavailable" };
    }
    throw error;
  }
}

/**
 * Password reset for the email/password method. A single-use token is emailed
 * as a dedicated reset link (never a magic link, so it grants no session and
 * is not gated by SMS): clicking it lands on /login/reset/<token> to set a new
 * password. Unlike the magic-link request, this form tells the person when no
 * account exists for the address, as the account recovery UX requires.
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
  if (!parsed.success) {
    return { error: "invalid" };
  }

  (await cookies()).set(localeCookieName, parsed.data.locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });

  // Only mail people the platform knows. The address itself is still omitted
  // from the audit row even though this form now explains an unknown account.
  if (!(await canSignIn(parsed.data.email))) {
    const [account] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);
    await recordAudit({
      action: "auth.password.reset_refused",
      subjectType: "auth.user",
      subjectId: account?.id ?? null,
      actorUserId: account?.id ?? null,
      outcome: "denied",
      severity: "warning",
      errorCode: "not_eligible",
      actorType: account ? "user" : "system",
    });
    return { error: account ? "unavailable" : "account_not_found" };
  }

  const result = await issuePasswordResetToken(parsed.data.email);
  if (result.status === "unknown") {
    return { error: "account_not_found" };
  }
  if (result.status === "issued") {
    const url = `${env.SITE_URL}${localizedPath(
      `/login/reset/${result.token}`,
      parsed.data.locale,
    )}`;
    await sendPasswordResetEmail({
      email: parsed.data.email,
      url,
      locale: parsed.data.locale,
    });
  }
  redirect(authPath("check", parsed.data.locale));
}

/**
 * Consume a reset token and set the new password. On success the editor is
 * sent to the login page to sign in with the new password (SMS still applies
 * to the session itself, not to the reset).
 */
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

  const success = await resetPasswordWithToken({
    token: parsed.data.token,
    newPassword: parsed.data.password,
  });
  if (!success) {
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
  if (!parsed.success) {
    return { error: "invalid" };
  }

  const authentication = await authenticatePassword(
    parsed.data.email,
    parsed.data.password,
  );
  const user = authentication.user;
  const eligible =
    authentication.status === "authenticated" &&
    (await canSignIn(authentication.user.email));
  if (authentication.status !== "authenticated" || !eligible) {
    /**
     * The refusal is recorded, and the address is not: even though the page now
     * explains when no account exists, a typo or somebody's guess must not
     * become a retained email-address list. The row carries the account only
     * when one exists, and which gate said no.
     */
    await recordAudit({
      action: "auth.password.signin_failed",
      subjectType: "auth.session",
      subjectId: user?.id ?? null,
      actorUserId: user?.id ?? null,
      actorType: user ? "user" : "system",
      outcome: "denied",
      severity: "warning",
      errorCode:
        authentication.status === "account_not_found"
          ? "account_not_found"
          : authentication.status === "invalid_credentials"
            ? "invalid_credentials"
            : "not_eligible",
    });
    return {
      error:
        authentication.status === "account_not_found"
          ? "account_not_found"
          : "invalid_credentials",
    };
  }

  const authenticatedUser = authentication.user;
  await createDatabaseSession(authenticatedUser.id);
  await linkPendingMemberships({
    userId: authenticatedUser.id,
    email: authenticatedUser.email,
  });
  await recordAudit({
    action: "auth.password.signed_in",
    subjectType: "auth.session",
    subjectId: authenticatedUser.id,
    actorUserId: authenticatedUser.id,
  });
  redirect(authPath("verify", parsed.data.locale, { returnTo }));
}

export async function updatePassword(formData: FormData) {
  const locale = formLocale(formData);
  const user = await requireEditor(locale);
  const parsed = passwordUpdateSchema.safeParse({
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) {
    redirect(
      `${localizedPath("/dashboard/account/password", locale)}?error=password`,
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db
    .update(users)
    .set({ passwordHash, passwordUpdatedAt: new Date() })
    .where(eq(users.id, user.id));
  await recordAudit({
    action: "auth.password.updated",
    subjectType: "auth.user",
    subjectId: user.id,
    actorUserId: user.id,
  });
  redirect(
    `${localizedPath("/dashboard/account/password", locale)}?status=updated`,
  );
}

/** Where a send attempt lands: back on the verify page, saying what happened. */
function verifyPathFor(
  locale: Locale,
  returnTo: string,
  result: SendChallengeResult,
) {
  return authPath("verify", locale, {
    returnTo,
    status: result === "sent" ? "sent" : undefined,
    error:
      result === "sent"
        ? undefined
        : result === "unavailable"
          ? "send_error"
          : result,
  });
}

/**
 * Record the number this account will receive codes on and send the first code
 * to it. Nothing is proven here: the number stays unverified until a code comes
 * back, so a typo is fixed by enrolling again rather than by asking anyone for
 * help. Used both by the first-sign-in ask that a mandating role triggers and
 * by anyone turning the step-up on for themselves.
 */
export async function enrolSecondFactorPhone(formData: FormData) {
  const locale = formLocale(formData);
  const session = await auth();
  if (!session?.user.email) redirect(authPath("login", locale));

  const returnTo = safeReturnTo(formData.get("returnTo"), locale);
  const parsed = secondFactorEnrolmentSchema.safeParse({
    phone: formData.get("phone"),
    locale: formData.get("locale"),
    returnTo: formData.get("returnTo"),
  });
  if (!parsed.success) {
    redirect(authPath("verify", locale, { returnTo, error: "phone" }));
  }

  await enrolSecondFactorNumber({
    userId: session.user.id,
    phone: parsed.data.phone,
  });
  const result = await createSecondFactorChallenge({
    userId: session.user.id,
    email: session.user.email,
    locale: parsed.data.locale,
  });
  redirect(verifyPathFor(parsed.data.locale, returnTo, result));
}

export async function sendSecondFactorCode(formData: FormData) {
  const locale = formLocale(formData);
  const session = await auth();
  if (!session?.user.email) redirect(authPath("login", locale));
  if (session.secondFactorVerified) {
    redirect(safeReturnTo(formData.get("returnTo"), locale));
  }

  const parsed = smsChallengeRequestSchema.safeParse({
    locale: formData.get("locale"),
    returnTo: formData.get("returnTo"),
  });
  if (!parsed.success) {
    redirect(authPath("verify", formLocale(formData), { error: "send_error" }));
  }

  const returnTo = safeReturnTo(parsed.data.returnTo, parsed.data.locale);
  const result = await createSecondFactorChallenge({
    userId: session.user.id,
    email: session.user.email,
    locale: parsed.data.locale,
  });
  redirect(verifyPathFor(parsed.data.locale, returnTo, result));
}

export async function confirmSecondFactorCode(formData: FormData) {
  const locale = formLocale(formData);
  const session = await auth();
  if (!session?.user) redirect(authPath("login", locale));

  const parsed = smsVerificationSchema.safeParse({
    code: formData.get("code"),
    locale: formData.get("locale"),
    returnTo: formData.get("returnTo"),
  });
  const returnTo = safeReturnTo(formData.get("returnTo"), locale);
  if (!parsed.success) {
    redirect(
      authPath("verify", formLocale(formData), { error: "invalid", returnTo }),
    );
  }

  const verified = await verifySecondFactorCode({
    userId: session.user.id,
    code: parsed.data.code,
  });
  if (!verified) {
    redirect(
      authPath("verify", parsed.data.locale, {
        error: "invalid",
        returnTo,
      }),
    );
  }
  redirect(returnTo);
}

export async function endEditorSession(formData: FormData) {
  await signOut({ redirectTo: authPath("login", formLocale(formData)) });
}
