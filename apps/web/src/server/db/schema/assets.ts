import {
  bigint,
  boolean,
  integer,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { languages } from "./catalog";
import { organizations } from "./organizations";
import {
  archival,
  assetVariantKind,
  assetVisibility,
  content,
  malwareScanState,
  mediaKind,
  textTrackKind,
  timestamps,
  translationState,
  verification,
} from "./schemas";

/**
 * Uploaded files (docs/DATABASE-SCHEMA.md §9). Binaries live in object
 * storage; storage keys are opaque. Publication requires rights
 * confirmation and a clean malware scan (NFR-012, FR-P1-034).
 */
export const assets = content.table("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  uploaderId: varchar("uploader_id", { length: 255 }).references(
    () => users.id,
  ),
  organizationId: uuid("organization_id").references(() => organizations.id),
  languageCode: varchar("language_code", { length: 35 }).references(
    () => languages.code,
  ),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  byteSize: bigint("byte_size", { mode: "number" }).notNull(),
  durationSeconds: integer("duration_seconds"),
  sha256: varchar("sha256", { length: 64 }),
  kind: mediaKind("kind").notNull(),
  visibility: assetVisibility("visibility").notNull().default("workspace"),
  scanState: malwareScanState("scan_state").notNull().default("pending"),
  rightsConfirmed: boolean("rights_confirmed").notNull().default(false),
  ...archival,
  ...timestamps,
});

/** Poster, thumbnail, low-bandwidth renditions (FR-P1-016/034). */
export const assetVariants = content.table(
  "asset_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    kind: assetVariantKind("kind").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    durationSeconds: integer("duration_seconds"),
    sha256: varchar("sha256", { length: 64 }),
    ...timestamps,
  },
  (t) => [uniqueIndex("asset_variants_asset_kind_uq").on(t.assetId, t.kind)],
);

/** Localized title/description/alt text; images need alt or decorative role. */
export const assetTranslations = content.table(
  "asset_translations",
  {
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    title: varchar("title", { length: 200 }),
    description: text("description"),
    altText: text("alt_text"),
    decorative: boolean("decorative").notNull().default(false),
    state: translationState("state").notNull().default("draft"),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.languageCode] })],
);

/** Reviewed transcripts, captions, subtitles, equivalent descriptions. */
export const assetTextTracks = content.table(
  "asset_text_tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    kind: textTrackKind("kind").notNull(),
    body: text("body"),
    storageKey: text("storage_key"),
    state: translationState("state").notNull().default("draft"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("asset_text_tracks_asset_lang_kind_uq").on(
      t.assetId,
      t.languageCode,
      t.kind,
    ),
  ],
);

/** Public downloadable-file records (FR-P1-014, screen P1-13). */
export const downloads = content.table("downloads", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  published: boolean("published").notNull().default(false),
  ...verification,
  ...archival,
  ...timestamps,
});

export const downloadTranslations = content.table(
  "download_translations",
  {
    downloadId: uuid("download_id")
      .notNull()
      .references(() => downloads.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    state: translationState("state").notNull().default("draft"),
  },
  (t) => [primaryKey({ columns: [t.downloadId, t.languageCode] })],
);
