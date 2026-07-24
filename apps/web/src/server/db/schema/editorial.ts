import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { assets } from "./assets";
import { users } from "./auth";
import { cities, languages } from "./catalog";
import { contacts, organizations } from "./organizations";
import {
  archival,
  attributionRole,
  content,
  custodianKind,
  editorialKind,
  editorialWorkflowState,
  reviewTaskStatus,
  timestamps,
  translationMethod,
  translationState,
} from "./schemas";
import { services } from "./services";
import { tags } from "./tags";
import { serviceCategories } from "./taxonomies";
import { translationSourceVersions } from "./translation-sources";

/**
 * Articles, fixed information, and basic information share one editorial
 * base with typed detail tables (docs/DATABASE-SCHEMA.md §8). The entry is
 * the stable identity/URL; revisions are immutable.
 */
export const editorialEntries = content.table("editorial_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: editorialKind("kind").notNull(),
  slug: varchar("slug", { length: 150 }).notNull().unique(),
  workflowState: editorialWorkflowState("workflow_state")
    .notNull()
    .default("draft"),
  cityId: uuid("city_id").references(() => cities.id),
  ...archival,
  ...timestamps,
});

/**
 * Locale-specific public routes. Retired rows remain reserved so old links
 * can redirect to the current route instead of being reused by another entry.
 */
export const editorialEntryRoutes = content.table(
  "editorial_entry_routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => editorialEntries.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    slug: varchar("slug", { length: 150 }).notNull(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("editorial_entry_routes_language_slug_uq").on(
      t.languageCode,
      t.slug,
    ),
    uniqueIndex("editorial_entry_routes_active_entry_language_uq")
      .on(t.entryId, t.languageCode)
      .where(sql`${t.retiredAt} is null`),
  ],
);

/** Public/workspace tags selected from the reusable tag catalogue. */
export const editorialEntryTags = content.table(
  "editorial_entry_tags",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => editorialEntries.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "restrict" }),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.tagId] })],
);

/** Images/media attached to an article, including one optional cover image. */
export const editorialEntryAssets = content.table(
  "editorial_entry_assets",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => editorialEntries.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    role: varchar("role", { length: 20 }).$type<"cover" | "inline">().notNull(),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.entryId, t.assetId] }),
    uniqueIndex("editorial_entry_assets_cover_uq")
      .on(t.entryId)
      .where(sql`${t.role} = 'cover'`),
  ],
);

/**
 * Immutable authored revision — no updatedAt by design; edits create the
 * next revision. `unreliableFrom` powers the dated public warning
 * (FR-P1-009/010) without unpublishing.
 */
export const editorialRevisions = content.table(
  "editorial_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => editorialEntries.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    authorId: varchar("author_id", { length: 255 }).references(() => users.id),
    sourceLanguageCode: varchar("source_language_code", { length: 35 })
      .notNull()
      .default("fr")
      .references(() => languages.code),
    canBecomeOutdated: boolean("can_become_outdated").notNull().default(false),
    unreliableFrom: date("unreliable_from"),
    sourceSummary: text("source_summary"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    reviewDueAt: timestamp("review_due_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("editorial_revisions_entry_number_uq").on(
      t.entryId,
      t.revisionNumber,
    ),
  ],
);

export const editorialRevisionTranslations = content.table(
  "editorial_revision_translations",
  {
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => editorialRevisions.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    title: varchar("title", { length: 200 }).notNull(),
    summary: text("summary"),
    bodyJson: jsonb("body_json"),
    plainText: text("plain_text"),
    state: translationState("state").notNull().default("draft"),
    method: translationMethod("method").notNull().default("human"),
    sourceVersionId: uuid("source_version_id").references(
      () => translationSourceVersions.id,
      { onDelete: "restrict" },
    ),
    /** SHA-256 of the canonical localized target payload. */
    contentHash: varchar("content_hash", { length: 64 }),
    providerCode: varchar("provider_code", { length: 100 }),
    providerJobReference: varchar("provider_job_reference", { length: 255 }),
    carriedForwardFromRevisionId: uuid(
      "carried_forward_from_revision_id",
    ).references(() => editorialRevisions.id, { onDelete: "restrict" }),
    verifiedById: varchar("verified_by_id", { length: 255 }).references(
      () => users.id,
    ),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.revisionId, t.languageCode] })],
);

/**
 * Pointer to the exact revision public for one locale; one active
 * publication per (entry, language) via partial unique index.
 */
