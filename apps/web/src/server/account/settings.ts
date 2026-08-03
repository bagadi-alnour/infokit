import type {
  NotificationChannel,
  NotificationKind,
} from "@infokit/validation/account";
import { and, eq, gt, isNull, or } from "drizzle-orm";

import { db } from "~/server/db";
import {
  memberRoles,
  notificationPreferences,
  organizationMembers,
  roles,
  userPlatformRoles,
  userSettings,
} from "~/server/db/schema";

/**
 * Account settings read model (docs/DATABASE-SCHEMA.md §4, §16).
 *
 * A missing row means every default, so nothing here writes on read: an
 * account that never opened the settings pages still resolves to a complete,
 * typed set of preferences.
 */

export type AccountSettings = {
  preferredLanguageCode: "fr" | "en" | "ar" | null;
  theme: "system" | "light" | "dark";
  density: "comfortable" | "compact";
  reducedMotion: boolean;
  highContrast: boolean;
  sidebarCollapsed: boolean;
  landingSection: "runbook" | "activities" | "articles" | "simulator";
  timeZone: string;
  clockFormat: "h12" | "h24";
  weekStartsOn: number;
  preferredSignInMethod: "magic_link" | "password" | "passkey";
  digest: "off" | "daily" | "weekly";
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  defaultOrganizationId: string | null;
  defaultCityId: string | null;
};

/**
 * The product's answer before anyone chooses: calm defaults and the console's
 * launch city timezone. Nothing here concerns the second factor — that is
 * Better Auth's, on `auth.users` and `auth.sessions`, not a preference.
 */
export const accountSettingsDefaults: AccountSettings = {
  preferredLanguageCode: null,
  theme: "system",
  density: "comfortable",
  reducedMotion: false,
  highContrast: false,
  sidebarCollapsed: false,
  landingSection: "runbook",
  timeZone: "Europe/Paris",
  clockFormat: "h24",
  weekStartsOn: 1,
  preferredSignInMethod: "magic_link",
  digest: "weekly",
  quietHoursStart: null,
  quietHoursEnd: null,
  defaultOrganizationId: null,
  defaultCityId: null,
};

/** `time` columns come back as `HH:MM:SS`; the form speaks `HH:MM`. */
function toInputTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

export async function getAccountSettings(
  userId: string,
): Promise<AccountSettings> {
  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  if (!row) return accountSettingsDefaults;

  return {
    ...accountSettingsDefaults,
    ...row,
    // The FK accepts any catalogue language; only the fully translated
    // interface locales can actually be honoured, so an older or widened
    // value falls back to "follow the request" instead of a broken UI.
    preferredLanguageCode:
      row.preferredLanguageCode === "fr" ||
      row.preferredLanguageCode === "en" ||
      row.preferredLanguageCode === "ar"
        ? row.preferredLanguageCode
        : null,
    quietHoursStart: toInputTime(row.quietHoursStart),
    quietHoursEnd: toInputTime(row.quietHoursEnd),
  };
}

/**
 * Whether any role this account holds makes the SMS step-up mandatory
 * (`core.roles.requires_second_factor`, seeded for the platform's own staff
 * and for an organisation's steward). The person cannot switch it off, and
 * cannot reach a private read before enrolling a number.
 *
 * Both assignment tables count: platform work is granted globally in
 * `core.user_platform_roles`, organisation work inside a membership.
 */
