"use server";

import { secondFactorEnrolmentSchema } from "@infokit/validation/auth";
import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";

import { getActionLocale } from "~/i18n/request-locale";
import { authPath, localizedPath } from "~/i18n/routing";
import { secondFactorMandatory } from "~/server/account/settings";
import { recordAudit } from "~/server/audit";
import { auth, authServer } from "~/server/auth";
import { passwordStatus } from "~/server/auth/password-status";
import { requireAccountHolder } from "~/server/auth/require";
import { db } from "~/server/db";
import { sessions } from "~/server/db/schema";
import {
  enrolSecondFactorNumber,
  markSecondFactorNumberVerified,
} from "~/server/auth/second-factor";
import { revokeTrustedDevices } from "~/server/auth/trusted-device";

/**
 * Arming and disarming the second factor.
 *
 * Two things about Better Auth shape everything here, and both were learned the
 * hard way rather than read off the page:
 *
 * **1. `enableTwoFactor` is what creates the `auth.two_factor` row** — the
 * authenticator secret and the backup codes. Better Auth requires that row to
 * exist before it will check any code during a sign-in, *including an SMS code*,
 * even though SMS never uses the secret. While a session is already open it is
 * more forgiving, which is exactly the trap: an SMS-only enrolment that skipped
 * this step would appear to work perfectly and then refuse every code the next
 * morning. So every enrolment creates the row, whichever channel is then proven.
 *
 * **2. Changing the factor needs the account's password, when it has one.**
 * `allowPasswordless` only makes the field optional in the request schema;
 * `enableTwoFactor`, `disableTwoFactor`, `getTOTPURI` and `generateBackupCodes`
 * still refuse without it if a credential exists. That is right — a borrowed
 * laptop is a session — so the forms ask for it, and only when there is one to
 * ask for. The *verify* endpoints are deliberately not in that list: a code is
 * itself the proof.
 *
 * Point 2 is also why the secret is returned to the caller rather than re-read.
 * Rendering the QR code on a later page load would mean calling `getTOTPURI` on a
 * GET, where no password has been supplied — so `enableTwoFactor`'s own response
 * is carried through this action's state instead. It never enters a URL.
 */

const securityPath = (locale: string) =>
  localizedPath("/dashboard/account/security", locale as "fr" | "en" | "ar");

/**
 * Where an enrolment came from, and therefore where it goes back to.
 *
 * These forms are submitted from two places. Usually it is the account settings
 * page, inside the console. But an account whose *role* mandates a factor is
 * sent to enrol before it may read anything, and that page cannot live inside
 * the console: every dashboard layout runs `requireEditor`, so a gate whose
 * escape hatch sat behind it would redirect to itself forever. The escape hatch
 * is `/login/verify`, outside the tree — and a form submitted from there has to
 * land there too, or the person bounces off the gate mid-enrolment and loses the
 * code they were just sent.
 */
function forwardedReturnTo(formData: FormData): string | undefined {
  const value = formData.get("returnTo");
  return typeof value === "string" && value ? value : undefined;
}

function originPath(locale: string, formData: FormData): string {
  return formData.get("origin") === "verify"
    ? localizedPath("/login/verify", locale as "fr" | "en" | "ar")
    : securityPath(locale);
}

/** Same landing for success and failure: the page owns the wording. */
function backTo(
  path: string,
  outcome: { status?: string; error?: string; returnTo?: string },
): never {
  const query = new URLSearchParams();
  if (outcome.status) query.set("status", outcome.status);
  if (outcome.error) query.set("error", outcome.error);
  if (outcome.returnTo) query.set("returnTo", outcome.returnTo);
  revalidatePath(path);
  redirect(query.size ? `${path}?${query.toString()}` : path);
}

/**
 * What the enrolment card is showing.
 *
 * `totpUri`, `qrSvg` and `backupCodes` are the one-time secrets. They live in
 * this state, which means they reach the browser exactly once — as part of the
 * response that minted them — and are gone on the next navigation. A failed code
 * carries them forward so a typo does not throw the enrolment away and mint a
 * second secret.
 */
export interface TwoFactorState {
  step?: "setup" | "codes";
  error?: "password" | "setup" | "invalidCode" | "unavailable";
  totpUri?: string;
  qrSvg?: string;
  backupCodes?: string[];
}

/** The password the gated endpoints want, or undefined when there is none. */
function suppliedPassword(formData: FormData): string | undefined {
  const value = formData.get("currentPassword");
  const password = typeof value === "string" ? value.trim() : "";
  return password || undefined;
}

