"use server";

import {
  accountNotificationsSchema,
  accountPreferencesSchema,
  accountProfileSchema,
  accountSignInSchema,
  type NotificationChannel,
} from "@infokit/validation/account";
import { passwordUpdateSchema } from "@infokit/validation/auth";
import { APIError } from "better-auth/api";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { localeCookieName } from "~/i18n/constants";
import { getActionLocale } from "~/i18n/request-locale";
import { localizedPath } from "~/i18n/routing";
import { recordAudit } from "~/server/audit";
import { authServer } from "~/server/auth";
import { passwordStatus } from "~/server/auth/password-status";
import { requireEditor } from "~/server/auth/require";
import { notificationKindPolicies } from "~/server/account/settings";
import { db } from "~/server/db";
import {
  notificationPreferences,
  userSettings,
  users,
} from "~/server/db/schema";

/**
 * Account settings mutations (docs/DATABASE-SCHEMA.md §4, §16).
 *
 * Every action re-reads the session: settings belong to the signed-in
 * account, so no form field ever names whose settings are written. Each one
 * upserts a single row, audits the change, and comes back to the page it was
 * submitted from with a status the page can explain in words.
 */

type AccountSection =
  "" | "preferences" | "security" | "notifications" | "password";

function sectionPath(section: AccountSection, locale: string) {
  return localizedPath(
    section ? `/dashboard/account/${section}` : "/dashboard/account",
    locale as "fr" | "en" | "ar",
  );
}

/** Same landing for success and failure: the page owns the wording. */
function backTo(
  section: AccountSection,
  locale: string,
  outcome: { status?: string; error?: string },
): never {
  const query = new URLSearchParams();
  if (outcome.status) query.set("status", outcome.status);
  if (outcome.error) query.set("error", outcome.error);
  const path = sectionPath(section, locale);
  revalidatePath(path);
  redirect(query.size ? `${path}?${query.toString()}` : path);
}

/**
 * One row per account, created on first write. `onConflictDoUpdate` keeps the
 * settings pages independent: a person can save notifications before ever
 * opening preferences without either page seeding the other's columns.
 */
async function upsertSettings(
  userId: string,
  values: Partial<typeof userSettings.$inferInsert>,
) {
  await db
    .insert(userSettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: userSettings.userId, set: values });
}

