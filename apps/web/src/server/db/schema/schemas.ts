import { pgSchema, timestamp } from "drizzle-orm/pg-core";

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
/* ------------------------------------------------------------------ */

export const textDirection = core.enum("text_direction", ["ltr", "rtl"]);
export const organizationStatus = core.enum("organization_status", [
  "draft",
  "verified",
  "suspended",
  "archived",
]);
export const translationState = content.enum("translation_state", [
  "draft",
  "machine_generated",
  "needs_review",
  "verified",
  "rejected",
]);
export const translationMethod = content.enum("translation_method", [
  "human",
  "ai",
  "ai_then_human_review",
]);
/** RISKS.md R5: how precisely a place may be published. */
export const locationPrecision = content.enum("location_precision", [
  "exact",
  "area_only",
  "contact_to_learn",
]);
export const serviceManualStatus = content.enum("service_manual_status", [
  "normal",
  "cancelled",
  "uncertain",
]);
export const scheduleExceptionKind = content.enum("schedule_exception_kind", [
  "closure",
  "cancellation",
  "exceptional_opening",
  "uncertain",
]);
export const holidayBehavior = content.enum("holiday_behavior", [
  "closed",
  "open",
  "unchanged",
]);
export const specialityAssignmentState = content.enum(
  "speciality_assignment_state",
  ["requested", "verified", "rejected", "retired"],
);
export const contactKind = content.enum("contact_kind", [
  "phone",
  "whatsapp",
  "email",
  "on_site",
  "url",
]);
export const contactVisibility = content.enum("contact_visibility", [
  "public",
  "workspace",
]);

/* Phase 0/1 access control (docs/DATABASE-SCHEMA.md §4–§5) */
export const memberStatus = core.enum("member_status", [
  "invited",
  "active",
  "inactive",
  "offboarded",
]);
export const invitationKind = core.enum("invitation_kind", [
  "association_publisher",
  "organization_admin",
  "member",
]);
export const verificationStatus = core.enum("verification_status", [
  "pending",
  "approved",
  "rejected",
]);

/* Editorial (docs/DATABASE-SCHEMA.md §8) */
export const editorialKind = content.enum("editorial_kind", [
  "article",
  "fixed_information",
  "basic_information",
]);
export const editorialWorkflowState = content.enum("editorial_workflow_state", [
  "draft",
  "in_review",
  "published",
  "unpublished",
  "archived",
]);
export const custodianKind = content.enum("custodian_kind", [
  "organization",
  "platform",
]);
export const attributionRole = content.enum("attribution_role", [
  "factual_owner",
  "publisher",
  "mentioned",
]);
export const reviewTaskStatus = content.enum("review_task_status", [
  "open",
  "done",
  "dismissed",
]);

/* Assets and media (docs/DATABASE-SCHEMA.md §9) */
export const mediaKind = content.enum("media_kind", [
  "image",
  "video",
  "audio",
  "document",
  "other",
]);
export const assetVisibility = content.enum("asset_visibility", [
  "public",
  "workspace",
]);
export const malwareScanState = content.enum("malware_scan_state", [
  "pending",
  "clean",
  "flagged",
]);
export const assetVariantKind = content.enum("asset_variant_kind", [
  "thumbnail",
  "optimized_image",
  "poster",
  "low_bandwidth_video",
  "low_bandwidth_audio",
  "printable_pdf",
  "other",
]);
export const textTrackKind = content.enum("text_track_kind", [
  "transcript",
  "captions",
  "subtitles",
  "description",
]);

/* Public events (docs/DATABASE-SCHEMA.md §7) */
export const occurrenceState = content.enum("occurrence_state", [
  "scheduled",
  "cancelled",
  "uncertain",
]);

/* Simulator graph (docs/DATABASE-SCHEMA.md §10) */
export const simulatorNodeKind = simulator.enum("node_kind", [
  "question",
  "information",
  "result",
]);
export const flowVersionStatus = simulator.enum("flow_version_status", [
  "draft",
  "published",
  "retired",
]);

/* Audit (docs/DATABASE-SCHEMA.md §17) */
export const auditActorType = audit.enum("actor_type", [
  "user",
  "system",
  "provider",
  "support",
]);
