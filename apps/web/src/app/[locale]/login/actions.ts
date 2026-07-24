"use server";

import {
  magicLinkRequestSchema,
  passwordResetSchema,
  passwordSignInSchema,
  passwordUpdateSchema,
  smsChallengeRequestSchema,
  smsVerificationSchema,
} from "@calais/validation/auth";
import { resolveLocale, type Locale } from "@calais/shared/i18n";
import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { localeCookieName } from "~/i18n/constants";
import { authPath, localizedPath } from "~/i18n/routing";
import { env } from "~/env";
import { auth, signIn, signOut } from "~/server/auth";
import { sendPasswordResetEmail } from "~/server/auth/aws";
import { createDatabaseSession } from "~/server/auth/database-session";
import { editorRecipient } from "~/server/auth/editors";
import { linkPendingMemberships } from "~/server/auth/link-memberships";
import { authenticatePassword, hashPassword } from "~/server/auth/password";
import {
  issuePasswordResetToken,
  resetPasswordWithToken,
} from "~/server/auth/password-reset";
import { requireEditor } from "~/server/auth/require";
import {
  createSecondFactorChallenge,
  verifySecondFactorCode,
} from "~/server/auth/second-factor";
import { safeReturnTo } from "~/server/auth/return-to";
import { db } from "~/server/db";
import { auditEvents, users } from "~/server/db/schema";
import { eq } from "drizzle-orm";

function formLocale(formData: FormData): Locale {
  const value = formData.get("locale");
  return resolveLocale(typeof value === "string" ? value : undefined);
}

export async function requestMagicLink(formData: FormData) {
  const locale = formLocale(formData);
  const parsed = magicLinkRequestSchema.safeParse({
    email: formData.get("email"),
    locale: formData.get("locale"),
    returnTo: formData.get("returnTo"),
  });
  if (!parsed.success) {
    redirect(
      authPath("login", formLocale(formData), {
        returnTo: safeReturnTo(formData.get("returnTo"), locale),
        error: "invalid",
      }),
    );
  }

  const returnTo = safeReturnTo(parsed.data.returnTo, parsed.data.locale);
  (await cookies()).set(localeCookieName, parsed.data.locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });

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
      redirect(
        authPath("login", parsed.data.locale, {
          returnTo,
          error: "auth",
        }),
      );
    }
    throw error;
  }
}

/**
 * Password reset for the email/password method. A single-use token is emailed
 * as a dedicated reset link (never a magic link, so it grants no session and
 * is not gated by SMS): clicking it lands on /login/reset/<token> to set a new
 * password. Anti-enumeration matches the magic-link request — every address is
 * accepted here and the same confirmation is shown; only known editors are
 * issued a token and mailed, everyone else is dropped silently.
 */
export async function requestPasswordReset(formData: FormData) {
  const locale = formLocale(formData);
  const parsed = magicLinkRequestSchema.safeParse({
    email: formData.get("email"),
    locale: formData.get("locale"),
    returnTo: localizedPath("/dashboard/account", locale),
  });
  if (!parsed.success) {
    redirect(authPath("login", locale, { error: "invalid" }));
  }

  (await cookies()).set(localeCookieName, parsed.data.locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });

  // Only mail approved editors; the response is identical for every address.
  if (editorRecipient(parsed.data.email)) {
    const result = await issuePasswordResetToken(parsed.data.email);
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

export async function signInWithPassword(formData: FormData) {
  const locale = formLocale(formData);
  const parsed = passwordSignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    locale: formData.get("locale"),
    returnTo: formData.get("returnTo"),
  });
  const returnTo = safeReturnTo(formData.get("returnTo"), locale);
  if (!parsed.success) {
    redirect(authPath("login", locale, { returnTo, error: "password" }));
  }

  const user = await authenticatePassword(
    parsed.data.email,
    parsed.data.password,
  );
  if (!user || !editorRecipient(user.email)) {
    redirect(
      authPath("login", parsed.data.locale, {
        returnTo,
        error: "password",
      }),
    );
  }

  await createDatabaseSession(user.id);
  await linkPendingMemberships({ userId: user.id, email: user.email });
  await db.insert(auditEvents).values({
    actorUserId: user.id,
    action: "auth.password.signed_in",
    subjectType: "auth.session",
    subjectId: user.id,
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
    redirect(`${localizedPath("/dashboard/account", locale)}?error=password`);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, passwordUpdatedAt: new Date() })
      .where(eq(users.id, user.id));
    await tx.insert(auditEvents).values({
      actorUserId: user.id,
      action: "auth.password.updated",
      subjectType: "auth.user",
      subjectId: user.id,
    });
  });
  redirect(`${localizedPath("/dashboard/account", locale)}?status=updated`);
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
  redirect(
    authPath("verify", parsed.data.locale, {
      returnTo,
      status: result === "sent" ? "sent" : undefined,
      error:
        result === "sent"
          ? undefined
          : result === "unavailable"
            ? "send_error"
            : result,
    }),
  );
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
