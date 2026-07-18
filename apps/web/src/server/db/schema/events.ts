import {
  boolean,
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
    minAge: smallint("min_age"),
    maxAge: smallint("max_age"),
    manualStatus: serviceManualStatus("manual_status")
      .notNull()
      .default("normal"),
    published: boolean("published").notNull().default(false),
    verifiedById: varchar("verified_by_id", { length: 255 }).references(
      () => users.id,
    ),
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
  },
  (t) => [primaryKey({ columns: [t.eventId, t.languageCode] })],
);

export const publicEventAudienceTranslations = content.table(
  "public_event_audience_translations",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => publicEvents.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    eligibilityDetails: text("eligibility_details").notNull(),
    state: translationState("state").notNull().default("draft"),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.languageCode] })],
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
    occurrenceId: uuid("occurrence_id")
      .notNull()
      .references(() => publicEventOccurrences.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    publicReason: text("public_reason").notNull(),
    state: translationState("state").notNull().default("draft"),
  },
  (t) => [primaryKey({ columns: [t.occurrenceId, t.languageCode] })],
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
