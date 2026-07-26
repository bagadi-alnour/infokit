import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { cities, languages } from "./catalog";
import { organizations } from "./organizations";
import {
  authSchema,
  clockFormat,
  consoleLandingSection,
  digestFrequency,
  notificationKind,
  notifications,
  secondFactorMethod,
  signInMethod,
  themePreference,
  timestamps,
  workspaceDensity,
} from "./schemas";

/**
 * One row per account: everything a person chose about their own console
 * (docs/DATABASE-SCHEMA.md §4). It sits beside `auth.users` rather than in
 * it because preferences change often and carry no authentication meaning —
 * a settings write must never touch a credential column.
 *
 * Two rules hold for every column added here:
 *  - A missing row means "all defaults". Reads never depend on a write
 *    having happened, so a new account needs no backfill.
 *  - Nothing in this table is a security control on its own. Organisation
 *    policy and RBAC decide what a person may do; this decides what they
 *    are shown and how they are told.
 *
 * Deliberately absent: phone numbers and any second-factor secret. The SMS
 * recipient stays deployment configuration (docs/DATABASE-SCHEMA.md §4), so
 * this table can never become a phone-number list.
 */
export const userSettings = authSchema.table(
  "user_settings",
  {
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),

    /* -------- Interface -------- */
    /**
     * Interface language. Null follows the request (URL, then cookie, then
     * `Accept-Language`) — the reader has not chosen yet, so nothing is
     * imposed. Only languages the interface is actually translated into are
     * offered; the catalogue FK keeps the value honest.
     */
    preferredLanguageCode: varchar("preferred_language_code", {
      length: 35,
    }).references(() => languages.code),
    theme: themePreference("theme").notNull().default("system"),
    density: workspaceDensity("density").notNull().default("comfortable"),
    /** Respected in addition to `prefers-reduced-motion`, never instead of it. */
    reducedMotion: boolean("reduced_motion").notNull().default(false),
    highContrast: boolean("high_contrast").notNull().default(false),
    /** The console remembers how the person left the sidebar. */
    sidebarCollapsed: boolean("sidebar_collapsed").notNull().default(false),
    landingSection: consoleLandingSection("landing_section")
      .notNull()
      .default("runbook"),

    /* -------- Time -------- */
    /** IANA zone; every stored instant stays UTC (docs/DATABASE-SCHEMA.md §2). */
    timeZone: varchar("time_zone", { length: 64 })
      .notNull()
      .default("Europe/Paris"),
    clockFormat: clockFormat("clock_format").notNull().default("h24"),
    /** ISO weekday, 1 = Monday, for the schedule and calendar grids. */
    weekStartsOn: integer("week_starts_on").notNull().default(1),

    /* -------- Sign-in and second factor -------- */
    /** Which method the login page offers first for this account. */
    preferredSignInMethod: signInMethod("preferred_sign_in_method")
      .notNull()
      .default("magic_link"),
    /**
     * Whether this account is asked for a second factor. On by default, and
     * accounts holding platform administration cannot turn it off — the
     * server re-checks that on every write and on every gated read
     * (`secondFactorRequired`), so flipping this column is not a bypass.
     */
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(true),
    twoFactorMethod: secondFactorMethod("two_factor_method")
      .notNull()
      .default("sms"),
    /** When the enrolment last changed; the reason lives in `audit.events`. */
    twoFactorUpdatedAt: timestamp("two_factor_updated_at", {
      withTimezone: true,
    }),

    /* -------- Notifications -------- */
    /** Per-kind channels live in `notifications.preferences`. */
    digest: digestFrequency("digest").notNull().default("weekly"),
    /**
     * No non-urgent delivery inside this window, in `timeZone`. Both null
     * means "any time"; start after end means the window crosses midnight.
     */
    quietHoursStart: time("quiet_hours_start"),
    quietHoursEnd: time("quiet_hours_end"),

    /* -------- Workspace defaults -------- */
    /** Which organisation and city the console opens scoped to. */
    defaultOrganizationId: uuid("default_organization_id").references(
      () => organizations.id,
      { onDelete: "set null" },
    ),
    defaultCityId: uuid("default_city_id").references(() => cities.id, {
      onDelete: "set null",
    }),

    ...timestamps,
  },
  (t) => [
    check(
      "user_settings_week_start_ck",
      sql`${t.weekStartsOn} between 1 and 7`,
    ),
    check(
      "user_settings_quiet_hours_ck",
      sql`(${t.quietHoursStart} is null) = (${t.quietHoursEnd} is null)`,
    ),
  ],
);

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, { fields: [userSettings.userId], references: [users.id] }),
  preferredLanguage: one(languages, {
    fields: [userSettings.preferredLanguageCode],
    references: [languages.code],
  }),
  defaultOrganization: one(organizations, {
    fields: [userSettings.defaultOrganizationId],
    references: [organizations.id],
  }),
  defaultCity: one(cities, {
    fields: [userSettings.defaultCityId],
    references: [cities.id],
  }),
}));

/**
 * Per-user, per-kind, per-channel consent (docs/DATABASE-SCHEMA.md §16).
 * A row is an override: with no row, the kind's product default applies, so
 * a new notification kind ships without touching anyone's settings.
 *
 * `organizationId` scopes the override to one association — the same person
 * can want review reminders from the association they publish for and
 * nothing from another. Null is the account-wide default for that kind.
 *
 * `security_alert` is stored like any other kind so a person can see it, but
 * delivery ignores the row: an account-security message is always sent.
 */
export const notificationPreferences = notifications.table(
  "preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    kind: notificationKind("kind").notNull(),
    email: boolean("email").notNull().default(true),
    sms: boolean("sms").notNull().default(false),
    push: boolean("push").notNull().default(false),
    inApp: boolean("in_app").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    // Two partial indexes rather than one: a null organisation is a distinct
    // row for uniqueness purposes in PostgreSQL, so the account-wide default
    // needs its own guard against duplicates.
    uniqueIndex("notification_preferences_account_kind_uq")
      .on(t.userId, t.kind)
      .where(sql`${t.organizationId} is null`),
    uniqueIndex("notification_preferences_org_kind_uq")
      .on(t.userId, t.organizationId, t.kind)
      .where(sql`${t.organizationId} is not null`),
    index("notification_preferences_user_idx").on(t.userId),
  ],
);

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [notificationPreferences.organizationId],
      references: [organizations.id],
    }),
  }),
);
