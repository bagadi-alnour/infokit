import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { assets } from "./assets";
import { users } from "./auth";
import { cities, languages } from "./catalog";
import { organizations } from "./organizations";
import { places } from "./places";
import {
  archival,
  coordinationEventStatus,
  coordinationEventVisibility,
  operations,
  stewardContact,
  timestamps,
} from "./schemas";

/**
 * The shared coordination agenda (docs/DATABASE-SCHEMA.md §13, FR-P2-023):
 * one meeting or event hosted by an organisation — or by the platform when
 * `hostOrganizationId` is null — carrying a city and one explicit visibility
 * tier. `visibility` is the whole access story for the record: `organization`
 * stays inside the host, `inter_organization` reaches authenticated members of
 * verified organisations, and `public` is the host's deliberate decision to
 * show the event to visitors. Reads go through
 * `~/server/content/coordination-events`, never straight at this table.
 */
export const coordinationEvents = operations.table(
  "coordination_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostOrganizationId: uuid("host_organization_id").references(
      () => organizations.id,
    ),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id),
    visibility: coordinationEventVisibility("visibility")
      .notNull()
      .default("organization"),
    status: coordinationEventStatus("status").notNull().default("scheduled"),
    /** A known place record, when the event happens at one we publish. */
    placeId: uuid("place_id").references(() => places.id),
    /** Free-text meeting point for everything a place record does not cover. */
    locationLabel: varchar("location_label", { length: 200 }),
    /** One safe contact for the event — never a member's personal number. */
    contactLabel: varchar("contact_label", { length: 120 }),
    contactValue: varchar("contact_value", { length: 200 }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** A day-long event shows a date, not a time range. */
    allDay: boolean("all_day").notNull().default(false),
    sourceLanguageCode: varchar("source_language_code", { length: 35 })
      .notNull()
      .default("fr")
      .references(() => languages.code),
    createdById: varchar("created_by_id", { length: 255 }).references(
      () => users.id,
    ),
    ...stewardContact,
    ...archival,
    ...timestamps,
  },
  (t) => [
    check("coordination_events_range_check", sql`${t.endsAt} >= ${t.startsAt}`),
    // The agenda is always read as "this city, this window".
    index("coordination_events_city_starts_idx").on(t.cityId, t.startsAt),
    index("coordination_events_host_starts_idx").on(
      t.hostOrganizationId,
      t.startsAt,
    ),
    // The public surface asks only for the public tier.
    index("coordination_events_visibility_starts_idx").on(
      t.visibility,
      t.startsAt,
    ),
  ],
);

/**
 * Authored text per language, the same lightweight pattern as
 * `content.place_translations`: the source language is required and the others
 * are filled in as they are written. A public-tier event without a reader's
 * language falls back to the source rather than blanking.
 */
export const coordinationEventTranslations = operations.table(
  "coordination_event_translations",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => coordinationEvents.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description"),
    /** Why a cancelled event was cancelled — shown wherever it is shown. */
    cancellationReason: text("cancellation_reason"),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.eventId, t.languageCode] })],
);

/**
 * The event's own media: one `cover` image and any number of `flyer` documents
 * people can download and print. Files live in `content.assets` like every
 * other upload, so rights confirmation and the safety scan are the same gate
 * here as everywhere else (docs/DATABASE-SCHEMA.md §9).
 *
 * Nothing about publication is stored on this row: whether a reader may fetch
 * the file is answered by the event's `visibility`, exactly as for the event's
 * own text. A flyer of an `organization`-tier event is therefore workspace-only
 * without anyone having to remember to say so.
 */
export const coordinationEventAssets = operations.table(
  "coordination_event_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => coordinationEvents.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    /** `cover` for the image, `flyer` for a downloadable document. */
    role: varchar("role", { length: 50 }).notNull(),
    /** The language the file itself is in — a flyer is printed in one. */
    languageCode: varchar("language_code", { length: 35 }).references(
      () => languages.code,
    ),
    displayOrder: integer("display_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    unique("coordination_event_assets_event_asset_role_uq").on(
      t.eventId,
      t.assetId,
      t.role,
    ),
    index("coordination_event_assets_event_role_idx").on(t.eventId, t.role),
  ],
);
