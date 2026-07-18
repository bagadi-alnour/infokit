import {
  boolean,
  integer,
  primaryKey,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { languages } from "./catalog";
import { content, timestamps, translationState } from "./schemas";

/**
 * Controlled taxonomies as rows, not enums (docs/DATABASE-SCHEMA.md §2):
 * they evolve by insert, not by migration. Seeded from the field-confirmed
 * launch service types (PRODUCT.md §23).
 */
export const serviceCategories = content.table("service_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  icon: varchar("icon", { length: 50 }).notNull(),
  colorToken: varchar("color_token", { length: 50 }),
  enabled: boolean("enabled").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  ...timestamps,
});

export const serviceCategoryTranslations = content.table(
  "service_category_translations",
  {
    categoryId: uuid("category_id")
      .notNull()
      .references(() => serviceCategories.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    label: varchar("label", { length: 100 }).notNull(),
    description: text("description"),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.languageCode] })],
);

/** Verified organisation specialities; icons always carry a text label. */
export const specialities = content.table("specialities", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  icon: varchar("icon", { length: 50 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  ...timestamps,
});

export const specialityTranslations = content.table(
  "speciality_translations",
  {
    specialityId: uuid("speciality_id")
      .notNull()
      .references(() => specialities.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    label: varchar("label", { length: 100 }).notNull(),
    description: text("description"),
  },
  (t) => [primaryKey({ columns: [t.specialityId, t.languageCode] })],
);

/**
 * The six confirmed audience codes (FR-P1-032) live as rows so later policy
 * can add categories without altering service tables.
 */
export const audienceCategories = content.table("audience_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  icon: varchar("icon", { length: 50 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  ...timestamps,
});

export const audienceCategoryTranslations = content.table(
  "audience_category_translations",
  {
    audienceCategoryId: uuid("audience_category_id")
      .notNull()
      .references(() => audienceCategories.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    label: varchar("label", { length: 100 }).notNull(),
    explanation: text("explanation"),
    state: translationState("state").notNull().default("draft"),
  },
  (t) => [primaryKey({ columns: [t.audienceCategoryId, t.languageCode] })],
);
