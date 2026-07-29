import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { languages } from "./catalog";
import { organizations } from "./organizations";
import {
  core,
  timestamps,
  translatorDirectoryScope,
  translatorStatus,
} from "./schemas";

/**
 * A translator the network knows by name (docs/DATABASE-SCHEMA.md §12).
 *
 * Until now a translator existed only as an email address typed into one
 * assignment form (`content.translation_assignments.translator_email`): the
 * same person retyped for every language, with nowhere to say which languages
 * they actually work in and no way to see what they had already done. This row
 * is that missing identity — invited once, kept in a directory an editor picks
 * from, and owned by the translator themselves once they sign in.
 *
 * It is deliberately **not** an `core.organization_members` row. A translator
 * is not staff of an organisation: they have no membership, no organisation
 * roles, and no workspace beyond their own space. `ownerOrganizationId`
 * records who brought them in, not who they belong to, and pairs with
 * `directoryScope` to answer who may send them work.
 *
 * Link possession still authorises one assignment session
 * (docs/PHASE-1.3-COLLABORATION.md); a translator who has opened their space
 * signs in as themselves and sees the assignments addressed to this row.
 */
export const translators = core.table(
  "translators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * The global login identity, once the invited person signs in with the
     * invited address. Null while the invitation is outstanding — the same
     * shape as a pending organisation membership.
     */
    userId: uuid("user_id").references(() => users.id),
    /** Who invited them. Null when the platform maintains the entry itself. */
    ownerOrganizationId: uuid("owner_organization_id").references(
      () => organizations.id,
    ),
    displayName: varchar("display_name", { length: 200 }).notNull(),
    /** Where assignment links are sent; stored lowercase, one entry per person. */
    contactEmail: varchar("contact_email", { length: 255 }).notNull(),
    /** One line an editor reads while choosing — "legal French to Pashto". */
    headline: varchar("headline", { length: 160 }),
    bio: text("bio"),
    timezone: varchar("timezone", { length: 50 })
      .notNull()
      .default("Europe/Paris"),
    status: translatorStatus("status").notNull().default("invited"),
    directoryScope: translatorDirectoryScope("directory_scope")
      .notNull()
      .default("organization"),
    /** When they first opened their own space by signing in. */
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    /** One directory entry per person, however the address was typed. */
    uniqueIndex("translators_contact_email_uq").on(
      sql`lower(btrim(${t.contactEmail}))`,
    ),
    uniqueIndex("translators_user_uq")
      .on(t.userId)
      .where(sql`${t.userId} is not null`),
    check(
      "translators_contact_email_normalized_ck",
      sql`${t.contactEmail} = lower(btrim(${t.contactEmail}))`,
    ),
    /** A linked account is what "activated" means; neither exists without the other. */
    check(
      "translators_activation_check",
      sql`(${t.activatedAt} is null) = (${t.userId} is null)`,
    ),
    /** The picker reads "active translators I am allowed to see". */
    index("translators_scope_status_idx").on(t.directoryScope, t.status),
    index("translators_owner_idx").on(t.ownerOrganizationId),
  ],
);

/**
 * The languages one translator works in, and in which direction — the whole
 * point of the directory. An editor sending Ukrainian looks for someone who
 * can translate *into* Ukrainian; `canTranslateFrom` marks the languages they
 * can read a source in, which is how a source that is not French finds anyone
 * at all.
 */
export const translatorLanguages = core.table(
  "translator_languages",
  {
    translatorId: uuid("translator_id")
      .notNull()
      .references(() => translators.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    canTranslateInto: boolean("can_translate_into").notNull().default(true),
    canTranslateFrom: boolean("can_translate_from").notNull().default(false),
    /** "certified", "spoken register only" — what the pair does not say. */
    note: varchar("note", { length: 200 }),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.translatorId, t.languageCode] }),
    /** A row that claims neither direction says nothing; delete it instead. */
    check(
      "translator_languages_direction_check",
      sql`${t.canTranslateInto} or ${t.canTranslateFrom}`,
    ),
    index("translator_languages_language_idx").on(
      t.languageCode,
      t.canTranslateInto,
    ),
  ],
);
