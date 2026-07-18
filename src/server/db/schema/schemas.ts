import { pgSchema, timestamp } from "drizzle-orm/pg-core";

/**
 * PostgreSQL schemas as domain boundaries (docs/DATABASE-SCHEMA.md §1).
 * Slice 0 uses auth / core / content; later slices add simulator,
 * operations, documents, inventory, notifications, audit — additively.
 */
export const authSchema = pgSchema("auth");
export const core = pgSchema("core");
export const content = pgSchema("content");

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* Enums are reserved for stable state machines; taxonomies are rows. */
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