async function renderQr(totpUri: string): Promise<string | undefined> {
  try {
    // Drawn on the server: a secret has no reason to pass through a client
    // component in order to become a picture.
    return await QRCode.toString(totpUri, {
      type: "svg",
      margin: 1,
      width: 200,
    });
  } catch {
    // The typed key below is a complete fallback, so a failed render is not a
    // failed enrolment.
    return undefined;
  }
}

/**
 * The enrolment card's one action. It is a single action rather than four
 * because the steps share the secrets in `TwoFactorState`: a wrong code has to
 * come back to a page that still shows the QR it was typed from.
 */
export async function manageTwoFactor(
  previous: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  const locale = await getActionLocale(formData.get("locale"));
  const user = await requireAccountHolder(locale);
  const intent = formData.get("intent");
  const password = suppliedPassword(formData);
  const status = await passwordStatus(user.id);
  const requestHeaders = await headers();

  // Refused here as well as by Better Auth, so the message names the field
  // instead of reading as a generic failure.
  if (status.set && !password && intent !== "confirm") {
    return { ...previous, error: "password" };
  }

  if (intent === "start") {
    try {
      const enabled = await authServer.api.enableTwoFactor({
        body: { issuer: "InfoKit", ...(password ? { password } : {}) },
        headers: requestHeaders,
      });
      await recordAudit({
        action: "account.two_factor.setup_started",
        subjectType: "auth.two_factor",
        subjectId: user.id,
      });
      return {
        step: "setup",
        totpUri: enabled.totpURI,
        qrSvg: await renderQr(enabled.totpURI),
        backupCodes: enabled.backupCodes,
      };
    } catch (error) {
      if (!(error instanceof APIError)) throw error;
      return {
        error: error.body?.code === "INVALID_PASSWORD" ? "password" : "setup",
      };
    }
  }

  if (intent === "confirm") {
    const code = formData.get("code");
    const value = typeof code === "string" ? code.trim() : "";
    if (!/^\d{6}$/.test(value)) {
      return { ...previous, error: "invalidCode" };
    }
    try {
      await authServer.api.verifyTOTP({
        body: { code: value },
        headers: requestHeaders,
      });
    } catch (error) {
      if (!(error instanceof APIError)) throw error;
      await recordAudit({
        action: "account.two_factor.setup_failed",
        subjectType: "auth.two_factor",
        subjectId: user.id,
        outcome: "denied",
        severity: "warning",
        errorCode: "invalid_code",
      });
      // The secrets are carried forward: the person is still looking at the QR
      // they typed from, and a new secret would invalidate the app they just set up.
      return { ...previous, error: "invalidCode" };
    }
    await recordAudit({
      action: "account.two_factor.enabled",
      subjectType: "auth.two_factor",
      subjectId: user.id,
      metadata: { method: "totp" },
    });
    backTo(originPath(locale, formData), {
      status: "twoFactorEnabled",
      returnTo: forwardedReturnTo(formData),
    });
  }

  if (intent === "regenerate") {
    try {
      const generated = await authServer.api.generateBackupCodes({
        body: password ? { password } : {},
        headers: requestHeaders,
      });
      await recordAudit({
        action: "account.two_factor.backup_codes_regenerated",
        subjectType: "auth.two_factor",
        subjectId: user.id,
        severity: "warning",
      });
      return { step: "codes", backupCodes: generated.backupCodes };
    } catch (error) {
      if (!(error instanceof APIError)) throw error;
      return {
        error:
          error.body?.code === "INVALID_PASSWORD" ? "password" : "unavailable",
      };
    }
  }

  if (intent === "off") {
    // Refused outright to anyone holding a role that mandates it — the reach of
    // the role decides, not the person's preference (RISKS.md R10).
    if (await secondFactorMandatory(user.id)) {
      await recordAudit({
        action: "account.two_factor.disable_refused",
        subjectType: "auth.two_factor",
        subjectId: user.id,
        outcome: "denied",
        severity: "warning",
        errorCode: "role_mandates_second_factor",
      });
      backTo(originPath(locale, formData), {
        error: "twoFactorRequired",
        returnTo: forwardedReturnTo(formData),
      });
    }
    try {
      await authServer.api.disableTwoFactor({
        body: password ? { password } : {},
        headers: requestHeaders,
      });
    } catch (error) {
      if (!(error instanceof APIError)) throw error;
      return {
        error:
          error.body?.code === "INVALID_PASSWORD" ? "password" : "unavailable",
      };
    }
    await recordAudit({
      action: "account.two_factor.disabled",
      subjectType: "auth.two_factor",
      subjectId: user.id,
      severity: "warning",
    });
    // Trusted devices are not forgotten here: `secondFactorSessionStamp()`
    // hooks Better Auth's disable endpoint and does it for every caller,
    // including the phone app, which never passes through this action.
    backTo(originPath(locale, formData), {
      status: "twoFactorDisabled",
      returnTo: forwardedReturnTo(formData),
    });
  }

  return { ...previous, error: "unavailable" };
}

