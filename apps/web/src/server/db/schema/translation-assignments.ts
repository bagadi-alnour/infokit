import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  text,
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
  timestamps,
  translationAssignmentEntity,
  translationAssignmentState,
} from "./schemas";
import { translationSourceVersions } from "./translation-sources";

/**
 * Phase 1.3 translator collaboration (docs/PHASE-1.3-COLLABORATION.md).
 *
 * A secure, expiring share of one public content item, in one target
 * language, with one external translator who has no account or dashboard
 * access. The email contains an opaque one-use activation token. The server
 * stores its hash, exchanges it for a scoped HttpOnly assignment session, and
 * redirects to a token-free URL.
 *
 * The target is polymorphic over public content types that carry per-language
 * translations — editorial entries, activities, public events, and simulator
 * flows. This mirrors the documented `content.review_tasks` exception rather
 * than the typed-join-table default: the assignment is a shareable object in
 * its own right, not a relationship the content model needs to traverse. The
 * `sourceVersionId` pins the assignment to one immutable source payload;
 * application services validate that its denormalized organisation/entity
 * scope matches this row before insert. Keeping the database FK on the source
 * version's stable primary key avoids coupling it to a replaceable composite
 * unique constraint during schema pushes.
 */
export const translationAssignments = content.table(
  "translation_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    entityKind: translationAssignmentEntity("entity_kind").notNull(),
    entityId: uuid("entity_id").notNull(),
    sourceVersionId: uuid("source_version_id").notNull(),
    targetLanguageCode: varchar("target_language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    translatorEmail: varchar("translator_email", { length: 255 }).notNull(),
    translatorName: varchar("translator_name", { length: 200 }),
    assignedById: varchar("assigned_by_id", { length: 255 }).references(
      () => users.id,
    ),
    tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
    tokenConsumedAt: timestamp("token_consumed_at", { withTimezone: true }),
    state: translationAssignmentState("state").notNull().default("requested"),
    /**
     * The translator's working / submitted target fields, held here until a
     * reviewer accepts them and promotes them into the content type's own
     * translation row. Keeps unreviewed external text out of public tables.
     */
    submittedContentJson: jsonb("submitted_content_json"),
    submittedContentHash: varchar("submitted_content_hash", { length: 64 }),
    instructions: text("instructions"),
    reviewNote: text("review_note"),
    reviewedById: varchar("reviewed_by_id", { length: 255 }).references(
      () => users.id,
    ),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    promotedById: varchar("promoted_by_id", { length: 255 }).references(
      () => users.id,
    ),
    promotedAt: timestamp("promoted_at", { withTimezone: true }),
    publishedById: varchar("published_by_id", { length: 255 }).references(
      () => users.id,
    ),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "translation_assignments_source_scope_fk",
      columns: [t.sourceVersionId],
      foreignColumns: [translationSourceVersions.id],
    }).onDelete("restrict"),
    check(
      "translation_assignments_expiry_check",
      sql`${t.expiresAt} > ${t.createdAt}`,
    ),
    check(
      "translation_assignments_token_consumed_check",
      sql`${t.tokenConsumedAt} is null or ${t.tokenConsumedAt} <= ${t.expiresAt}`,
    ),
    check(
      "translation_assignments_submission_hash_check",
      sql`(${t.submittedContentJson} is null and ${t.submittedContentHash} is null) or (${t.submittedContentJson} is not null and ${t.submittedContentHash} ~ '^[0-9a-f]{64}$')`,
    ),
    check(
      "translation_assignments_promotion_actor_check",
      sql`(${t.promotedAt} is null and ${t.promotedById} is null) or (${t.promotedAt} is not null and ${t.promotedById} is not null)`,
    ),
    check(
      "translation_assignments_publication_actor_check",
      sql`(${t.publishedAt} is null and ${t.publishedById} is null) or (${t.publishedAt} is not null and ${t.publishedById} is not null and ${t.promotedAt} is not null)`,
    ),
    check(
      "translation_assignments_expired_at_check",
      sql`${t.expiredAt} is null or ${t.expiredAt} >= ${t.expiresAt}`,
    ),
    /**
     * At most one live assignment per (item, target language). A revoked or
     * expired assignment or terminal decision frees the slot for re-sharing.
     */
    uniqueIndex("translation_assignments_active_uq")
      .on(t.entityKind, t.entityId, t.targetLanguageCode)
      .where(
        sql`${t.revokedAt} is null and ${t.expiredAt} is null and ${t.state} not in ('rejected', 'published')`,
      ),
    index("translation_assignments_org_idx").on(t.organizationId),
    index("translation_assignments_entity_idx").on(t.entityKind, t.entityId),
  ],
);

/**
 * Explicit lifecycle history for one assignment — every state transition and
 * its author. The external translator acts by token (`byTranslator`); senders
 * and reviewers act as authenticated users (`actorUserId`). Complements the
 * global audit log with a compact, assignment-scoped trail.
 */
export const translationAssignmentEvents = content.table(
  "translation_assignment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => translationAssignments.id, { onDelete: "cascade" }),
    fromState: translationAssignmentState("from_state"),
    toState: translationAssignmentState("to_state").notNull(),
    actorUserId: varchar("actor_user_id", { length: 255 }).references(
      () => users.id,
    ),
    byTranslator: boolean("by_translator").notNull().default(false),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "translation_assignment_events_actor_check",
      sql`(${t.byTranslator} and ${t.actorUserId} is null) or (not ${t.byTranslator} and ${t.actorUserId} is not null)`,
    ),
    index("translation_assignment_events_assignment_idx").on(t.assignmentId),
  ],
);
