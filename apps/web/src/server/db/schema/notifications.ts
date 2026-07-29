import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { auditEvents } from "./audit-log";
import { users } from "./auth";
import { organizations } from "./organizations";
import {
  deliveryChannel,
  deliveryStatus,
  notificationEndpointChannel,
  notificationKind,
  notifications,
  timestamps,
} from "./schemas";

/**
 * What the platform sent, to which channel, and what came back
 * (docs/DATABASE-SCHEMA.md §16 — the delivery lifecycle table).
 *
 * It ships ahead of the outbox and the in-app notification table because the
 * question it answers is already live: an editor who never received their
 * invitation, or a colleague locked out because the SMS code did not arrive,
 * is a support case today, and "the provider accepted it at 14:07 with id X"
 * is the only answer that ends it. Every row is one *attempt*, so a retry adds
 * a row rather than overwriting the evidence of the first failure.
 *
 * The recipient is stored twice and in full neither time: `recipient_redacted`
 * is what a person reads in the console, `recipient_hash` is what a search
 * matches on. Both are deliberate — a delivery log that keeps plain addresses
 * becomes the address list this schema is careful never to hold
 * (`notifications.endpoints` owns verified addresses, encrypted). Message
 * bodies are never stored: `template` names what was sent, and the catalogue
 * says what that template reads.
 */
export const deliveryAttempts = notifications.table(
  "delivery_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: deliveryChannel("channel").notNull(),
    status: deliveryStatus("status").notNull().default("queued"),
    /**
     * Which message this was — `auth.magic_link`, `invitation`,
     * `translation.assignment`, `auth.sms_code`. A string rather than the
     * `notification_kind` enum: that enum is what a person can switch off in
     * their preferences, while an account-security message is sent whatever the
     * preferences say and still has to be logged under its own name.
     */
    template: varchar("template", { length: 120 }).notNull(),
    /** `b•••i@example.com`, `+336••••78` — enough to recognise, not to reuse. */
    recipientRedacted: varchar("recipient_redacted", { length: 160 }).notNull(),
    /**
     * HMAC-SHA256 of the normalised address, keyed with the deployment secret:
     * searchable, never reversible. Keyed rather than plain because a bare
     * digest of a phone number is no secret at all — every number in the
     * numbering plan can be hashed in an afternoon.
     */
    recipientHash: varchar("recipient_hash", { length: 64 }).notNull(),
    /** The account this reached, when the address belonged to one. */
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    /** Which language the message was written in. */
    locale: varchar("locale", { length: 35 }),
    /** `ses`, `sns`, or `dev-log` when the development transport swallowed it. */
    provider: varchar("provider", { length: 40 }),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    errorCode: varchar("error_code", { length: 120 }),
    /** Provider wording, truncated; never the message body or the recipient. */
    errorMessage: varchar("error_message", { length: 400 }),
    attempt: integer("attempt").notNull().default(1),
    durationMs: integer("duration_ms"),
    /**
     * The audited action that caused the send, so "who invited this person?"
     * and "did the invitation arrive?" are one lookup instead of two.
     *
     * Two columns, not one: `audit.events` is partitioned by `occurred_at`, so
     * its primary key is `(id, occurred_at)` and a key pointing at it has to
     * carry both. The reference is in the extras below rather than inline here
     * for the same reason.
     */
    auditEventId: uuid("audit_event_id"),
    /**
     * The partition key of the row `audit_event_id` names — carried, never
     * chosen. `recordAudit` returns it alongside the id so a caller never has
     * to guess, and the composite key rejects a mismatched pair.
     */
    auditEventOccurredAt: timestamp("audit_event_occurred_at", {
      withTimezone: true,
    }),
    requestId: varchar("request_id", { length: 100 }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // Named explicitly: the generated name would be
    // `delivery_attempts_audit_event_id_audit_event_occurred_at_events_id_occurred_at_fk`,
    // far past Postgres's 63 bytes. The rule is in ./schemas.ts.
    foreignKey({
      name: "delivery_attempts_audit_event_fk",
      columns: [t.auditEventId, t.auditEventOccurredAt],
      foreignColumns: [auditEvents.id, auditEvents.occurredAt],
    }).onDelete("set null"),
    index("delivery_attempts_time_idx").on(t.createdAt),
    index("delivery_attempts_status_time_idx").on(t.status, t.createdAt),
    index("delivery_attempts_channel_time_idx").on(t.channel, t.createdAt),
    index("delivery_attempts_recipient_idx").on(t.recipientHash),
  ],
);

