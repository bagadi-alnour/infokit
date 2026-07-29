import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { cities, languages } from "./catalog";
import { organizations } from "./organizations";
import { places } from "./places";
import {
  archival,
  content,
  occurrenceState,
  serviceManualStatus,
  timestamps,
  translationMethod,
  translationState,
  verification,
} from "./schemas";
import { services } from "./services";
import { audienceCategories, serviceCategories } from "./taxonomies";
import { translationSourceVersions } from "./translation-sources";

/**
 * Public events — dated or recurring public activity such as a temporary
 * distribution (FR-P1-007). Separate from services and, later, strictly
 * separate from private operational events (PRODUCT.md §23).
 */
export const publicEvents = content.table(
  "public_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    placeId: uuid("place_id").references(() => places.id),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => serviceCategories.id),
    audienceCategoryId: uuid("audience_category_id")
      .notNull()
      .references(() => audienceCategories.id),
    sourceLanguageCode: varchar("source_language_code", { length: 35 })
      .notNull()
      .default("fr")
      .references(() => languages.code),
    minAge: smallint("min_age"),
    maxAge: smallint("max_age"),
    manualStatus: serviceManualStatus("manual_status")
      .notNull()
      .default("normal"),
    published: boolean("published").notNull().default(false),
    verifiedById: uuid("verified_by_id").references(() => users.id),
    sourceNote: text("source_note"),
    ...verification,
    ...archival,
    ...timestamps,
  },
  (t) => [index("public_events_city_idx").on(t.cityId)],
);

export const publicEventProviders = content.table(
  "public_event_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => publicEvents.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    displayOrder: integer("display_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("public_event_providers_event_org_uq").on(
      t.eventId,
      t.organizationId,
    ),
  ],
);

export const publicEventTranslations = content.table(
  "public_event_translations",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => publicEvents.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    name: varchar("name", { length: 150 }).notNull(),
    description: text("description"),
    instructions: text("instructions"),
    cancellationNote: text("cancellation_note"),
    state: translationState("state").notNull().default("draft"),
    method: translationMethod("method").notNull().default("human"),
    sourceVersionId: uuid("source_version_id"),
    contentHash: varchar("content_hash", { length: 64 }),
    providerCode: varchar("provider_code", { length: 100 }),
    providerJobReference: varchar("provider_job_reference", { length: 255 }),
    carriedForwardFromSourceVersionId: uuid(
      "carried_forward_from_source_version_id",
    ),
    verifiedById: uuid("verified_by_id").references(() => users.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.languageCode] }),
    foreignKey({
      name: "public_event_translations_source_scope_fk",
      columns: [t.sourceVersionId],
      foreignColumns: [translationSourceVersions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "public_event_translations_carried_source_scope_fk",
      columns: [t.carriedForwardFromSourceVersionId],
      foreignColumns: [translationSourceVersions.id],
    }).onDelete("restrict"),
  ],
);

/** Locale activation for one verified public-event translation. */
export const publicEventPublications = content.table(
  "public_event_publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => publicEvents.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    sourceVersionId: uuid("source_version_id").notNull(),
    translationContentHash: varchar("translation_content_hash", {
      length: 64,
    }).notNull(),
    publishedById: uuid("published_by_id")
      .notNull()
      .references(() => users.id),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    unpublishedById: uuid("unpublished_by_id").references(() => users.id),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: "public_event_publications_source_scope_fk",
      columns: [t.sourceVersionId],
      foreignColumns: [translationSourceVersions.id],
    }).onDelete("restrict"),
    check(
      "public_event_publications_content_hash_check",
      sql`${t.translationContentHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "public_event_publications_unpublish_check",
      sql`(${t.unpublishedAt} is null and ${t.unpublishedById} is null) or (${t.unpublishedAt} >= ${t.publishedAt} and ${t.unpublishedById} is not null)`,
    ),
    uniqueIndex("public_event_publications_active_uq")
      .on(t.eventId, t.languageCode)
      .where(sql`${t.unpublishedAt} is null`),
  ],
);

export const publicEventAudienceTranslations = content.table(
  "public_event_audience_translations",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => publicEvents.id, { onDelete: "cascade" }),
    // Named explicitly: the generated name overruns 63 bytes (./schemas.ts).
    languageCode: varchar("language_code", { length: 35 }).notNull(),
    eligibilityDetails: text("eligibility_details").notNull(),
    state: translationState("state").notNull().default("draft"),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.languageCode] }),
    foreignKey({
      columns: [t.languageCode],
      foreignColumns: [languages.code],
      name: "public_event_audience_translations_language_code_fk",
    }),
  ],
);

/** Recurrence definition; occurrences are materialized ahead of time. */
export const publicEventSeries = content.table("public_event_series", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => publicEvents.id, { onDelete: "cascade" }),
  timezone: varchar("timezone", { length: 50 })
    .notNull()
    .default("Europe/Paris"),
  rrule: text("rrule"),
  localStartTime: time("local_start_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  startsOn: timestamp("starts_on", { withTimezone: true }).notNull(),
  endsOn: timestamp("ends_on", { withTimezone: true }),
  ...timestamps,
});

/**
 * Concrete occurrences (docs/DATABASE-SCHEMA.md §7): public "open now"
 * queries never interpret recurrence rules at request time.
 */
export const publicEventOccurrences = content.table(
  "public_event_occurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => publicEvents.id, { onDelete: "cascade" }),
    seriesId: uuid("series_id").references(() => publicEventSeries.id, {
      onDelete: "set null",
    }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    state: occurrenceState("state").notNull().default("scheduled"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("public_event_occurrences_event_start_uq").on(
      t.eventId,
      t.startsAt,
    ),
    index("public_event_occurrences_starts_idx").on(t.startsAt),
  ],
);

/** Public reason for a changed/cancelled occurrence, per language. */
export const publicEventOccurrenceTranslations = content.table(
  "public_event_occurrence_translations",
  {
    // All three named explicitly: the generated names overrun 63 bytes
    // (./schemas.ts).
    occurrenceId: uuid("occurrence_id").notNull(),
    languageCode: varchar("language_code", { length: 35 }).notNull(),
    publicReason: text("public_reason").notNull(),
    state: translationState("state").notNull().default("draft"),
  },
  (t) => [
    primaryKey({
      columns: [t.occurrenceId, t.languageCode],
      name: "public_event_occurrence_translations_pk",
    }),
    foreignKey({
      columns: [t.occurrenceId],
      foreignColumns: [publicEventOccurrences.id],
      name: "public_event_occurrence_translations_occurrence_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.languageCode],
      foreignColumns: [languages.code],
      name: "public_event_occurrence_translations_language_code_fk",
    }),
  ],
);

/** Services available during the event. */
export const publicEventServices = content.table(
  "public_event_services",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => publicEvents.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.serviceId] })],
);
