import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
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
  content,
  holidayBehavior,
  scheduleExceptionKind,
  serviceManualStatus,
  timestamps,
  translationMethod,
  translationState,
} from "./schemas";
import { audienceCategories, serviceCategories } from "./taxonomies";

/**
 * Stable service identity (docs/DATABASE-SCHEMA.md §7). Distinct
 * distributions stay distinct records (PRODUCT.md §23): breakfast, lunch,
 * tea/coffee, shower, shoes, tents… each with its own schedule and status.
 * open/closed is derived from schedules + exceptions; `manualStatus` carries
 * cancelled/uncertain overrides. `sourceNote` records where unverified seed
 * information came from ("show, don't survey" — PRODUCT.md §8.1).
 */
export const services = content.table(
  "services",
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
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    verifiedById: varchar("verified_by_id", { length: 255 }).references(
      () => users.id,
    ),
    reviewDueAt: timestamp("review_due_at", { withTimezone: true }),
    sourceNote: text("source_note"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("services_city_idx").on(t.cityId),
    index("services_category_idx").on(t.categoryId),
    index("services_published_idx").on(t.published),
  ],
);

/**
 * One or more providing organisations per service (FR-P1-033); every
 * published service needs at least one — enforced at the publish gate,
 * asserted again by the public read model.
 */
export const serviceProviders = content.table(
  "service_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    displayOrder: integer("display_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("service_providers_service_org_uq").on(
      t.serviceId,
      t.organizationId,
    ),
  ],
);

export const serviceTranslations = content.table(
  "service_translations",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    name: varchar("name", { length: 150 }).notNull(),
    shortDescription: text("short_description"),
    instructions: text("instructions"),
    cancellationNote: text("cancellation_note"),
    state: translationState("state").notNull().default("draft"),
    method: translationMethod("method").notNull().default("human"),
  },
  (t) => [primaryKey({ columns: [t.serviceId, t.languageCode] })],
);

/** Provider-supplied eligibility wording for the audience label (FR-P1-032). */
export const serviceAudienceTranslations = content.table(
  "service_audience_translations",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    eligibilityDetails: text("eligibility_details").notNull(),
    state: translationState("state").notNull().default("draft"),
  },
  (t) => [primaryKey({ columns: [t.serviceId, t.languageCode] })],
);

/** Weekly recurring hours; weekday is ISO (1 = Monday … 7 = Sunday). */
export const scheduleRules = content.table(
  "schedule_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    endsNextDay: boolean("ends_next_day").notNull().default(false),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    holidayBehavior: holidayBehavior("holiday_behavior")
      .notNull()
      .default("closed"),
    ...timestamps,
  },
  (t) => [
    index("schedule_rules_service_idx").on(t.serviceId),
    check("schedule_rules_weekday_range", sql`${t.weekday} between 1 and 7`),
    check(
      "schedule_rules_time_order",
      sql`${t.endsNextDay} or ${t.startTime} < ${t.endTime}`,
    ),
  ],
);

/** Closures, cancellations, exceptional openings, uncertainty — per date. */
export const scheduleExceptions = content.table(
  "schedule_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    kind: scheduleExceptionKind("kind").notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    createdById: varchar("created_by_id", { length: 255 }).references(
      () => users.id,
    ),
    ...timestamps,
  },
  (t) => [
    index("schedule_exceptions_service_date_idx").on(t.serviceId, t.date),
  ],
);

export const scheduleExceptionTranslations = content.table(
  "schedule_exception_translations",
  {
    exceptionId: uuid("exception_id")
      .notNull()
      .references(() => scheduleExceptions.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    publicReason: text("public_reason").notNull(),
    state: translationState("state").notNull().default("draft"),
  },
  (t) => [primaryKey({ columns: [t.exceptionId, t.languageCode] })],
);
