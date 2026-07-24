import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  primaryKey,
  text,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { languages } from "./catalog";
import { organizations } from "./organizations";
import {
  archival,
  content,
  timestamps,
  translationMethod,
  translationState,
} from "./schemas";
import { serviceCategories } from "./taxonomies";

/**
 * Reusable service capability, such as shower, tea, laundry, drinking water,
 * or phone charging. Activities own schedules/status/freshness and attach
 * capabilities through the many-to-many `activity_services` table.
 */
export const services = content.table(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    scopeKey: text("scope_key").generatedAlwaysAs(
      sql`coalesce(organization_id::text, 'platform')`,
    ),
    code: varchar("code", { length: 100 }),
    icon: varchar("icon", { length: 50 }).notNull().default("help"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => serviceCategories.id),
    active: boolean("active").notNull().default(true),
    sourceNote: text("source_note"),
    ...archival,
    ...timestamps,
  },
  (t) => [
    unique("services_id_scope_key_uq").on(t.id, t.scopeKey),
    uniqueIndex("services_scope_code_uq")
      .on(sql`coalesce(${t.organizationId}::text, '')`, t.code)
      .where(sql`${t.code} is not null`),
  ],
);

export const serviceTranslations = content.table(
  "service_translations",
  {
    serviceId: uuid("service_id").notNull(),
    scopeKey: text("scope_key").notNull().default("platform"),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    name: varchar("name", { length: 150 }).notNull(),
    description: text("description"),
    state: translationState("state").notNull().default("draft"),
    method: translationMethod("method").notNull().default("human"),
  },
  (t) => [
    primaryKey({ columns: [t.serviceId, t.languageCode] }),
    foreignKey({
      columns: [t.serviceId, t.scopeKey],
      foreignColumns: [services.id, services.scopeKey],
      name: "service_translations_service_scope_fk",
    }).onDelete("cascade"),
    uniqueIndex("service_translations_scope_language_name_uq").on(
      t.scopeKey,
      t.languageCode,
      sql`lower(regexp_replace(btrim(${t.name}), '[[:space:]]+', ' ', 'g'))`,
    ),
  ],
);
