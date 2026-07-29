import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  unique,
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
  specialityChangeAction,
  specialityChangeItemDecision,
  specialityChangeState,
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
export const organizationProfiles = content.table(
  "organization_profiles",
  {
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
    // Named explicitly below: the generated name overruns 63 bytes
    // (./schemas.ts).
    narrativeSourceLanguage: varchar("narrative_source_language", {
      length: 35,
    })
      .notNull()
      .default("fr"),
    ...stewardContact,
    ...verification,
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "organization_profiles_narrative_source_language_fk",
      columns: [t.narrativeSourceLanguage],
      foreignColumns: [languages.code],
    }),
  ],
);

export const organizationProfileTranslations = content.table(
  "organization_profile_translations",
  {
    // All three named explicitly: the generated names overrun 63 bytes
    // (./schemas.ts).
    organizationId: uuid("organization_id").notNull(),
    languageCode: varchar("language_code", { length: 35 }).notNull(),
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
    verifiedById: uuid("verified_by_id").references(() => users.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({
      columns: [t.organizationId, t.languageCode],
      name: "organization_profile_translations_pk",
    }),
    foreignKey({
      name: "organization_profile_translations_organization_id_fk",
      columns: [t.organizationId],
      foreignColumns: [organizationProfiles.organizationId],
    }).onDelete("cascade"),
    foreignKey({
      name: "organization_profile_translations_language_code_fk",
      columns: [t.languageCode],
      foreignColumns: [languages.code],
    }),
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

/**
 * An organisation's request to change which specialities it claims (FR-P2-018).
 *
 * Specialities are not free-text self-description — they are what the platform
 * has verified an association actually does, and they drive who is asked to
 * coordinate what. So an organisation proposes a change and the platform decides;
 * the assignment rows above are only ever written as the result of a decision
 * here, never directly by the organisation.
 *
 * The unit is the *set*, not the single speciality, because the changes arrive
 * together and read differently apart: "we have stopped doing showers and started
 * doing legal advice" is one decision about a reorientation, and reviewing the two
 * halves independently loses the sentence.
 */
export const specialityChangeRequests = content.table(
  "speciality_change_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    state: specialityChangeState("state").notNull().default("submitted"),
    /** Why the organisation is asking — the reviewer's main evidence. */
    rationale: text("rationale"),
    submittedById: uuid("submitted_by_id").references(() => users.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedById: uuid("reviewed_by_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /** The platform's answer in words, shown to the organisation as written. */
    reviewNote: text("review_note"),
    ...timestamps,
  },
  (t) => [
    // A rejection an organisation cannot read is a dead end: it never learns what
    // to change, and it re-submits the same set.
    check(
      "speciality_change_requests_decision_check",
      sql`(${t.state} in ('approved', 'partially_approved', 'rejected') and ${t.reviewedAt} is not null and ${t.reviewedById} is not null) or (${t.state} in ('submitted', 'under_review', 'cancelled'))`,
    ),
    // One open set per organisation, so a reviewer is never deciding two
    // proposals that contradict each other.
    uniqueIndex("speciality_change_requests_open_uq")
      .on(t.organizationId)
      .where(sql`${t.state} in ('submitted', 'under_review')`),
    index("speciality_change_requests_state_time_idx").on(
      t.state,
      t.submittedAt,
    ),
    // The platform review queue is ordered oldest-first across organisations.
    index("speciality_change_requests_org_time_idx").on(
      t.organizationId,
      t.submittedAt,
    ),
    // The target for the items' composite key below.
    unique("speciality_change_requests_scope_uq").on(t.id, t.organizationId),
  ],
);

/**
 * One requested change inside a set: add this speciality, remove that one, make
 * this the primary, or move it in the display order.
 *
 * Decided per line, which is what makes `partially_approved` a real state on the
 * request rather than a label — a reviewer can accept the removal and hold the
 * addition until they have seen the evidence.
 *
 * `organization_id` is repeated here and held to the request's own organisation
 * by a composite key, so a tenant policy on this table needs no join and a line
 * cannot be attached to another organisation's request.
 */
export const specialityChangeItems = content.table(
  "speciality_change_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    specialityId: uuid("speciality_id")
      .notNull()
      .references(() => specialities.id, { onDelete: "restrict" }),
    action: specialityChangeAction("action").notNull(),
    /** The position asked for, when the action is `reorder`. */
    requestedOrder: integer("requested_order"),
    decision: specialityChangeItemDecision("decision")
      .notNull()
      .default("pending"),
    /** Why this particular line was refused, when it was. */
    decisionNote: text("decision_note"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "speciality_change_items_request_scope_fk",
      columns: [t.requestId, t.organizationId],
      foreignColumns: [
        specialityChangeRequests.id,
        specialityChangeRequests.organizationId,
      ],
    }).onDelete("cascade"),
    // Asking twice about the same speciality in one set makes the outcome depend
    // on which line is applied last.
    uniqueIndex("speciality_change_items_request_spec_uq").on(
      t.requestId,
      t.specialityId,
    ),
    check(
      "speciality_change_items_order_check",
      sql`(${t.action} = 'reorder' and ${t.requestedOrder} is not null) or (${t.action} <> 'reorder' and ${t.requestedOrder} is null)`,
    ),
    check(
      "speciality_change_items_decision_check",
      sql`(${t.decision} = 'pending' and ${t.decidedAt} is null) or (${t.decision} <> 'pending' and ${t.decidedAt} is not null)`,
    ),
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
