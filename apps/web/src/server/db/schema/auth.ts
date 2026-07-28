import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { authSchema } from "./schemas";

/** Mirrors AdapterAccount["type"] from @auth/core — inlined so the schema
 *  stays importable by drizzle-kit without resolving next-auth's exports. */
type AdapterAccountType = "email" | "oauth" | "oidc" | "webauthn";

/**
 * NextAuth (Auth.js) tables, moved into the `auth` PostgreSQL schema.
 * Column shapes match the DrizzleAdapter contract — do not repurpose these
 * for organisation membership; that lives in `core` (docs/DATABASE-SCHEMA.md §4).
 */
export const users = authSchema.table(
  "users",
  {
    id: varchar("id", { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar("name", { length: 255 }),
    /** One canonical sign-in address per global identity. */
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: timestamp("email_verified", {
      mode: "date",
      withTimezone: true,
    }),
    /** Versioned scrypt record; never a plaintext or reversible password. */
    passwordHash: text("password_hash"),
    passwordUpdatedAt: timestamp("password_updated_at", {
      mode: "date",
      withTimezone: true,
    }),
    image: varchar("image", { length: 255 }),
  },
  (t) => [
    uniqueIndex("users_normalized_email_uq").on(sql`lower(btrim(${t.email}))`),
    check(
      "users_email_normalized_ck",
      sql`${t.email} = lower(btrim(${t.email}))`,
    ),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  secondFactorChallenges: many(secondFactorChallenges),
}));

export const accounts = authSchema.table(
  "accounts",
  {
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 255 })
      .$type<AdapterAccountType>()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("accounts_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = authSchema.table(
  "sessions",
  {
    sessionToken: varchar("session_token", { length: 255 })
      .notNull()
      .primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    secondFactorVerifiedAt: timestamp("second_factor_verified_at", {
      mode: "date",
      withTimezone: true,
    }),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

/**
 * Short-lived, single-use SMS challenges for the editor step-up check.
 * Codes are HMACed before storage; phone numbers remain in server env only.
 */
export const secondFactorChallenges = authSchema.table(
  "second_factor_challenges",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionToken: varchar("session_token", { length: 255 })
      .notNull()
      .references(() => sessions.sessionToken, { onDelete: "cascade" }),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    locale: varchar("locale", { length: 5 }).notNull(),
    deliveryState: varchar("delivery_state", { length: 16 })
      .$type<"pending" | "sent" | "failed">()
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("second_factor_challenges_user_created_idx").on(
      t.userId,
      t.createdAt,
    ),
    index("second_factor_challenges_session_idx").on(t.sessionToken),
  ],
);

export const secondFactorChallengesRelations = relations(
  secondFactorChallenges,
  ({ one }) => ({
    user: one(users, {
      fields: [secondFactorChallenges.userId],
      references: [users.id],
    }),
    session: one(sessions, {
      fields: [secondFactorChallenges.sessionToken],
      references: [sessions.sessionToken],
    }),
  }),
);

/**
 * One-time codes that hand a finished browser sign-in to the phone app.
 *
 * The app never sees an email link or an SMS code: it opens the ordinary web
 * sign-in in the system browser, and once that session exists (second factor
 * included) the browser mints a grant here. The app trades the code over POST
 * for its own revocable session row, so the long-lived secret never travels in
 * a redirect URL. Only the HMAC of the code is stored, and a grant lives two
 * minutes and is consumed once.
 */
export const deviceGrants = authSchema.table(
  "device_grants",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: varchar("code_hash", { length: 64 }).notNull().unique(),
    /** Whether the browser session that minted it had passed the SMS step. */
    secondFactorVerified: boolean("second_factor_verified")
      .notNull()
      .default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("device_grants_user_created_idx").on(t.userId, t.createdAt)],
);

export const deviceGrantsRelations = relations(deviceGrants, ({ one }) => ({
  user: one(users, { fields: [deviceGrants.userId], references: [users.id] }),
}));

export const verificationTokens = authSchema.table(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/**
 * Single-use password-reset tokens. The emailed secret is random and only its
 * HMAC is stored, so a database read never yields a usable token. Unlike the
 * magic link, consuming a reset token does not create a session — it only
 * authorises setting a new password on the dedicated reset page, so the reset
 * is not gated by the SMS second factor.
 */
export const passwordResetTokens = authSchema.table(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("password_reset_tokens_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

/**
 * Bounded password-attempt ledger for identifier-level throttling. The HMAC
 * prevents this operational table from becoming another email-address list.
 */
export const passwordSignInAttempts = authSchema.table(
  "password_sign_in_attempts",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    identifierHash: varchar("identifier_hash", { length: 64 }).notNull(),
    userId: varchar("user_id", { length: 255 }).references(() => users.id, {
      onDelete: "cascade",
    }),
    succeeded: boolean("succeeded").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("password_attempts_identifier_time_idx").on(
      t.identifierHash,
      t.attemptedAt,
    ),
  ],
);