export async function secondFactorMandatory(userId: string): Promise<boolean> {
  const now = new Date();
  const [platform] = await db
    .select({ roleId: userPlatformRoles.roleId })
    .from(userPlatformRoles)
    .innerJoin(roles, eq(roles.id, userPlatformRoles.roleId))
    .where(
      and(
        eq(userPlatformRoles.userId, userId),
        eq(roles.requiresSecondFactor, true),
        or(
          isNull(userPlatformRoles.expiresAt),
          gt(userPlatformRoles.expiresAt, now),
        ),
      ),
    )
    .limit(1);
  if (platform) return true;

  const [organization] = await db
    .select({ roleId: memberRoles.roleId })
    .from(memberRoles)
    .innerJoin(roles, eq(roles.id, memberRoles.roleId))
    .innerJoin(
      organizationMembers,
      eq(organizationMembers.id, memberRoles.memberId),
    )
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(roles.requiresSecondFactor, true),
        or(isNull(memberRoles.expiresAt), gt(memberRoles.expiresAt, now)),
      ),
    )
    .limit(1);
  return Boolean(organization);
}

/*
 * There is deliberately no `secondFactorRequired` any more.
 *
 * It used to mean "must this session pass the SMS step-up", and combined a role
 * mandate with the person's own preference plus a proven phone number. Better
 * Auth removed the question: a session cannot exist unless the factor armed on
 * the account was already applied, so nobody is ever signed in and still owing a
 * code. The person's own choice is expressed by arming a factor, not by a column.
 *
 * What is left is `secondFactorMandatory` above — the only reason to *force* an
 * enrolment — and `auth.users.two_factor_enabled`, which is the fact.
 */

/** Per-kind channel matrix, and how the person may change it. */
export interface NotificationKindPolicy {
  kind: NotificationKind;
  /** Channels the platform can actually deliver this kind on today. */
  channels: readonly NotificationChannel[];
  /** Account-security messages are shown but never switched off. */
  alwaysOn?: boolean;
}

/**
 * Product defaults per kind (docs/DATABASE-SCHEMA.md §16). Delivery reads
 * these when no override row exists, so adding a kind ships without editing
 * anyone's settings. SMS stays off by default everywhere: it costs the
 * platform money and the reader's attention.
 */
export const notificationKindPolicies: readonly NotificationKindPolicy[] = [
  { kind: "activity_review_due", channels: ["email", "inApp"] },
  { kind: "activity_status_changed", channels: ["email", "inApp"] },
  { kind: "publication_state", channels: ["email", "inApp"] },
  { kind: "translation_assignment", channels: ["email", "inApp"] },
  { kind: "membership_invitation", channels: ["email", "inApp"] },
  { kind: "coordination_event", channels: ["email", "inApp"] },
  { kind: "security_alert", channels: ["email"], alwaysOn: true },
  { kind: "product_update", channels: ["email", "inApp"] },
];

export type NotificationSelection = Record<
  NotificationKind,
  Record<NotificationChannel, boolean>
>;

function defaultSelectionFor(
  policy: NotificationKindPolicy,
): Record<NotificationChannel, boolean> {
  return {
    email: policy.channels.includes("email"),
    sms: false,
    push: false,
    inApp: policy.channels.includes("inApp"),
  };
}

/**
 * The account-wide matrix: defaults overlaid with the rows this person saved.
 * Organisation-scoped overrides (`organizationId` not null) are read by the
 * delivery path, not by this page — the console edits the account default.
 */
export async function getNotificationSelection(
  userId: string,
): Promise<NotificationSelection> {
  const rows = await db
    .select({
      kind: notificationPreferences.kind,
      email: notificationPreferences.email,
      sms: notificationPreferences.sms,
      push: notificationPreferences.push,
      inApp: notificationPreferences.inApp,
    })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        isNull(notificationPreferences.organizationId),
      ),
    );
  const saved = new Map(rows.map((row) => [row.kind, row]));

  const selection = {} as NotificationSelection;
  for (const policy of notificationKindPolicies) {
    const row = saved.get(policy.kind);
    const resolved = row
      ? { email: row.email, sms: row.sms, push: row.push, inApp: row.inApp }
      : defaultSelectionFor(policy);
    selection[policy.kind] = policy.alwaysOn
      ? // An always-on kind is displayed as on whatever the row says, so the
        // page never promises a switch that delivery would ignore.
        { ...resolved, email: true }
      : resolved;
  }
  return selection;
}
