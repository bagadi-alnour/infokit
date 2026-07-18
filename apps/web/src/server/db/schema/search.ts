import {
  boolean,
  index,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { languages } from "./catalog";
import { content, timestamps } from "./schemas";
import { services } from "./services";
import { serviceCategories } from "./taxonomies";

/**
 * Stable need/topic concepts — breakfast, shoes, tents, SIM cards, calling
 * family… (FR-P1-031, PRODUCT.md §23). Slice 0/1 uses them for need-based
 * browsing; the typo-tolerant autocomplete read model is built at its
 * evidence trigger (PRODUCT.md §8.1) on top of these same rows.
 */
export const searchConcepts = content.table("search_concepts", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  categoryId: uuid("category_id").references(() => serviceCategories.id),
  enabled: boolean("enabled").notNull().default(true),
  ...timestamps,
});

export const searchConceptTranslations = content.table(
  "search_concept_translations",
  {
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => searchConcepts.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    label: varchar("label", { length: 100 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.conceptId, t.languageCode] })],
);

/** Language-specific synonyms, spellings, and typo aliases. */
export const searchConceptAliases = content.table(
  "search_concept_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => searchConcepts.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    alias: varchar("alias", { length: 100 }).notNull(),
    normalizedAlias: varchar("normalized_alias", { length: 100 }).notNull(),
  },
  (t) => [
    index("search_concept_aliases_normalized_idx").on(
      t.languageCode,
      t.normalizedAlias,
    ),
  ],
);

/** Verified need concepts satisfied by a service. */
export const serviceSearchConcepts = content.table(
  "service_search_concepts",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => searchConcepts.id, { onDelete: "cascade" }),
    verifiedById: varchar("verified_by_id", { length: 255 }).references(
      () => users.id,
    ),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.serviceId, t.conceptId] })],
);
