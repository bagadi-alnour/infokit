import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { languages } from "./catalog";
import { organizations } from "./organizations";
import {
  content,
  translationAssignmentEntity,
  translationImpact,
  translationJobState,
  translationMethod,
} from "./schemas";

/**
 * Immutable canonical translatable payload for one authored source version.
 *
 * Articles also store `sourceRevisionId`, which application services validate
 * against the typed editorial revision. Activities, public events, and
 * simulator flows use the immutable JSON/hash here to keep translation jobs
 * and external assignments pinned while typed authoring rows continue to
 * change.
 *
 * `organizationId` is null only for platform-custodied content. The generic
 * entity reference is the same documented typed exception used by
 * translation assignments; services validate its existence and tenant scope.
 */
export const translationSourceVersions = content.table(
  "translation_source_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "restrict",
    }),
    entityKind: translationAssignmentEntity("entity_kind").notNull(),
    entityId: uuid("entity_id").notNull(),
    version: integer("version").notNull(),
    // Both named explicitly: the generated names overrun 63 bytes
    // (./schemas.ts).
    previousVersionId: uuid("previous_version_id"),
    /** Populated for editorial entries; null for activities and public events. */
    sourceRevisionId: uuid("source_revision_id"),
    sourceLanguageCode: varchar("source_language_code", {
      length: 35,
    }).notNull(),
    sourceContentJson: jsonb("source_content_json").notNull(),
    /** Lowercase hexadecimal SHA-256 of canonical `sourceContentJson`. */
    sourceContentHash: varchar("source_content_hash", {
      length: 64,
    }).notNull(),
    impact: translationImpact("impact").notNull(),
    createdById: uuid("created_by_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.previousVersionId],
      foreignColumns: [t.id],
      name: "translation_source_versions_previous_version_id_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.sourceLanguageCode],
      foreignColumns: [languages.code],
      name: "translation_source_versions_source_language_code_fk",
    }),
    uniqueIndex("translation_source_versions_entity_version_uq").on(
      t.entityKind,
      t.entityId,
      t.version,
    ),
    index("translation_source_versions_entity_hash_idx").on(
      t.entityKind,
      t.entityId,
      t.sourceContentHash,
    ),
    uniqueIndex("translation_source_versions_editorial_revision_uq")
      .on(t.sourceRevisionId)
      .where(sql`${t.sourceRevisionId} is not null`),
    check(
      "translation_source_versions_positive_version_check",
      sql`${t.version} > 0`,
    ),
    check(
      "translation_source_versions_hash_check",
      sql`${t.sourceContentHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "translation_source_versions_initial_predecessor_check",
      sql`(${t.impact} = 'initial' and ${t.version} = 1 and ${t.previousVersionId} is null) or (${t.impact} <> 'initial' and ${t.version} > 1 and ${t.previousVersionId} is not null)`,
    ),
    check(
      "translation_source_versions_editorial_revision_check",
      sql`(${t.entityKind} = 'editorial_entry' and ${t.sourceRevisionId} is not null) or (${t.entityKind} <> 'editorial_entry' and ${t.sourceRevisionId} is null)`,
    ),
    index("translation_source_versions_org_idx").on(t.organizationId),
    index("translation_source_versions_entity_idx").on(
      t.entityKind,
      t.entityId,
    ),
  ],
);

/**
 * Provider-neutral asynchronous machine-translation request. Provider output
 * stays non-public; a successful worker may create/update a target translation
 * row as `machine_generated`, still tied to this source version and awaiting
 * review and locale publication.
 */
export const translationJobs = content.table(
  "translation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "restrict",
    }),
    sourceVersionId: uuid("source_version_id").notNull(),
    entityKind: translationAssignmentEntity("entity_kind").notNull(),
    entityId: uuid("entity_id").notNull(),
    targetLanguageCode: varchar("target_language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    method: translationMethod("method").notNull().default("ai"),
    providerCode: varchar("provider_code", { length: 100 }),
    providerModel: varchar("provider_model", { length: 150 }),
    providerJobReference: varchar("provider_job_reference", { length: 255 }),
    state: translationJobState("state").notNull().default("queued"),
    outputContentJson: jsonb("output_content_json"),
    outputContentHash: varchar("output_content_hash", { length: 64 }),
    requestedById: uuid("requested_by_id").references(() => users.id),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    /** Stable provider/application error code; never provider response text. */
    errorCode: varchar("error_code", { length: 100 }),
  },
  (t) => [
    foreignKey({
      name: "translation_jobs_source_scope_fk",
      columns: [t.sourceVersionId],
      foreignColumns: [translationSourceVersions.id],
    }).onDelete("restrict"),
    uniqueIndex("translation_jobs_source_target_uq").on(
      t.sourceVersionId,
      t.targetLanguageCode,
    ),
    uniqueIndex("translation_jobs_provider_reference_uq")
      .on(t.providerCode, t.providerJobReference)
      .where(sql`${t.providerJobReference} is not null`),
    check("translation_jobs_ai_method_check", sql`${t.method} <> 'human'`),
    check(
      "translation_jobs_output_hash_check",
      sql`${t.outputContentHash} is null or ${t.outputContentHash} ~ '^[0-9a-f]{64}$'`,
    ),
    index("translation_jobs_state_idx").on(t.state, t.requestedAt),
    index("translation_jobs_org_idx").on(t.organizationId),
  ],
);
