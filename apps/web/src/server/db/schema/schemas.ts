import { pgSchema, timestamp } from "drizzle-orm/pg-core";

/**
 * PostgreSQL schemas as domain boundaries (docs/DATABASE-SCHEMA.md §1).
 * Slice 0 uses auth / core / content; later slices add simulator,
 * operations, documents, inventory, notifications, audit — additively.
 */
export const authSchema = pgSchema("auth");
export const core = pgSchema("core");
export const content = pgSchema("content");

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
