import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { cities, languages } from "./catalog";
import { editorialEntries, sources } from "./editorial";
import { contacts, organizations } from "./organizations";
import {
  archival,
  flowVersionStatus,
  simulator,
  simulatorNodeKind,
  stewardContact,
  timestamps,
  translationState,
} from "./schemas";
import { services } from "./services";

/**
 * The simulator is an immutable, versioned directed graph
 * (docs/DATABASE-SCHEMA.md §10). There is intentionally NO answers,
 * sessions, or people table — answers stay on the device (FR-P1-020,
 * FR-P1-038), and nothing here may ever log them.
 */
export const flows = simulator.table("flows", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 150 }).notNull().unique(),
  internalName: varchar("internal_name", { length: 180 }).notNull(),
  ownerOrganizationId: uuid("owner_organization_id").references(
    () => organizations.id,
  ),
  cityId: uuid("city_id").references(() => cities.id),
  ...stewardContact,
  ...archival,
  ...timestamps,
});

/**
 * Immutable version envelope; draft editing happens on a new version.
 * `entryNodeKey` is validated against the version's nodes at publish time
 * (circular FK avoided by design, per the doc's publish checks).
 */
export const flowVersions = simulator.table(
  "flow_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flowId: uuid("flow_id")
      .notNull()
      .references(() => flows.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    entryNodeKey: varchar("entry_node_key", { length: 50 }),
    sourceLanguageCode: varchar("source_language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    status: flowVersionStatus("status").notNull().default("draft"),
    sourceSummary: text("source_summary"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    reviewDueAt: timestamp("review_due_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("flow_versions_flow_number_uq").on(t.flowId, t.versionNumber),
  ],
);

export const nodes = simulator.table(
  "nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => flowVersions.id, { onDelete: "cascade" }),
    nodeKey: varchar("node_key", { length: 50 }).notNull(),
    kind: simulatorNodeKind("kind").notNull(),
    optional: boolean("optional").notNull().default(true),
    positionX: doublePrecision("position_x").notNull().default(0),
    positionY: doublePrecision("position_y").notNull().default(0),
  },
  (t) => [uniqueIndex("nodes_version_key_uq").on(t.versionId, t.nodeKey)],
);

export const nodeTranslations = simulator.table(
  "node_translations",
  {
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    prompt: text("prompt"),
    explanation: text("explanation"),
    resultBody: text("result_body"),
    disclaimer: text("disclaimer"),
    state: translationState("state").notNull().default("draft"),
  },
  (t) => [primaryKey({ columns: [t.nodeId, t.languageCode] })],
);

export const options = simulator.table(
  "options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    optionKey: varchar("option_key", { length: 50 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    preferNotToSay: boolean("prefer_not_to_say").notNull().default(false),
  },
  (t) => [uniqueIndex("options_node_key_uq").on(t.nodeId, t.optionKey)],
);

export const optionTranslations = simulator.table(
  "option_translations",
  {
    optionId: uuid("option_id")
      .notNull()
      .references(() => options.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    label: varchar("label", { length: 200 }).notNull(),
    help: text("help"),
    state: translationState("state").notNull().default("draft"),
  },
  (t) => [primaryKey({ columns: [t.optionId, t.languageCode] })],
);

/** Allowed transitions; publish checks forbid cross-version edges. */
export const edges = simulator.table(
  "edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => flowVersions.id, { onDelete: "cascade" }),
    fromNodeId: uuid("from_node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    optionId: uuid("option_id").references(() => options.id, {
      onDelete: "cascade",
    }),
    toNodeId: uuid("to_node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull().default(0),
  },
  (t) => [
    uniqueIndex("edges_from_option_uq")
      .on(t.fromNodeId, t.optionId)
      .where(sql`${t.optionId} is not null`),
  ],
);

/* Reviewed result composition — everything a result shows is traceable. */

export const nodeSources = simulator.table(
  "node_sources",
  {
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
  },
  (t) => [primaryKey({ columns: [t.nodeId, t.sourceId] })],
);

export const resultEditorialEntries = simulator.table(
  "result_editorial_entries",
  {
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => editorialEntries.id, { onDelete: "cascade" }),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.nodeId, t.entryId] })],
);

export const resultServices = simulator.table(
  "result_services",
  {
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.nodeId, t.serviceId] })],
);

export const resultOrganizations = simulator.table(
  "result_organizations",
  {
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.nodeId, t.organizationId] })],
);

export const resultContacts = simulator.table(
  "result_contacts",
  {
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.nodeId, t.contactId] })],
);

/** Active published version per flow (partial unique on "still active"). */
export const versionPublications = simulator.table(
  "version_publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flowId: uuid("flow_id")
      .notNull()
      .references(() => flows.id, { onDelete: "cascade" }),
    versionId: uuid("version_id")
      .notNull()
      .references(() => flowVersions.id),
    publishedById: varchar("published_by_id", { length: 255 }).references(
      () => users.id,
    ),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("version_publications_active_uq")
      .on(t.flowId)
      .where(sql`${t.unpublishedAt} is null`),
  ],
);
