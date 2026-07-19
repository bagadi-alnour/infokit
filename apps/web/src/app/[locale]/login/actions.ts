"use server";

import {
  magicLinkRequestSchema,
  smsChallengeRequestSchema,
  smsVerificationSchema,
} from "@calais/validation/auth";
import { resolveLocale, type Locale } from "@calais/shared/i18n";
import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { localeCookieName } from "~/i18n/constants";
import { authPath } from "~/i18n/routing";
import { auth, signIn, signOut } from "~/server/auth";
import {
  createSecondFactorChallenge,
  verifySecondFactorCode,
} from "~/server/auth/second-factor";
import { safeReturnTo } from "~/server/auth/return-to";

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