export const editorialPublications = content.table(
  "editorial_publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => editorialEntries.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => editorialRevisions.id),
    sourceVersionId: uuid("source_version_id").notNull(),
    /** Hash of the exact localized payload approved for this activation. */
    translationContentHash: varchar("translation_content_hash", {
      length: 64,
    }).notNull(),
    publishedById: varchar("published_by_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Null activates immediately; a future value delays public visibility. */
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    unpublishedById: varchar("unpublished_by_id", { length: 255 }).references(
      () => users.id,
    ),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: "editorial_publications_source_scope_fk",
      columns: [t.sourceVersionId],
      foreignColumns: [translationSourceVersions.id],
    }).onDelete("restrict"),
    check(
      "editorial_publications_content_hash_check",
      sql`${t.translationContentHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "editorial_publications_schedule_check",
      sql`${t.scheduledFor} is null or ${t.scheduledFor} > ${t.publishedAt}`,
    ),
    check(
      "editorial_publications_unpublish_check",
      sql`(${t.unpublishedAt} is null and ${t.unpublishedById} is null) or (${t.unpublishedAt} >= ${t.publishedAt} and ${t.unpublishedById} is not null)`,
    ),
    uniqueIndex("editorial_publications_active_uq")
      .on(t.entryId, t.languageCode)
      .where(sql`${t.unpublishedAt} is null`),
  ],
);

/* Typed detail tables per kind */

export const articleDetails = content.table("article_details", {
  entryId: uuid("entry_id")
    .primaryKey()
    .references(() => editorialEntries.id, { onDelete: "cascade" }),
  articleDate: date("article_date"),
  featured: boolean("featured").notNull().default(false),
});

export const fixedInformationDetails = content.table(
  "fixed_information_details",
  {
    entryId: uuid("entry_id")
      .primaryKey()
      .references(() => editorialEntries.id, { onDelete: "cascade" }),
    topicCode: varchar("topic_code", { length: 50 }).notNull(),
    reviewIntervalDays: integer("review_interval_days"),
  },
);

export const basicInformationDetails = content.table(
  "basic_information_details",
  {
    entryId: uuid("entry_id")
      .primaryKey()
      .references(() => editorialEntries.id, { onDelete: "cascade" }),
    icon: varchar("icon", { length: 50 }).notNull(),
    priority: integer("priority").notNull().default(0),
    emergency: boolean("emergency").notNull().default(false),
    categoryId: uuid("category_id").references(() => serviceCategories.id),
  },
);

/**
 * One active administrative custodian per entry (PRODUCT.md §14.5):
 * an organisation or the platform (`organizationId` null). Custody never
 * rewrites historical factual ownership. Transfer request tables arrive
 * with Phase 2 (FR-P2-019/020).
 */
export const editorialCustodianships = content.table(
  "editorial_custodianships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => editorialEntries.id, { onDelete: "cascade" }),
    custodianKind: custodianKind("custodian_kind").notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    actorUserId: varchar("actor_user_id", { length: 255 }).references(
      () => users.id,
    ),
  },
  (t) => [
    uniqueIndex("editorial_custodianships_active_uq")
      .on(t.entryId)
      .where(sql`${t.endedAt} is null`),
  ],
);

/** Traceable factual sources (FR-P1-019, §14.1). */
export const sources = content.table("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  publisher: varchar("publisher", { length: 255 }),
  url: text("url"),
  sourceDate: date("source_date"),
  retrievedOn: date("retrieved_on"),
  ...timestamps,
});

export const editorialRevisionSources = content.table(
  "editorial_revision_sources",
  {
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => editorialRevisions.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    role: varchar("role", { length: 50 }),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.revisionId, t.sourceId] })],
);

/**
 * Factual owners / publishers named on a revision, with the recorded
 * proxy-publication approval evidence FR-P1-021 requires (representative,
 * channel, date). The sealed-revision joint-publication engine
 * (docs/DATABASE-SCHEMA.md §11) is deferred to its evidence trigger
 * (PRODUCT.md §8.1) and will extend this additively.
 */
export const editorialRevisionOrganizations = content.table(
  "editorial_revision_organizations",
  {
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => editorialRevisions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    role: attributionRole("role").notNull().default("factual_owner"),
    approvedByName: varchar("approved_by_name", { length: 200 }),
    approvedVia: varchar("approved_via", { length: 100 }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    evidenceNote: text("evidence_note"),
  },
  (t) => [primaryKey({ columns: [t.revisionId, t.organizationId] })],
);

/** Media attached to an exact revision (cover, inline, audio, video…). */
export const editorialRevisionAssets = content.table(
  "editorial_revision_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => editorialRevisions.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id),
    role: varchar("role", { length: 50 }).notNull(),
    languageCode: varchar("language_code", { length: 35 }).references(
      () => languages.code,
    ),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("editorial_revision_assets_uq").on(
      t.revisionId,
      t.assetId,
      t.role,
    ),
  ],
);

/* Editorial relationships (related content shown on detail pages) */

export const editorialRelatedEntries = content.table(
  "editorial_related_entries",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => editorialEntries.id, { onDelete: "cascade" }),
    relatedEntryId: uuid("related_entry_id")
      .notNull()
      .references(() => editorialEntries.id, { onDelete: "cascade" }),
    relationKind: varchar("relation_kind", { length: 50 }),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.relatedEntryId] })],
);

export const editorialRelatedServices = content.table(
  "editorial_related_services",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => editorialEntries.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.serviceId] })],
);

export const editorialRelatedOrganizations = content.table(
  "editorial_related_organizations",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => editorialEntries.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.organizationId] })],
);

/** Editorial contacts surfaced as safe next steps. */
export const editorialRelatedContacts = content.table(
  "editorial_related_contacts",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => editorialEntries.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.contactId] })],
);

/**
 * Freshness/review queue (workspace "needs attention"). Polymorphic
 * entity reference is a deliberate exception, as in
 * docs/DATABASE-SCHEMA.md §11 — services must validate the target exists.
 */
export const reviewTasks = content.table("review_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityKind: varchar("entity_kind", { length: 50 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  assigneeId: varchar("assignee_id", { length: 255 }).references(
    () => users.id,
  ),
  dueAt: timestamp("due_at", { withTimezone: true }),
  status: reviewTaskStatus("status").notNull().default("open"),
  resolutionNote: text("resolution_note"),
  ...timestamps,
});
