import { pgEnum, pgSchema, timestamp } from "drizzle-orm/pg-core";

/**
 * PostgreSQL schemas as domain boundaries (docs/DATABASE-SCHEMA.md §1).
 * Slice 0 uses auth / core / content; later slices add simulator,
 * operations, documents, inventory, notifications, audit — additively.
 */
export const authSchema = pgSchema("auth");
export const core = pgSchema("core");
export const content = pgSchema("content");
export const simulator = pgSchema("simulator");
export const audit = pgSchema("audit");

/* ------------------------------------------------------------------ */
/* Shared lifecycle column basics — spread these instead of redefining */
/* ------------------------------------------------------------------ */

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * Recoverable content removal (docs/DATABASE-SCHEMA.md §2): archived rows
 * disappear from public surfaces but keep history. Prefer this over hard
 * deletes for anything that was ever published.
 */
export const archival = {
  archivedAt: timestamp("archived_at", { withTimezone: true }),
};

/**
 * Soft deletion. Use only where no explicit business lifecycle exists —
 * docs/DATABASE-SCHEMA.md §2 prefers explicit statuses (e.g. organisation
 * status) over `deleted_at`, and forbids hard-deleting published revision
 * history or audit evidence from application code.
 */
export const softDeletion = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

/**
 * Freshness/verification metadata (PRODUCT.md §14.1) — the product's core
 * mechanic. Tables that also record *who* verified add their own FK column.
 */
export const verification = {
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  reviewDueAt: timestamp("review_due_at", { withTimezone: true }),
};

/* ------------------------------------------------------------------ */
/* Enums — reserved for stable state machines; taxonomies are rows.   */
/* Enums live in the public schema: drizzle-kit push does not emit    */
/* schema-qualified enum types; table placement carries the domain    */
/* boundaries instead.                                                */
/* ------------------------------------------------------------------ */

export const textDirection = pgEnum("text_direction", ["ltr", "rtl"]);
export const organizationStatus = pgEnum("organization_status", [
  "draft",
  "verified",
  "suspended",
  "archived",
]);
export const translationState = pgEnum("translation_state", [
  "draft",
  "machine_generated",
  "needs_review",
  "verified",
  "rejected",
]);
export const translationMethod = pgEnum("translation_method", [
  "human",
  "ai",
  "ai_then_human_review",
]);
/** Effect of one source version on translations tied to its predecessor. */
export const translationImpact = pgEnum("translation_impact", [
  "initial",
  "none",
  "review_required",
  "regenerate",
]);
export const translationJobState = pgEnum("translation_job_state", [
  "queued",
  "submitted",
  "succeeded",
  "failed",
  "cancelled",
]);
/** RISKS.md R5: how precisely a place may be published. */
export const locationPrecision = pgEnum("location_precision", [
  "exact",
  "area_only",
  "contact_to_learn",
]);
export const serviceManualStatus = pgEnum("service_manual_status", [
  "normal",
  "cancelled",
  "uncertain",
]);
export const scheduleExceptionKind = pgEnum("schedule_exception_kind", [
  "closure",
  "cancellation",
  "exceptional_opening",
  "uncertain",
]);
export const holidayBehavior = pgEnum("holiday_behavior", [
  "closed",
  "open",
  "unchanged",
]);
/** Originating actor scope; this is provenance, not an RBAC role code. */
export const activityActorScope = pgEnum("activity_actor_scope", [
  "platform",
  "organization",
  "system",
]);
export const activityRelationshipState = pgEnum("activity_relationship_state", [
  "proposed",
  "confirmed",
  "rejected",
  "retired",
]);
export const activityClaimState = pgEnum("activity_claim_state", [
  "pending",
  "accepted",
  "declined",
  "expired",
  "cancelled",
]);
export const specialityAssignmentState = pgEnum("speciality_assignment_state", [
  "requested",
  "verified",
  "rejected",
  "retired",
]);
export const contactKind = pgEnum("contact_kind", [
  "phone",
  "whatsapp",
  "email",
  "on_site",
  "url",
]);
export const contactVisibility = pgEnum("contact_visibility", [
  "public",
  "workspace",
]);

/* Phase 0/1 access control (docs/DATABASE-SCHEMA.md §4–§5) */
export const memberStatus = pgEnum("member_status", [
  "invited",
  "active",
  "inactive",
  "offboarded",
]);
export const invitationKind = pgEnum("invitation_kind", [
  "association_publisher",
  "organization_admin",
  "member",
]);
export const verificationStatus = pgEnum("verification_status", [
  "pending",
  "approved",
  "rejected",
]);

/* Editorial (docs/DATABASE-SCHEMA.md §8) */
export const editorialKind = pgEnum("editorial_kind", [
  "article",
  "fixed_information",
  "basic_information",
]);
export const editorialWorkflowState = pgEnum("editorial_workflow_state", [
  "draft",
  "in_review",
  "published",
  "unpublished",
  "archived",
]);
export const custodianKind = pgEnum("custodian_kind", [
  "organization",
  "platform",
]);
export const attributionRole = pgEnum("attribution_role", [
  "factual_owner",
  "publisher",
  "mentioned",
]);
export const reviewTaskStatus = pgEnum("review_task_status", [
  "open",
  "done",
  "dismissed",
]);

/**
 * Phase 1.3 translator collaboration (docs/PHASE-1.3-COLLABORATION.md).
 * The explicit assignment lifecycle: a sender requests a translation, the
 * external translator drafts and submits it, a reviewer reviews and then
 * accepts or rejects it, and an accepted translation is finally published.
 */
export const translationAssignmentState = pgEnum(
  "translation_assignment_state",
  [
    "requested",
    "draft",
    "submitted",
    "reviewed",
    "accepted",
    "rejected",
    "published",
  ],
);
/** The public content types a translator link may target. */
export const translationAssignmentEntity = pgEnum(
  "translation_assignment_entity",
  ["editorial_entry", "activity", "public_event", "simulator_flow"],
);

/* Assets and media (docs/DATABASE-SCHEMA.md §9) */
export const mediaKind = pgEnum("media_kind", [
  "image",
  "video",
  "audio",
  "document",
  "other",
]);
export const assetVisibility = pgEnum("asset_visibility", [
  "public",
  "workspace",
]);
export const malwareScanState = pgEnum("malware_scan_state", [
  "pending",
  "clean",
  "flagged",
]);
export const assetVariantKind = pgEnum("asset_variant_kind", [
  "thumbnail",
  "optimized_image",
  "poster",
  "low_bandwidth_video",
  "low_bandwidth_audio",
  "printable_pdf",
  "other",
]);
export const textTrackKind = pgEnum("text_track_kind", [
  "transcript",
  "captions",
  "subtitles",
  "description",
]);

/* Public events (docs/DATABASE-SCHEMA.md §7) */
export const occurrenceState = pgEnum("occurrence_state", [
  "scheduled",
  "cancelled",
  "uncertain",
]);

/* Simulator graph (docs/DATABASE-SCHEMA.md §10) */
export const simulatorNodeKind = pgEnum("node_kind", [
  "question",
  "information",
  "result",
]);
export const flowVersionStatus = pgEnum("flow_version_status", [
  "draft",
  "published",
  "retired",
]);

/* Audit (docs/DATABASE-SCHEMA.md §17) */
export const auditActorType = pgEnum("actor_type", [
  "user",
  "system",
  "provider",
  "support",
]);
