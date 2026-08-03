import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { authSchema } from "./schemas";

/**
 * Better Auth's tables, in the `auth` PostgreSQL schema.
 *
 * The column names and types are Better Auth's contract, not ours: the library
 * reads and writes these through its Drizzle adapter, and a renamed column is a
 * runtime failure rather than a type error. What we do choose is the *shape* of
 * the keys and the invariants Postgres enforces underneath, and there the
 * database wins:
 *
 * - `id` is a real `uuid`, not the adapter's default text column, because the
 *   eighty-odd columns pointing at `users.id` are `uuid` and a `text` key would
 *   mean a `varchar` foreign key on every audited row. Better Auth is told to
 *   let the database mint them (`advanced.database.generateId: "uuid"`, see
 *   `~/server/auth`), which is why every `id` here carries `defaultRandom()`.
 * - Timestamps are `timestamptz`, as everywhere else in this database. Better
 *   Auth hands Drizzle `Date` objects and reads them back the same way, so the
 *   zone is ours to insist on.
 *
 * The tables Better Auth owns outright — `sessions`, `accounts`,
 * `verification_tokens`, `two_factor` — carry no columns of ours. Anything the
 * product needs alongside them lives in its own table (`user_second_factors`
 * below, `core.user_settings` for preferences), so that a Better Auth upgrade
 * that adds a column cannot collide with one we added.
 *
 * Do not repurpose these for organisation membership; that lives in `core`
 * (docs/DATABASE-SCHEMA.md §4).
 */
export const users = authSchema.table(
  "users",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    /**
     * Better Auth requires a name and writes `""` when a magic-link sign-up
     * has none to offer, so the default keeps the not-null honest rather than
     * making every caller repeat it.
     */
    name: varchar("name", { length: 255 }).notNull().default(""),
    /** One canonical sign-in address per global identity. */
    email: varchar("email", { length: 255 }).notNull(),
    /**
     * A boolean, which is Better Auth's shape — not the timestamp Auth.js used.
     * When the address was confirmed is an audit question, and the audit trail
     * is where it is answered.
     */
    emailVerified: boolean("email_verified").notNull().default(false),
    image: varchar("image", { length: 255 }),
    /**
     * Whether a second factor is armed on this account. Better Auth sets it
     * when an enrolment is confirmed and clears it on disable, which makes it
     * the one honest answer to "is this account protected" — the account's own
     * preference in `core.user_settings` is a *wish*, this is the fact.
     */
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Case-insensitive, which a plain unique index on `email` would not be.
    // Better Auth lowercases before every write and every lookup, so this
    // enforces what the library already assumes instead of duplicating it.
    uniqueIndex("users_normalized_email_uq").on(sql`lower(btrim(${t.email}))`),
    check(
      "users_email_normalized_ck",
      sql`${t.email} = lower(btrim(${t.email}))`,
    ),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  twoFactors: many(twoFactors),
  trustedDevices: many(trustedDevices),
  secondFactor: one(userSecondFactors),
}));

/**
 * Better Auth's session table. The token is stored as issued: unlike the
 * Auth.js adapter this replaces, nothing here is a digest, because Better Auth
 * looks sessions up by the token it handed out and offers no hook to translate
 * at the edge. The session is therefore a bearer secret at rest, and the
 * mitigations are lifetime and revocability — eight hours, one row per device,
 * deletable by an administrator — rather than storage.
 */
