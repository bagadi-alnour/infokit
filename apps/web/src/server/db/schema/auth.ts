import { relations } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  text,
  timestamp,
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
export const users = authSchema.table("users", {
  id: varchar("id", { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified", {
    mode: "date",
    withTimezone: true,
  }),
  image: varchar("image", { length: 255 }),
});

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
