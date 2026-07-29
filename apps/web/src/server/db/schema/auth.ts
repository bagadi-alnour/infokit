import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
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
 *
 * `id` is a real `uuid`, not the adapter's default text column, so that the
 * eighty-odd columns pointing at it are the same type as every other key in the
 * database — the alternative is a `varchar(255)` foreign key on every audited
 * row, and a class of typo that Postgres cannot reject. The adapter accepts it:
 * `createUser` asks whether the id column `hasDefault` and lets the database
 * mint the value when it does (docs/SCHEMA-DELIVERY-PLAN.md D1).
 */
export const users = authSchema.table(
  "users",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
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

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  secondFactorChallenges: many(secondFactorChallenges),
  secondFactor: one(userSecondFactors),
}));

export const accounts = authSchema.table(
  "accounts",
  {
    userId: uuid("user_id")
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
    userId: uuid("user_id")
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
 * The mobile number one account receives its SMS step-up codes on.
 *
 * The number lives here rather than in deployment configuration because
 * everybody who reaches the console arrives by invitation: an allowlist keyed
 * by email would mean editing the environment for every person invited, and
 * an account whose role makes the second factor mandatory would be unable to
 * finish its first sign-in. It is not a secret and not a second-factor secret
 * either — possession of the line is the factor — but it is personal data, so
 * only its owner is ever shown it, and then masked.
 *
 * `verified_at` is what makes the number usable: until a code sent to it has
 * been confirmed, the row is an unproven claim. Enrolling a different number
 * clears it, so a mistyped number is corrected by enrolling again rather than
 * locking the account out.
 */
export const userSecondFactors = authSchema.table(
  "user_second_factors",
  {
    userId: uuid("user_id")
      .notNull()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    /** E.164, the one channel that ships today. */
    phone: varchar("phone", { length: 20 }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "user_second_factors_phone_e164_ck",
      sql`${t.phone} ~ '^[+][1-9][0-9]{7,14}$'`,
    ),
  ],
);

export const userSecondFactorsRelations = relations(
  userSecondFactors,
  ({ one }) => ({
    user: one(users, {
      fields: [userSecondFactors.userId],
      references: [users.id],
    }),
  }),
);

/**
 * Short-lived, single-use SMS challenges for the editor step-up check. Codes
 * are HMACed before storage, and the number they were sent to is read from
 * `user_second_factors` (or, for the bootstrap account, from configuration).
 */
export const secondFactorChallenges = authSchema.table(
  "second_factor_challenges",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Named explicitly: the generated name overruns 63 bytes (./schemas.ts).
    sessionToken: varchar("session_token", { length: 255 }).notNull(),
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
    foreignKey({
      columns: [t.sessionToken],
      foreignColumns: [sessions.sessionToken],
      name: "second_factor_challenges_session_token_fk",
    }).onDelete("cascade"),
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
    userId: uuid("user_id")
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
    userId: uuid("user_id")
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
    userId: uuid("user_id").references(() => users.id, {
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