export const sessions = authSchema.table(
  "sessions",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /**
     * When this particular session satisfied the second factor, or null.
     *
     * A per-session fact, and it has to be, because Better Auth's second factor
     * is a *sign-in interception* and it only intercepts three paths:
     * `/sign-in/email`, `/sign-in/username`, `/sign-in/phone-number`. A
     * magic-link sign-in is none of them, so on its own it would hand a full
     * session to an account whose role mandates a factor, without ever asking
     * for a code — mailbox access alone would be enough.
     *
     * So "is a factor armed on this account" (`users.two_factor_enabled`) is not
     * the same question as "did *this* session pass one", and only the second is
     * safe to gate on. `requireEditor` reads this column; a
     * `hooks.after` on Better Auth's verify endpoints is what writes it.
     */
    secondFactorVerifiedAt: timestamp("second_factor_verified_at", {
      withTimezone: true,
    }),
    /** Recorded by Better Auth so a person can recognise their own devices. */
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

/**
 * Credentials and linked providers. The password lives here, in the row whose
 * `provider_id` is `credential` — not on `users` — because that is where Better
 * Auth reads it, and because it keeps one account's sign-in methods listable as
 * rows rather than as a widening set of nullable user columns.
 */
export const accounts = authSchema.table(
  "accounts",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    /** The provider's own identifier for the person; the user id for `credential`. */
    accountId: varchar("account_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 255 }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Versioned scrypt record from Better Auth; never a reversible password. */
    password: text("password"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: varchar("scope", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("accounts_user_id_idx").on(t.userId),
    // One row per provider per identity: two `credential` rows for one account
    // would mean two passwords, either of which would open it.
    unique("accounts_provider_account_uq").on(t.providerId, t.accountId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

/**
 * Better Auth's single-use value store, and the reason several tables this
 * schema used to carry are gone.
 *
 * Magic-link tokens, password-reset tokens, the SMS and authenticator codes of
 * the second factor, and the thirty-day "trust this device" markers are all
 * rows here, told apart by `identifier` prefix. They were four bespoke tables
 * before; Better Auth expires and consumes them itself, so keeping our own
 * would mean two implementations of single-use, one of them unexercised.
 */
export const verificationTokens = authSchema.table(
  "verification_tokens",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verification_tokens_identifier_idx").on(t.identifier)],
);

/**
 * The authenticator secret and recovery codes for one account.
 *
 * Better Auth encrypts both with the application secret before they reach this
 * table, and counts failures in the row itself so a stolen phone cannot be
 * brute-forced at leisure: `locked_until` is set once
 * `failed_verification_count` crosses the configured threshold.
 *
 * `verified` distinguishes an enrolment that has been proven from one that was
 * only started — the same distinction `user_second_factors.verified_at` draws
 * for the SMS channel below.
 */
export const twoFactors = authSchema.table(
  "two_factor",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    /**
     * Better Auth's own generator defaults this to `true`; here it is `false`.
     * The library always writes the column explicitly when it enables a factor,
     * so the default is only ever reached by a row somebody else inserted — a
     * seed, a fixture, a repair script — and for a column that decides whether a
     * secret may be trusted, the safe answer to "nobody said" is no.
     */
    verified: boolean("verified").notNull().default(false),
    failedVerificationCount: integer("failed_verification_count")
      .notNull()
      .default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (t) => [
    index("two_factor_user_id_idx").on(t.userId),
    // Better Auth resolves a pending challenge by secret, so this index is on
    // the read path of every code it checks.
    index("two_factor_secret_idx").on(t.secret),
  ],
);

export const twoFactorsRelations = relations(twoFactors, ({ one }) => ({
  user: one(users, { fields: [twoFactors.userId], references: [users.id] }),
}));

/**
 * Better Auth's request counters, and the reason the bespoke
 * `password_sign_in_attempts` ledger is gone.
 *
 * Better Auth throttles in memory by default, which on a platform that scales
 * to more than one process means each of them counts to five separately. Rows
 * here make the limit the deployment's, not the instance's — the whole point of
 * a throttle on a sign-in form.
 *
 * `key` is already a hash of the caller and the route, so this table is not a
 * second list of who tried to sign in; the *events* worth reviewing are written
 * to `audit.audit_events` instead, which is where a security question is asked.
 */
export const rateLimits = authSchema.table("rate_limits", {
  id: uuid("id").defaultRandom().notNull().primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  count: integer("count").notNull(),
  /** Epoch milliseconds, which is how Better Auth compares windows. */
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/**
 * The mobile number one account receives its SMS codes on.
 *
 * This is ours, not Better Auth's: the library's second factor knows how to
 * *send* a one-time code (`otpOptions.sendOTP`) but takes no view on where, so
 * the destination is a product question and lives in a product table.
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
 * A browser its owner has told us to stop asking for a code on.
 *
 * Better Auth has a "trust this device" of its own, and it is not enough here,
 * for one reason that decides the whole design: it honours `trustDevice` only on
 * the branch where the factor *interrupted a password sign-in*. Confirming a code
 * while a session already exists — a step-up — returns the token and ignores the
 * flag outright (`verify-two-factor.mjs`, the second `valid()`). In this console
 * the usual sign-in is an emailed link, which Better Auth does not intercept, so
 * almost every code this product asks for is a step-up. Trust recorded only by
 * the library would therefore do nothing for almost everybody.
 *
 * So the durable record is here, and it is read by the session stamp
 * (`~/server/auth/second-factor-stamp`) rather than by the library: when a
 * session is created on a device holding a live row, that session is stamped as
 * having passed the factor, which is the same fact `requireEditor` already gates
 * on. The library's own marker is still set alongside it on the password path,
 * because suppressing the library's own interception is something only the
 * library can do — see `~/server/auth/trusted-device`, which owns both halves.
 *
 * What is stored, and what deliberately is not:
 *
 * - `token_hash` is a SHA-256 digest, never the secret. The secret lives in one
 *   cookie on one device; a stolen copy of this table skips nobody's factor,
 *   which is the same rule Better Auth applies to codes and one-time tokens.
 * - `user_agent` and `ip_address` are here to be *shown*, so somebody scanning
 *   the list can recognise their own laptop and revoke the one they cannot place
 *   — the same reason `sessions` carries them.
 * - No sliding expiry. `expires_at` is fixed when trust is granted, so a
 *   fortnight means a fortnight and a device in daily use still meets the factor
 *   again on a known date. `last_used_at` is for the reader, not for the clock.
 */
export const trustedDevices = authSchema.table(
  "trusted_devices",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 45 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("trusted_devices_user_id_idx").on(t.userId),
    // A digest, in the one shape a digest can take. Anything else in this column
    // is a bug that would otherwise present as a device that never matches.
    check(
      "trusted_devices_token_hash_ck",
      sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const trustedDevicesRelations = relations(trustedDevices, ({ one }) => ({
  user: one(users, {
    fields: [trustedDevices.userId],
    references: [users.id],
  }),
}));
