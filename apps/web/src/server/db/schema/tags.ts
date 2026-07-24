import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  integer,
  primaryKey,
  text,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { languages } from "./catalog";
import { organizations } from "./organizations";
import { core, timestamps } from "./schemas";

/** Reusable global or organisation-owned labels. Tags never grant access. */
export const tags = core.table(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    scopeKey: text("scope_key").generatedAlwaysAs(
      sql`coalesce(organization_id::text, 'platform')`,
    ),
    namespace: varchar("namespace", { length: 60 }).notNull().default("topic"),
    code: varchar("code", { length: 100 }).notNull(),
    colorToken: varchar("color_token", { length: 60 })
      .notNull()
      .default("neutral"),
    visibility: varchar("visibility", { length: 20 })
      .$type<"public" | "workspace">()
      .notNull()
      .default("public"),
    displayOrder: integer("display_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    unique("tags_id_scope_key_uq").on(t.id, t.scopeKey),
    uniqueIndex("tags_scope_namespace_code_uq").on(
      sql`coalesce(${t.organizationId}::text, '')`,
      t.namespace,
      t.code,
    ),
  ],
);

export const tagTranslations = core.table(
  "tag_translations",
  {
    tagId: uuid("tag_id").notNull(),
    scopeKey: text("scope_key").notNull().default("platform"),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    label: varchar("label", { length: 120 }).notNull(),
    description: text("description"),
  },
  (t) => [
    primaryKey({ columns: [t.tagId, t.languageCode] }),
    foreignKey({
      columns: [t.tagId, t.scopeKey],
      foreignColumns: [tags.id, tags.scopeKey],
      name: "tag_translations_tag_scope_fk",
    }).onDelete("cascade"),
    uniqueIndex("tag_translations_scope_language_label_uq").on(
      t.scopeKey,
      t.languageCode,
      sql`lower(regexp_replace(btrim(${t.label}), '[[:space:]]+', ' ', 'g'))`,
    ),
  ],
);