/**
 * Record the number, then send a code to it. Nothing is proven here: the number
 * stays unverified until a code comes back, so a typo is fixed by enrolling
 * again rather than by asking anyone for help.
 */
export async function enrolSecondFactorPhone(formData: FormData) {
  const locale = await getActionLocale(formData.get("locale"));
  const user = await requireAccountHolder(locale);
  const parsed = secondFactorEnrolmentSchema.safeParse({
    phone: formData.get("phone"),
    locale: formData.get("locale"),
    returnTo: securityPath(locale),
  });
  if (!parsed.success)
    backTo(originPath(locale, formData), {
      error: "phone",
      returnTo: forwardedReturnTo(formData),
    });

  await enrolSecondFactorNumber({ userId: user.id, phone: parsed.data.phone });

  /**
   * The row Better Auth needs before it will check any code at a sign-in — see
   * this module's note. Skipped when the account already holds a factor, and it
   * needs the password for the same reason `manageTwoFactor` does.
   */
  if (!user.twoFactorEnabled) {
    const password = suppliedPassword(formData);
    const status = await passwordStatus(user.id);
    if (status.set && !password)
      backTo(originPath(locale, formData), {
        error: "password",
        returnTo: forwardedReturnTo(formData),
      });
    try {
      await authServer.api.enableTwoFactor({
        body: { issuer: "InfoKit", ...(password ? { password } : {}) },
        headers: await headers(),
      });
    } catch (error) {
      if (!(error instanceof APIError)) throw error;
      backTo(originPath(locale, formData), {
        error: error.body?.code === "INVALID_PASSWORD" ? "password" : "invalid",
        returnTo: forwardedReturnTo(formData),
      });
    }
  }

  let error: string | null = null;
  try {
    await authServer.api.sendTwoFactorOTP({
      body: {},
      headers: await headers(),
    });
  } catch (cause) {
    if (!(cause instanceof APIError)) throw cause;
    error = cause.status === "TOO_MANY_REQUESTS" ? "rateLimited" : "sendError";
  }
  if (error)
    backTo(originPath(locale, formData), {
      error,
      returnTo: forwardedReturnTo(formData),
    });
  backTo(originPath(locale, formData), {
    status: "codeSent",
    returnTo: forwardedReturnTo(formData),
  });
}

/** Send another code to the number already on file. */
export async function resendPhoneCode(formData: FormData) {
  const locale = await getActionLocale(formData.get("locale"));
  await requireAccountHolder(locale);

  let error: string | null = null;
  try {
    await authServer.api.sendTwoFactorOTP({
      body: {},
      headers: await headers(),
    });
  } catch (cause) {
    if (!(cause instanceof APIError)) throw cause;
    error =
      cause.body?.code === "NO_PHONE_ENROLLED"
        ? "phone"
        : cause.status === "TOO_MANY_REQUESTS"
          ? "rateLimited"
          : "sendError";
  }
  if (error)
    backTo(originPath(locale, formData), {
      error,
      returnTo: forwardedReturnTo(formData),
    });
  backTo(originPath(locale, formData), {
    status: "codeSent",
    returnTo: forwardedReturnTo(formData),
  });
}

/**
 * Confirm the SMS code, which proves the line and — if this is the first factor
 * on the account — arms it. Better Auth rotates the session on the way through.
 * No password: the code is the proof.
 */
export async function confirmSecondFactorPhone(formData: FormData) {
  const locale = await getActionLocale(formData.get("locale"));
  const user = await requireAccountHolder(locale);
  const code = formData.get("code");
  const value = typeof code === "string" ? code.trim() : "";
  if (!/^\d{6}$/.test(value))
    backTo(originPath(locale, formData), {
      error: "invalidCode",
      returnTo: forwardedReturnTo(formData),
    });

  let failed = false;
  try {
    await authServer.api.verifyTwoFactorOTP({
      body: { code: value },
      headers: await headers(),
    });
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    failed = true;
  }
  if (failed) {
    await recordAudit({
      action: "account.second_factor.number_verification_failed",
      subjectType: "auth.user_second_factors",
      subjectId: user.id,
      outcome: "denied",
      severity: "warning",
      errorCode: "invalid_code",
    });
    backTo(originPath(locale, formData), {
      error: "invalidCode",
      returnTo: forwardedReturnTo(formData),
    });
  }
  // The code proves the code; only this side knows it travelled by SMS, so this
  // is where acceptance becomes proof of the line.
  await markSecondFactorNumberVerified(user.id);
  backTo(originPath(locale, formData), {
    status: "phoneVerified",
    returnTo: forwardedReturnTo(formData),
  });
}

