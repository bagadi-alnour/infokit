"use server";

import {
  accountNotificationsSchema,
  accountPreferencesSchema,
  accountProfileSchema,
  accountSignInSchema,
  type NotificationChannel,
} from "@infokit/validation/account";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { localeCookieName } from "~/i18n/constants";
import { getActionLocale } from "~/i18n/request-locale";
import { localizedPath } from "~/i18n/routing";
import { recordAudit } from "~/server/audit";
import { isPlatformAdmin } from "~/server/auth/authorization";
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
    landingSection: formData.get("landingSection"),
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
    landingSection,
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
    landingSection,
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
 * Sign-in preferences and second-factor enrolment. Turning the second factor
 * off is a security decision, so it is refused for platform administrators
 * and always audited with the outcome that was actually stored — never with
 * what the form asked for (RISKS.md R10).
 */
export async function updateAccountSignIn(formData: FormData) {
  const locale = await getActionLocale(formData.get("locale"));
  const user = await requireEditor(locale);
  const parsed = accountSignInSchema.safeParse({
    preferredSignInMethod: formData.get("preferredSignInMethod"),
    twoFactorEnabled: formData.get("twoFactorEnabled"),
    twoFactorMethod: formData.get("twoFactorMethod"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) backTo("security", locale, { error: "invalid" });

  const { preferredSignInMethod, twoFactorMethod } = parsed.data;
  const locked = await isPlatformAdmin(user.id);
  if (locked && !parsed.data.twoFactorEnabled) {
    backTo("security", locale, { error: "twoFactorRequired" });
  }
  const twoFactorEnabled = locked ? true : parsed.data.twoFactorEnabled;

  await upsertSettings(user.id, {
    preferredSignInMethod,
    twoFactorEnabled,
    twoFactorMethod,
    twoFactorUpdatedAt: new Date(),
  });
  await recordAudit({
    action: twoFactorEnabled
      ? "account.two_factor.enabled"
      : "account.two_factor.disabled",
    subjectType: "auth.user_settings",
    subjectId: user.id,
    metadata: { method: twoFactorMethod, signIn: preferredSignInMethod },
  });
  backTo("security", locale, { status: "saved" });
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
