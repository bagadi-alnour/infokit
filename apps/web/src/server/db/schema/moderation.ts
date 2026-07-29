import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { organizations } from "./organizations";
import {
  core,
  moderationCaseKind,
  moderationCaseStatus,
  timestamps,
} from "./schemas";

/**
 * One thing the platform is looking into (FR-P2-013, docs/DATABASE-SCHEMA.md §11):
 * two organisations that look like the same association, a workspace claiming to
 * be somebody it is not, two associations disputing the same activity, content
 * that should not be published, a suspension, or an association leaving.
 *
 * It is a case rather than a flag on the organisation because the interesting part
 * is the *handling*: what was reported, what was found, what was decided, and by
 * whom. A boolean `suspended` column can say the outcome and can never answer
 * "why, and who decided that?" — which is the question an association asks when it
 * finds itself unable to publish.
 *
 * The subject is polymorphic (`entity_type` + `entity_id`), the same idiom as
 * `audit.events`, because moderation reaches organisations, activities, editorial
 * entries and coordination events alike, and a nullable foreign key per kind would
 * grow a column every time a new surface becomes reportable. The cost is real —
 * the database cannot check that `entity_id` points at anything — so the writer is
 * the service layer, `entity_label` keeps a readable name for when the row is
 * gone, and `related_organization_id` is a *typed* key because the duplicate and
 * impersonation cases are about a second organisation and are queried by it.
 *
 * `organization_id` is the workspace the case is against, and it is nullable: a
 * report about platform-owned content belongs to nobody's workspace. A case is
 * never visible to the organisation it concerns except through the decision the
 * platform chooses to communicate — this table is platform-only, not tenant-read.
 */
export const moderationCases = core.table(
  "moderation_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** A short human reference — `MOD-2026-014` — used when talking to people. */
    reference: varchar("reference", { length: 40 }).notNull().unique(),
    kind: moderationCaseKind("kind").notNull(),
    status: moderationCaseStatus("status").notNull().default("open"),
    /** The workspace the case is against; null for platform-owned content. */
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "restrict",
    }),
    /**
     * The second organisation, for the kinds that are about a pair: the suspected
     * duplicate, or the one being impersonated. Typed rather than folded into the
     * polymorphic subject because "show me every case touching this association"
     * has to find it from either side.
     */
    relatedOrganizationId: uuid("related_organization_id").references(
      () => organizations.id,
      { onDelete: "restrict" },
    ),
    /** `organization`, `activity`, `editorial_entry`, `coordination_event`. */
    entityType: varchar("entity_type", { length: 100 }),
    entityId: varchar("entity_id", { length: 255 }),
    /** A safe label — a title or a slug, never contact data. */
    entityLabel: varchar("entity_label", { length: 255 }),
    /** What was reported, in the reporter's own words. */
    summary: text("summary").notNull(),
    /**
     * Who raised it, when that was an account. Null for a report arriving from
     * outside, and the reporter's own contact details are deliberately not stored:
     * a moderation queue is not a place to accumulate people's addresses.
     */
    reportedById: uuid("reported_by_id").references(() => users.id),
    /** The organisation that raised it, when one did. */
    reportedByOrganizationId: uuid("reported_by_organization_id"),
    assignedToId: uuid("assigned_to_id").references(() => users.id),
    /** What was decided — `merged`, `renamed`, `suspended`, `no_action`. */
    resolution: varchar("resolution", { length: 80 }),
    /** Why, in words. Read back months later by whoever asks about the decision. */
    resolutionNote: text("resolution_note"),
    resolvedById: uuid("resolved_by_id").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // Named explicitly: the generated name would be 64 characters, one past
    // Postgres's identifier limit, and a truncated name never matches the schema
    // again — `db:push` would drop and recreate it on every run.
    foreignKey({
      name: "moderation_cases_reporter_org_fk",
      columns: [t.reportedByOrganizationId],
      foreignColumns: [organizations.id],
    }).onDelete("set null"),
    // A case has to be about something the platform can go and look at.
    check(
      "moderation_cases_subject_check",
      sql`${t.organizationId} is not null or (${t.entityType} is not null and ${t.entityId} is not null)`,
    ),
    // A pair case needs its pair, and the pair has to be two organisations.
    check(
      "moderation_cases_related_check",
      sql`(${t.kind} in ('duplicate', 'impersonation') and ${t.relatedOrganizationId} is not null) or ${t.kind} not in ('duplicate', 'impersonation')`,
    ),
    check(
      "moderation_cases_distinct_check",
      sql`${t.relatedOrganizationId} is null or ${t.organizationId} is null or ${t.relatedOrganizationId} <> ${t.organizationId}`,
    ),
    // Closing a case without saying what was decided leaves the next reviewer to
    // guess, and a suspension nobody can explain is the worst kind.
    check(
      "moderation_cases_resolution_check",
      sql`(${t.status} in ('resolved', 'dismissed') and ${t.resolvedAt} is not null and ${t.resolvedById} is not null and ${t.resolution} is not null) or ${t.status} in ('open', 'in_review')`,
    ),
    // The queue: what is still open, oldest first.
    index("moderation_cases_status_time_idx").on(t.status, t.createdAt),
    index("moderation_cases_org_time_idx").on(t.organizationId, t.createdAt),
    index("moderation_cases_related_idx").on(t.relatedOrganizationId),
    index("moderation_cases_entity_idx").on(t.entityType, t.entityId),
    index("moderation_cases_assignee_idx").on(t.assignedToId, t.status),
    // One open pair case per pair, so the same suspected duplicate reported three
    // times is one investigation rather than three verdicts. Restricted to the
    // pair kinds and to rows where both organisations are named, because a unique
    // index treats every null as distinct: including the content kinds would look
    // like a rule and enforce nothing. The other kinds are deliberately
    // unconstrained — two open reports about two different articles of the same
    // organisation are two cases.
    uniqueIndex("moderation_cases_open_pair_uq")
      .on(t.kind, t.organizationId, t.relatedOrganizationId)
      .where(
        sql`${t.status} in ('open', 'in_review') and ${t.kind} in ('duplicate', 'impersonation') and ${t.organizationId} is not null and ${t.relatedOrganizationId} is not null`,
      ),
  ],
);

/**
 * Immutable handling history for one case: assigned, evidence noted, decided,
 * reopened.
 *
 * Append-only for the same reason as the custody history — a moderation decision
 * that can be edited afterwards is not evidence of anything. Stage 0 revokes
 * `UPDATE` and `DELETE` here and adds the trigger that refuses them.
 *
 * `note` carries what the reviewer wrote and nothing else: no reporter contact
 * details, no copied document content, no personal data about members. What the
 * platform looked at is named, not reproduced.
 */
export const moderationEvents = core.table(
  "moderation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => moderationCases.id, { onDelete: "restrict" }),
    /** `opened`, `assigned`, `note`, `evidence`, `resolved`, `dismissed`, `reopened`. */
    action: varchar("action", { length: 80 }).notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    /** The status the case moved to, when this event moved it. */
    newStatus: moderationCaseStatus("new_status"),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("moderation_events_case_time_idx").on(t.caseId, t.occurredAt)],
);
