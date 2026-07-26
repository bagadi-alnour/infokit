import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  integer,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { languages } from "./catalog";
import { translationSourceVersions } from "./translation-sources";
import {
  contactKind,
  contactVisibility,
  content,
  core,
  organizationStatus,
  specialityAssignmentState,
  stewardContact,
  timestamps,
  translationMethod,
  translationState,
  verification,
} from "./schemas";
import { specialities } from "./taxonomies";

/** Stable private organisation identity (docs/DATABASE-SCHEMA.md §5). */
export const organizations = core.table(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    legalName: varchar("legal_name", { length: 200 }),
    displayName: varchar("display_name", { length: 200 }).notNull(),
    foundedYear: integer("founded_year"),
    timezone: varchar("timezone", { length: 50 })
      .notNull()
      .default("Europe/Paris"),
    status: organizationStatus("status").notNull().default("draft"),
    publishingSuspended: boolean("publishing_suspended")
      .notNull()
      .default(false),
    /**
     * Set when the organisation first takes ownership of its own workspace (an
     * org-admin member links their account). Once claimed, platform admins are
     * read-only for this organisation and the org's own members edit its data.
     */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check(
      "organizations_founded_year_check",
      sql`${t.foundedYear} between 1800 and 2100`,
    ),
  ],
);

/** Public, reviewable part of an organisation. */
export const organizationProfiles = content.table("organization_profiles", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  website: varchar("website", { length: 255 }),
  sourceUrl: text("source_url"),
  sourceCheckedOn: date("source_checked_on"),
  logoUrl: text("logo_url"),
  logoRightsConfirmed: boolean("logo_rights_confirmed")
    .notNull()
    .default(false),
  published: boolean("published").notNull().default(false),
  /**
   * The language the narrative below is authored in. Every other editorial
   * language is a translation of it, so this is what a translation request on
   * the record page pins its source version to.
   */
  narrativeSourceLanguage: varchar("narrative_source_language", { length: 35 })
    .notNull()
    .default("fr")
    .references(() => languages.code),
  ...stewardContact,
  ...verification,
  ...timestamps,
});

export const organizationProfileTranslations = content.table(
  "organization_profile_translations",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationProfiles.organizationId, {
        onDelete: "cascade",
      }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    purpose: text("purpose").notNull(),
    goals: text("goals"),
    values: text("values"),
    accessibilitySummary: text("accessibility_summary"),
    /** Rich narrative, sanitised HTML plus its plain-text rendering. */
    presentationHtml: text("presentation_html"),
    presentationText: text("presentation_text"),
    state: translationState("state").notNull().default("draft"),
    method: translationMethod("method").notNull().default("human"),
    /**
     * Provenance, mirroring `activity_translations`: which sealed source
     * version this language was translated from, which provider produced it,
     * and who confirmed it reads correctly. Without these a profile
     * translation could not be verified or shown as stale.
     */
    sourceVersionId: uuid("source_version_id"),
    contentHash: varchar("content_hash", { length: 64 }),
    providerCode: varchar("provider_code", { length: 100 }),
    carriedForwardFromSourceVersionId: uuid(
      "carried_forward_from_source_version_id",
    ),
    verifiedById: varchar("verified_by_id", { length: 255 }).references(
      () => users.id,
    ),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.languageCode] }),
    foreignKey({
      name: "organization_profile_translations_source_scope_fk",
      columns: [t.sourceVersionId],
      foreignColumns: [translationSourceVersions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "organization_profile_translations_carried_source_scope_fk",
      columns: [t.carriedForwardFromSourceVersionId],
      foreignColumns: [translationSourceVersions.id],
    }).onDelete("restrict"),
  ],
);

/**
 * Effective-dated speciality assignments. Marking a primary is optional:
 * co-equal organisations mark none (PRODUCT.md §14.3); at most one
 * non-retired primary is enforced by a partial unique index.
 */
export const organizationSpecialities = content.table(
  "organization_specialities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    specialityId: uuid("speciality_id")
      .notNull()
      .references(() => specialities.id),
    state: specialityAssignmentState("state").notNull().default("verified"),
    isPrimary: boolean("is_primary").notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("org_specialities_org_spec_uq").on(
      t.organizationId,
      t.specialityId,
    ),
    uniqueIndex("org_specialities_one_primary_uq")
      .on(t.organizationId)
      .where(sql`${t.isPrimary} = true and ${t.retiredAt} is null`),
  ],
);

/** Languages in which the organisation can actually serve people. */
export const organizationLanguages = content.table(
  "organization_languages",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    note: varchar("note", { length: 200 }),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.languageCode] })],
);

/** Safe contact methods; visibility gates what the public ever sees. */
export const contacts = content.table("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  kind: contactKind("kind").notNull(),
  value: varchar("value", { length: 255 }),
  visibility: contactVisibility("visibility").notNull().default("public"),
  displayOrder: integer("display_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const contactTranslations = content.table(
  "contact_translations",
  {
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    label: varchar("label", { length: 100 }).notNull(),
    instructions: text("instructions"),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.languageCode] })],
);