/**
 * Stop trusting a device — one of them, or all of them.
 *
 * One action for both, told apart by whether the form names a device, because the
 * outcome is the same in every way that matters: the next sign-in on the affected
 * device asks for a code again. Nothing here ends a *session* — a trusted device
 * and a signed-in device are different things, and somebody revoking trust on the
 * laptop they are holding should not be thrown out of the page they did it from.
 *
 * `revokeTrustedDevices` scopes the delete to this account, so a device id from a
 * tampered form matches nothing rather than reaching somebody else's row.
 */
export async function revokeTrustedDevice(formData: FormData) {
  const locale = await getActionLocale(formData.get("locale"));
  const user = await requireAccountHolder(locale);
  const id = formData.get("deviceId");
  const revoked = await revokeTrustedDevices({
    userId: user.id,
    deviceId: typeof id === "string" && id ? id : undefined,
    cookieHeader: (await headers()).get("cookie"),
  });
  backTo(originPath(locale, formData), {
    status: revoked > 0 ? "devicesForgotten" : undefined,
  });
}

/**
 * End one named session.
 *
 * The row is looked up by id *and* by the signed-in account, which is the whole
 * of this action's authorisation: a session id from a tampered form matches
 * nothing rather than reaching somebody else's laptop. The lookup also exists
 * because Better Auth revokes by **token**, and `listDeviceSessions` refuses to
 * select tokens — a session token rendered into a page is a session anybody
 * reading over a shoulder can use. So the id is what travels, and the token is
 * resolved here and never leaves the server.
 *
 * Ending the session making the request is allowed, and lands on the login page:
 * it is a reasonable thing to want from a shared machine, and the alternative —
 * silently doing nothing on the one row somebody can definitely identify — would
 * read as a broken button.
 */
export async function signOutDevice(formData: FormData) {
  const locale = await getActionLocale(formData.get("locale"));
  const user = await requireAccountHolder(locale);
  const id = formData.get("sessionId");
  if (typeof id !== "string" || !id) {
    backTo(originPath(locale, formData), { error: "invalid" });
  }

  const [target] = await db
    .select({ token: sessions.token })
    .from(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.userId, user.id)))
    .limit(1);
  // Already gone, or never this account's. Same answer either way: the device is
  // not signed in, which is what the person asked for.
  if (!target)
    backTo(originPath(locale, formData), { status: "deviceSignedOut" });

  const current = await auth();
  const endingThisOne = current?.session.token === target.token;

  // Recorded before the revoke: ending the current session leaves nobody to name
  // as the actor afterwards.
  await recordAudit({
    action: "auth.session.revoked_one",
    subjectType: "auth.session",
    subjectId: user.id,
    actorUserId: user.id,
    severity: "warning",
    metadata: { current: endingThisOne },
  });
  try {
    await authServer.api.revokeSession({
      body: { token: target.token },
      headers: await headers(),
    });
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    backTo(originPath(locale, formData), { error: "unavailable" });
  }

  if (endingThisOne) redirect(authPath("login", locale));
  backTo(originPath(locale, formData), { status: "deviceSignedOut" });
}

/**
 * End every other session, keeping this one.
 *
 * The common case by far: a lost laptop, a borrowed machine, a shared browser.
 * Keeping the current session means the person is not signed out of the page they
 * are standing on, which is what makes this safe to press.
 */
export async function signOutOtherDevices(formData: FormData) {
  const locale = await getActionLocale(formData.get("locale"));
  const user = await requireAccountHolder(locale);
  try {
    await authServer.api.revokeOtherSessions({ headers: await headers() });
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    backTo(originPath(locale, formData), { error: "unavailable" });
  }
  await recordAudit({
    action: "auth.sessions.revoked_others",
    subjectType: "auth.session",
    subjectId: user.id,
    actorUserId: user.id,
    severity: "warning",
  });
  backTo(originPath(locale, formData), { status: "othersSignedOut" });
}

/**
 * End every session including this one, and land on the login page.
 *
 * Separate from the button above because the outcome is different in a way worth
 * a separate decision: this one signs the person out of the device they are
 * holding. It is the honest answer to "I think somebody has my password".
 */
export async function signOutEverywhere(formData: FormData) {
  const locale = await getActionLocale(formData.get("locale"));
  const user = await requireAccountHolder(locale);
  // Recorded first: after the revoke there is no session left to name as actor.
  await recordAudit({
    action: "auth.sessions.revoked_all",
    subjectType: "auth.session",
    subjectId: user.id,
    actorUserId: user.id,
    severity: "warning",
  });
  try {
    await authServer.api.revokeSessions({ headers: await headers() });
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
  }
  redirect(authPath("login", locale));
}