export async function updateAccountProfile(formData: FormData) {
  const locale = await getActionLocale(formData.get("locale"));
  const user = await requireEditor(locale);
  const parsed = accountProfileSchema.safeParse({
    displayName: formData.get("displayName"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) backTo("", locale, { error: "invalid" });

  await db
    .update(users)
    .set({ name: parsed.data.displayName })
    .where(eq(users.id, user.id));
  await recordAudit({
    action: "account.profile.updated",
    subjectType: "auth.user",
    subjectId: user.id,
  });
  backTo("", locale, { status: "saved" });
}

export async function updateAccountPreferences(formData: FormData) {
  const locale = await getActionLocale(formData.get("locale"));
  const user = await requireEditor(locale);
  const parsed = accountPreferencesSchema.safeParse({
    preferredLanguageCode: formData.get("preferredLanguageCode") ?? "",
    theme: formData.get("theme"),
    density: formData.get("density"),
    timeZone: formData.get("timeZone"),
    clockFormat: formData.get("clockFormat"),
    weekStartsOn: formData.get("weekStartsOn"),
    reducedMotion: formData.get("reducedMotion"),
    highContrast: formData.get("highContrast"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) backTo("preferences", locale, { error: "invalid" });

  const {
    preferredLanguageCode,
    theme,
    density,
    timeZone,
    clockFormat,
    weekStartsOn,
    reducedMotion,
    highContrast,
  } = parsed.data;
  await upsertSettings(user.id, {
    preferredLanguageCode,
    theme,
    density,
    timeZone,
    clockFormat,
    weekStartsOn,
    reducedMotion,
    highContrast,
  });
  await recordAudit({
    action: "account.preferences.updated",
    subjectType: "auth.user_settings",
    subjectId: user.id,
    metadata: { theme, density, language: preferredLanguageCode ?? "request" },
  });

  // A chosen interface language is the language this person reads the console
  // in from now on, on this device and the next one: the cookie carries it
  // between visits, the redirect applies it immediately.
  const nextLocale = preferredLanguageCode ?? locale;
  if (preferredLanguageCode) {
    (await cookies()).set(localeCookieName, preferredLanguageCode, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
  }
  revalidatePath(sectionPath("preferences", locale));
  backTo("preferences", nextLocale, { status: "saved" });
}

/**
 * Which way in this person prefers — and only that.
 *
 * Arming or disarming the second factor used to be a checkbox on this form.
 * It is not a preference any more: Better Auth writes
 * `auth.users.two_factor_enabled` when an enrolment is actually proven, so a
 * column here saying "on" while no secret existed would have been a promise the
 * sign-in could not keep. The enrolment forms live in `./two-factor-actions.ts`,
 * and the role mandate is enforced there, on the action that would turn it off.
 */
export async function updateAccountSignIn(formData: FormData) {
  const locale = await getActionLocale(formData.get("locale"));
  const user = await requireEditor(locale);
  const parsed = accountSignInSchema.safeParse({
    preferredSignInMethod: formData.get("preferredSignInMethod"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) backTo("security", locale, { error: "invalid" });

  const { preferredSignInMethod } = parsed.data;
  await upsertSettings(user.id, { preferredSignInMethod });
  await recordAudit({
    action: "account.sign_in_method.updated",
    subjectType: "auth.user_settings",
    subjectId: user.id,
    metadata: { signIn: preferredSignInMethod },
  });
  backTo("security", locale, { status: "saved" });
}

/**
 * Set or replace the account's password.
 *
 * Two Better Auth calls, because they are two different acts. Most accounts here
 * sign in with an emailed link and hold no password at all, so a first one is
 * `setPassword` and needs nothing but the new value. Replacing an existing one
 * is `changePassword`, which demands the current password — a session alone is
 * not enough to re-key an account, since a borrowed laptop is a session.
 *
 * Other sessions are revoked on the way through: whoever changes a password is
 * usually doing it because they think somebody else has the old one.
 */
export async function updatePassword(formData: FormData) {
  const locale = await getActionLocale(formData.get("locale"));
  const user = await requireEditor(locale);
  const parsed = passwordUpdateSchema.safeParse({
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) backTo("password", locale, { error: "password" });

  const status = await passwordStatus(user.id);
  const supplied = formData.get("currentPassword");
  const currentPassword = typeof supplied === "string" ? supplied : "";
  if (status.set && !currentPassword) {
    backTo("password", locale, { error: "currentPassword" });
  }

  // `backTo` redirects, and a redirect throws — so the outcome is decided here
  // and acted on below, outside the `catch` that would otherwise swallow it.
  let error: string | null = null;
  try {
    if (status.set) {
      await authServer.api.changePassword({
        body: {
          currentPassword,
          newPassword: parsed.data.password,
          revokeOtherSessions: true,
        },
        headers: await headers(),
      });
    } else {
      await authServer.api.setPassword({
        body: { newPassword: parsed.data.password },
        headers: await headers(),
      });
    }
  } catch (cause) {
    if (!(cause instanceof APIError)) throw cause;
    // The one refusal worth naming: the current password did not match.
    error = status.set ? "currentPassword" : "password";
  }
  if (error) {
    await recordAudit({
      action: "auth.password.update_failed",
      subjectType: "auth.user",
      subjectId: user.id,
      outcome: "denied",
      severity: "warning",
      errorCode:
        error === "currentPassword" ? "invalid_credentials" : "invalid",
    });
    backTo("password", locale, { error });
  }

  await recordAudit({
    action: "auth.password.updated",
    subjectType: "auth.user",
    subjectId: user.id,
    metadata: { first: !status.set },
  });
  backTo("password", locale, { status: "updated" });
}

export async function updateAccountNotifications(formData: FormData) {
  const locale = await getActionLocale(formData.get("locale"));
  const user = await requireEditor(locale);
  const parsed = accountNotificationsSchema.safeParse({
    digest: formData.get("digest"),
    quietHoursStart: formData.get("quietHoursStart") ?? "",
    quietHoursEnd: formData.get("quietHoursEnd") ?? "",
    channels: formData.getAll("channels").map(String),
    locale: formData.get("locale"),
  });
  if (!parsed.success) backTo("notifications", locale, { error: "invalid" });

  const ticked = new Set(parsed.data.channels);
  const rows = notificationKindPolicies.map((policy) => {
    // A channel is on when the platform can deliver this kind there and
    // either the box was ticked or the kind is never switched off. Channels
    // outside the policy stay false, so a stored row never promises a
    // delivery the page showed as unavailable.
    const enabled = (channel: NotificationChannel) =>
      policy.channels.includes(channel) &&
      (policy.alwaysOn === true || ticked.has(`${policy.kind}:${channel}`));
    return {
      userId: user.id,
      kind: policy.kind,
      email: enabled("email"),
      sms: enabled("sms"),
      push: enabled("push"),
      inApp: enabled("inApp"),
    };
  });

  await db.transaction(async (tx) => {
    // The page edits the account-wide default as one whole: replacing the
    // set is what "save" means here. Organisation-scoped overrides are keyed
    // separately and are left untouched.
    await tx
      .delete(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, user.id),
          isNull(notificationPreferences.organizationId),
        ),
      );
    await tx.insert(notificationPreferences).values(rows);
    await tx
      .insert(userSettings)
      .values({
        userId: user.id,
        digest: parsed.data.digest,
        quietHoursStart: parsed.data.quietHoursStart || null,
        quietHoursEnd: parsed.data.quietHoursEnd || null,
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          digest: parsed.data.digest,
          quietHoursStart: parsed.data.quietHoursStart || null,
          quietHoursEnd: parsed.data.quietHoursEnd || null,
        },
      });
  });
  await recordAudit({
    action: "account.notifications.updated",
    subjectType: "auth.user_settings",
    subjectId: user.id,
    metadata: { digest: parsed.data.digest, channels: ticked.size },
  });
  backTo("notifications", locale, { status: "saved" });
}
