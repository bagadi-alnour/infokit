import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
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
  basicInformationOperator,
  basicInformationReach,
  content,
  custodianKind,
  custodyTransferState,
  editorialKind,
  editorialWorkflowState,
  reviewTaskStatus,
  stewardContact,
  timestamps,
  translationMethod,
  translationReviewStage,
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
  ...stewardContact,
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

/**
 * Media attached to an article: one optional cover image, images placed in the
 * body, and the documents offered for download — a form to fill in, a timetable
 * to print. `attachment` is the same word `activity_assets` uses for a PDF, so
 * the two content types are read the same way.
 */
export const editorialEntryAssets = content.table(
  "editorial_entry_assets",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => editorialEntries.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    role: varchar("role", { length: 20 })
      .$type<"cover" | "inline" | "attachment">()
      .notNull(),
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
    authorId: uuid("author_id").references(() => users.id),
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
    // Named explicitly below, like every key on this table whose generated name
    // overruns 63 bytes (./schemas.ts).
    revisionId: uuid("revision_id").notNull(),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    title: varchar("title", { length: 200 }).notNull(),
    summary: text("summary"),
    bodyJson: jsonb("body_json"),
    plainText: text("plain_text"),
    state: translationState("state").notNull().default("draft"),
    method: translationMethod("method").notNull().default("human"),
    sourceVersionId: uuid("source_version_id"),
    /** SHA-256 of the canonical localized target payload. */
    contentHash: varchar("content_hash", { length: 64 }),
    providerCode: varchar("provider_code", { length: 100 }),
    providerJobReference: varchar("provider_job_reference", { length: 255 }),
    carriedForwardFromRevisionId: uuid("carried_forward_from_revision_id"),
    /**
     * The review chain this language is in the middle of. `state` says what the
     * text is; these say who has been asked to look at it and who has already
     * said yes. `verifiedById` / `verifiedAt` below are the platform stage's own
     * record — the last link in the chain, already in this table.
     */
    reviewStage: translationReviewStage("review_stage")
      .notNull()
      .default("none"),
    reviewRequestedById: uuid("review_requested_by_id"),
    reviewRequestedAt: timestamp("review_requested_at", { withTimezone: true }),
    teamValidatedById: uuid("team_validated_by_id"),
    teamValidatedAt: timestamp("team_validated_at", { withTimezone: true }),
    /** Why it came back, in the words of whoever sent it back. */
    reviewNote: text("review_note"),
    verifiedById: uuid("verified_by_id").references(() => users.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.revisionId, t.languageCode] }),
    foreignKey({
      name: "editorial_revision_translations_revision_id_fk",
      columns: [t.revisionId],
      foreignColumns: [editorialRevisions.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "editorial_revision_translations_source_version_id_fk",
      columns: [t.sourceVersionId],
      foreignColumns: [translationSourceVersions.id],
    }).onDelete("restrict"),
    // Shortened by hand: `{table}_carried_forward_from_revision_id_fk` is itself
    // 67 bytes, so the mechanical rule does not fit here either.
    foreignKey({
      name: "editorial_revision_translations_carried_forward_fk",
      columns: [t.carriedForwardFromRevisionId],
      foreignColumns: [editorialRevisions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "editorial_revision_translations_review_requested_by_id_fk",
      columns: [t.reviewRequestedById],
      foreignColumns: [users.id],
    }),
    foreignKey({
      name: "editorial_revision_translations_team_validated_by_id_fk",
      columns: [t.teamValidatedById],
      foreignColumns: [users.id],
    }),
  ],
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
    publishedById: uuid("published_by_id")
      .notNull()
      .references(() => users.id),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Null activates immediately; a future value delays public visibility. */
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    unpublishedById: uuid("unpublished_by_id").references(() => users.id),
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

/**
 * One tile or number in the basic-information block: the shortest route to
 * urgent or frequently needed help (docs/PHASE-1-PUBLIC-INFORMATION.md §5).
 *
 * The words are not here. A tile's label and the sentence saying when to use it
 * are authored, translated and reviewed like any other editorial text, in
 * `editorial_revision_translations` — `title` is the label, `summary` is the
 * context. That is the whole reason this kind exists: an emergency number whose
 * explanation is a hardcoded interface string cannot be corrected by the people
 * who answer the phone, and cannot carry a review date.
 *
 * What *is* here is the part a translator must never touch. `dial` holds the
 * digits exactly as they are dialled, and `dialInstead` says whether the number
 * printed on the tile is the one to press — Alarm Phone is a second step after
 * 112, so its own card dials 112 and names the association in the text.
 */
export const basicInformationDetails = content.table(
  "basic_information_details",
  {
    entryId: uuid("entry_id")
      .primaryKey()
      .references(() => editorialEntries.id, { onDelete: "cascade" }),
    icon: varchar("icon", { length: 50 }).notNull(),
    priority: integer("priority").notNull().default(0),
    /**
     * The one number for danger, drawn loudest. At most one tile carries it: a
     * second would mean neither is the loudest thing on the page. This is a
     * question about emphasis, *not* about which block the tile belongs to —
     * `operator` answers that.
     */
    emergency: boolean("emergency").notNull().default(false),
    /**
     * Whose phone rings — the country's service, or an association. It is what
     * splits the public page's two blocks, and it is recorded rather than
     * inferred; see the enum in `./schemas` for why `answered_by_organization_id`
     * cannot stand in for it.
     */
    operator: basicInformationOperator("operator").notNull().default("state"),
    categoryId: uuid("category_id").references(() => serviceCategories.id),
    /**
     * The digits, spaced as whoever published them prints them, or null for a
     * tile that opens a page instead of placing a call. Never reformatted:
     * regrouping digits nobody can verify is how a transcription error enters a
     * number that is dialled from a sinking boat.
     */
    dial: varchar("dial", { length: 40 }),
    /**
     * How to reach it. `voice` is a call, `sms` is written to — 114 is texted,
     * not called — and `whatsapp` marks the line that is also reachable there,
     * which on a data-only phone is often the only route.
     */
    reach: basicInformationReach("reach"),
    /**
     * The number this tile actually presses, when that is not the number it is
     * about. Null means press `dial`.
     *
     * Sea rescue is why this column exists. The guide's instruction is to call
     * 112 and ask for the coastguard, and to try the association line only if
     * that fails — so the tile dials 112 while its text names the association.
     * Leading with a volunteer phone would put it between a sinking boat and the
     * service that can launch to it.
     */
    dialInstead: varchar("dial_instead", { length: 40 }),
    /**
     * Whose number it is, for a line that belongs to a named association rather
     * than to the country. Null is a state number: 112 is 112 until France
     * changes it, and no association owns it.
     *
     * This is not custody — `editorial_custodianships` says who maintains the
     * record. This says whose phone rings, which is what a reader needs in order
     * to judge who they are about to speak to.
     */
    // Named explicitly below: the generated name overruns 63 bytes
    // (./schemas.ts).
    answeredByOrganizationId: uuid("answered_by_organization_id"),
  },
  (t) => [
    foreignKey({
      name: "basic_information_details_answered_by_organization_id_fk",
      columns: [t.answeredByOrganizationId],
      foreignColumns: [organizations.id],
    }),
    /**
     * A tile that says how to reach a number has to have one, and a tile that
     * redirects the call has to be reachable — a `dial_instead` with nothing to
     * dial is a card that looks like a phone number and presses nothing.
     */
    check(
      "basic_information_details_dial_check",
      sql`(${t.dial} is null) = (${t.reach} is null) and (${t.dialInstead} is null or ${t.dial} is not null)`,
    ),
  ],
);

/**
 * One active administrative custodian per entry (PRODUCT.md §14.5):
 * an organisation or the platform (`organizationId` null). Custody never
 * rewrites historical factual ownership. A handover is proposed in
 * `editorial_custody_transfer_requests` and recorded in
 * `editorial_custody_transfer_events` (FR-P2-019/020); this table holds only the
 * outcome — the current custodian, and the chain of who held it before.
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
    actorUserId: uuid("actor_user_id").references(() => users.id),
  },
  (t) => [
    uniqueIndex("editorial_custodianships_active_uq")
      .on(t.entryId)
      .where(sql`${t.endedAt} is null`),
  ],
);

/**
 * A proposed handover of an entry's custody, waiting on the destination
 * (FR-P2-019/020). The same shape as `content.activity_claim_requests`, because
 * the safety properties are the same: nothing moves until the receiving side
 * accepts, and the link that lets them accept is single-use and expires.
 *
 * Only the hash of the token is stored. A transfer link is a capability — anyone
 * holding it can take over an article — so the database keeps something that can
 * check a presented token and cannot produce one.
 *
 * Kept apart from the claim requests it mirrors rather than generalised into one
 * polymorphic table: a claim is a stranger asking for something unowned, a
 * transfer is one custodian handing to another, and the two are decided by
 * different people under different rules. One table would need a discriminator
 * on every query and a nullable column for each side's specifics.
 */
export const editorialCustodyTransferRequests = content.table(
  "editorial_custody_transfer_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id").notNull(),
    /** Where custody would go: an organisation, or back to the platform. */
    destinationKind: custodianKind("destination_kind").notNull(),
    destinationOrganizationId: uuid("destination_organization_id"),
    /** Who held it when the offer was made — null when the platform did. */
    previousOrganizationId: uuid("previous_organization_id"),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    state: custodyTransferState("state").notNull().default("pending"),
    /** Why the current custodian is handing it over — read by the recipient. */
    reason: text("reason"),
    requestedById: uuid("requested_by_id").references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    decidedById: uuid("decided_by_id").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // Every foreign key here is named explicitly: the generated name for a table
    // this long runs past Postgres's 63-character identifier limit, gets
    // truncated on creation, and then never matches the schema again — so
    // `db:push` drops and recreates the constraint on every single run.
    foreignKey({
      name: "editorial_custody_transfer_requests_entry_fk",
      columns: [t.entryId],
      foreignColumns: [editorialEntries.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "editorial_custody_transfer_requests_dest_org_fk",
      columns: [t.destinationOrganizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "editorial_custody_transfer_requests_prev_org_fk",
      columns: [t.previousOrganizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    check(
      "editorial_custody_transfer_requests_token_hash_check",
      sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "editorial_custody_transfer_requests_expiry_check",
      sql`${t.expiresAt} > ${t.createdAt}`,
    ),
    // The destination has to be nameable: an organisation transfer names one,
    // and a transfer back to the platform must not name one, or "who holds this
    // now?" would have two answers after it is accepted.
    check(
      "editorial_custody_transfer_requests_destination_check",
      sql`(${t.destinationKind} = 'organization' and ${t.destinationOrganizationId} is not null) or (${t.destinationKind} = 'platform' and ${t.destinationOrganizationId} is null)`,
    ),
    // Handing an entry to whoever already holds it is a no-op that would still
    // send a link and still be acceptable.
    check(
      "editorial_custody_transfer_requests_movement_check",
      sql`${t.destinationOrganizationId} is null or ${t.previousOrganizationId} is null or ${t.destinationOrganizationId} <> ${t.previousOrganizationId}`,
    ),
    check(
      "editorial_custody_transfer_requests_decision_check",
      sql`(${t.state} in ('accepted', 'declined') and ${t.decidedAt} is not null and ${t.decidedById} is not null) or (${t.state} in ('pending', 'expired', 'cancelled'))`,
    ),
    // One live offer per entry, not per entry-and-destination: offering the same
    // article to two organisations at once is a race over who clicks first.
    uniqueIndex("editorial_custody_transfer_requests_active_uq")
      .on(t.entryId)
      .where(sql`${t.state} = 'pending'`),
    // The expiry sweep reads exactly this.
    index("editorial_custody_transfer_requests_expiry_idx").on(
      t.state,
      t.expiresAt,
    ),
  ],
);

/**
 * Immutable history of custody decisions on an entry (FR-P2-020).
 *
 * Kept alongside the global audit trail rather than instead of it: `audit.events`
 * records that a security-relevant action happened and by whom, and these rows
 * keep the domain answer — which organisation held this article between which
 * dates, and what the person handing it over said. Rows are inserted and never
 * updated or deleted; Stage 0 revokes `UPDATE` and `DELETE` on this table and
 * adds the trigger that refuses them.
 */
export const editorialCustodyTransferEvents = content.table(
  "editorial_custody_transfer_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id").notNull(),
    /** Null for a custody change made directly, without an offer. */
    transferRequestId: uuid("transfer_request_id"),
    /** `requested`, `accepted`, `declined`, `expired`, `cancelled`, `revoked`. */
    action: varchar("action", { length: 80 }).notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    previousOrganizationId: uuid("previous_organization_id"),
    newOrganizationId: uuid("new_organization_id"),
    /** A safe note about the decision — never contact data or document content. */
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "editorial_custody_transfer_events_entry_fk",
      columns: [t.entryId],
      foreignColumns: [editorialEntries.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "editorial_custody_transfer_events_request_fk",
      columns: [t.transferRequestId],
      foreignColumns: [editorialCustodyTransferRequests.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "editorial_custody_transfer_events_prev_org_fk",
      columns: [t.previousOrganizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "editorial_custody_transfer_events_new_org_fk",
      columns: [t.newOrganizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    index("editorial_custody_transfer_events_entry_time_idx").on(
      t.entryId,
      t.occurredAt,
    ),
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
    // Named explicitly: the generated name overruns 63 bytes (./schemas.ts).
    revisionId: uuid("revision_id").notNull(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    role: varchar("role", { length: 50 }),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.revisionId, t.sourceId] }),
    foreignKey({
      name: "editorial_revision_sources_revision_id_fk",
      columns: [t.revisionId],
      foreignColumns: [editorialRevisions.id],
    }).onDelete("cascade"),
  ],
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
    // Both named explicitly: the generated names overrun 63 bytes
    // (./schemas.ts).
    revisionId: uuid("revision_id").notNull(),
    organizationId: uuid("organization_id").notNull(),
    role: attributionRole("role").notNull().default("factual_owner"),
    approvedByName: varchar("approved_by_name", { length: 200 }),
    approvedVia: varchar("approved_via", { length: 100 }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    evidenceNote: text("evidence_note"),
  },
  (t) => [
    primaryKey({ columns: [t.revisionId, t.organizationId] }),
    foreignKey({
      name: "editorial_revision_organizations_revision_id_fk",
      columns: [t.revisionId],
      foreignColumns: [editorialRevisions.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "editorial_revision_organizations_organization_id_fk",
      columns: [t.organizationId],
      foreignColumns: [organizations.id],
    }),
  ],
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
    // Named explicitly: the generated name overruns 63 bytes (./schemas.ts).
    relatedEntryId: uuid("related_entry_id").notNull(),
    relationKind: varchar("relation_kind", { length: 50 }),
  },
  (t) => [
    primaryKey({ columns: [t.entryId, t.relatedEntryId] }),
    foreignKey({
      name: "editorial_related_entries_related_entry_id_fk",
      columns: [t.relatedEntryId],
      foreignColumns: [editorialEntries.id],
    }).onDelete("cascade"),
  ],
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
    // Both named explicitly: the generated names overrun 63 bytes
    // (./schemas.ts).
    entryId: uuid("entry_id").notNull(),
    organizationId: uuid("organization_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.entryId, t.organizationId] }),
    foreignKey({
      name: "editorial_related_organizations_entry_id_fk",
      columns: [t.entryId],
      foreignColumns: [editorialEntries.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "editorial_related_organizations_organization_id_fk",
      columns: [t.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
  ],
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
  assigneeId: uuid("assignee_id").references(() => users.id),
  dueAt: timestamp("due_at", { withTimezone: true }),
  status: reviewTaskStatus("status").notNull().default("open"),
  resolutionNote: text("resolution_note"),
  ...timestamps,
});