/**
 * A verified address the platform may send to (docs/DATABASE-SCHEMA.md §16).
 *
 * The address is never stored in the clear. `address_ciphertext` holds it
 * encrypted at the column level, `address_hash` is the HMAC that lookups and
 * uniqueness run on, and `address_redacted` is what a person sees on screen.
 * Column encryption rather than relying on encryption at rest: at-rest protects
 * the disk and does nothing about a mistaken query, a log line, or a copy of a
 * backup — and this table is the one place on the platform that holds a list of
 * how to reach real people. `key_version` is what makes rotation possible without
 * a migration: a new key encrypts new rows while old rows stay readable.
 *
 * An endpoint is unusable until `verified_at` is set. That is the whole point of
 * the table — the delivery log records where things were sent, and this records
 * where the platform is *allowed* to send, proved by the person answering at that
 * address. `disabled_at` is set on a bounce, a complaint, or the person's own
 * request, and a disabled endpoint is never selected again.
 */
export const notificationEndpoints = notifications.table(
  "endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: notificationEndpointChannel("channel").notNull(),
    /** Encrypted with the deployment key named by `key_version`. */
    addressCiphertext: text("address_ciphertext").notNull(),
    /** HMAC-SHA256 of the normalised address: the only searchable form. */
    addressHash: varchar("address_hash", { length: 64 }).notNull(),
    /** `b•••i@example.com`, `+336••••78` — enough to recognise, not to reuse. */
    addressRedacted: varchar("address_redacted", { length: 160 }).notNull(),
    keyVersion: integer("key_version").notNull().default(1),
    /** The person's default for this channel. At most one per channel. */
    isPrimary: boolean("is_primary").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    /** Why it stopped being usable — `bounced`, `complaint`, `user_removed`. */
    disabledReason: varchar("disabled_reason", { length: 80 }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check(
      "notification_endpoints_address_hash_check",
      sql`${t.addressHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "notification_endpoints_disabled_check",
      sql`(${t.disabledAt} is null and ${t.disabledReason} is null) or (${t.disabledAt} is not null and ${t.disabledReason} is not null)`,
    ),
    // The same address twice on one account, on one channel, is one endpoint.
    uniqueIndex("notification_endpoints_user_channel_address_uq").on(
      t.userId,
      t.channel,
      t.addressHash,
    ),
    // One live default per channel: two would make "where does this go?"
    // depend on row order.
    uniqueIndex("notification_endpoints_primary_uq")
      .on(t.userId, t.channel)
      .where(sql`${t.isPrimary} and ${t.disabledAt} is null`),
    // The send path asks for one person's usable endpoints on one channel.
    index("notification_endpoints_user_channel_idx").on(t.userId, t.channel),
    index("notification_endpoints_address_idx").on(t.addressHash),
  ],
);

/**
 * A message waiting for someone inside the workspace — the bell, not the mailbox.
 *
 * The const is `inAppNotifications` because `notifications` is the schema object;
 * the table is `notifications.notifications`.
 *
 * Nothing here is a rendered sentence. `title_key` and `body_key` are translation
 * keys and `params` carries their values, so the same row reads in French to one
 * member and in English to another, and a wording fix ships in the message
 * catalogue instead of an `UPDATE` over history. `params` is safe values only —
 * a title, a count, a date — never a phone number, an address, or document
 * content: this row is read by whoever the notification is for, and a notification
 * body is the easiest place in a system to leak something by accident.
 *
 * `read_at` is per row and this table is per recipient, so a notification to five
 * members is five rows. That is deliberate: one row with a read-by set answers
 * "who has seen it?" and cannot answer "what is unread for me?" without scanning.
 */
export const inAppNotifications = notifications.table(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The workspace it concerns; null for an account-level message. */
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    kind: notificationKind("kind").notNull(),
    titleKey: varchar("title_key", { length: 160 }).notNull(),
    bodyKey: varchar("body_key", { length: 160 }),
    /** Interpolation values for the two keys. Safe values only. */
    params: jsonb("params"),
    /** Where the bell takes you — a pathname, never with a query string. */
    linkPath: varchar("link_path", { length: 255 }),
    /** What it is about, for grouping and for dismissing a stale one. */
    entityType: varchar("entity_type", { length: 100 }),
    entityId: varchar("entity_id", { length: 255 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check(
      "notifications_link_check",
      sql`${t.linkPath} is null or ${t.linkPath} like '/%'`,
    ),
    // The bell: this person's unread, newest first.
    index("notifications_user_unread_idx")
      .on(t.userId, t.createdAt)
      .where(sql`${t.readAt} is null`),
    index("notifications_user_time_idx").on(t.userId, t.createdAt),
    index("notifications_entity_idx").on(t.entityType, t.entityId),
  ],
);

export const deliveryAttemptsRelations = relations(
  deliveryAttempts,
  ({ one }) => ({
    user: one(users, {
      fields: [deliveryAttempts.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [deliveryAttempts.organizationId],
      references: [organizations.id],
    }),
    auditEvent: one(auditEvents, {
      fields: [
        deliveryAttempts.auditEventId,
        deliveryAttempts.auditEventOccurredAt,
      ],
      references: [auditEvents.id, auditEvents.occurredAt],
    }),
  }),
);
