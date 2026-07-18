import {
  boolean,
  doublePrecision,
  integer,
  primaryKey,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { core, textDirection, timestamps } from "./schemas";

/**
 * Language catalogue (docs/DATABASE-SCHEMA.md §6). A language row existing
 * does not make it public: PRODUCT.md §17 — a language ships only when a
 * named person owns its review.
 */
export const languages = core.table("languages", {
  code: varchar("code", { length: 35 }).primaryKey(), // BCP 47
  nativeName: varchar("native_name", { length: 100 }).notNull(),
  englishName: varchar("english_name", { length: 100 }).notNull(),
  frenchName: varchar("french_name", { length: 100 }).notNull(),
  direction: textDirection("direction").notNull().default("ltr"),
  enabled: boolean("enabled").notNull().default(false),
  fallbackCode: varchar("fallback_code", { length: 35 }).references(
    (): AnyPgColumn => languages.code,
  ),
  publicSortOrder: integer("public_sort_order").notNull().default(0),
  ...timestamps,
});

/**
 * Cities are catalogue data (PRODUCT.md FR-P1-037): activating one surfaces
 * it in public filters and the simulator city question — a data change,
 * never a code change.
 */
export const cities = core.table("cities", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  timezone: varchar("timezone", { length: 50 })
    .notNull()
    .default("Europe/Paris"),
  active: boolean("active").notNull().default(false),
  ...timestamps,
});

export const cityTranslations = core.table(
  "city_translations",
  {
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    name: varchar("name", { length: 100 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.cityId, t.languageCode] })],
);

/** Ordered public areas of a city, used by the simulator location question. */
export const cityAreas = core.table(
  "city_areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 50 }).notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    ...timestamps,
  },
  (t) => [uniqueIndex("city_areas_city_code_uq").on(t.cityId, t.code)],
);

export const cityAreaTranslations = core.table(
  "city_area_translations",
  {
    cityAreaId: uuid("city_area_id")
      .notNull()
      .references(() => cityAreas.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    label: varchar("label", { length: 100 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.cityAreaId, t.languageCode] })],
);
