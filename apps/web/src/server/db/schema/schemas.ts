import { pgEnum, pgSchema, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * PostgreSQL schemas as domain boundaries (docs/DATABASE-SCHEMA.md §1).
 * Slice 0 uses auth / core / content; later slices add operations,
 * documents, inventory — additively. `notifications` opens with the
 * per-user preference table only: what a person agreed to be told is
 * account data, so it lands before the outbox and the delivery ledger.
 */
export const authSchema = pgSchema("auth");
export const core = pgSchema("core");
export const content = pgSchema("content");
export const simulator = pgSchema("simulator");
export const notifications = pgSchema("notifications");
export const audit = pgSchema("audit");
/**
 * Opens with the shared coordination agenda only (DATABASE-SCHEMA.md §13):
 * an event is a coordination artefact, not published content, even when its
 * host chooses to show it publicly. Internal planning, shifts and missions
 * land here later — additively.
 */
export const operations = pgSchema("operations");

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
 * Who to reach inside the network when a record is wrong — a name, and a phone
 * number or an email address for it. Every content root carries these three
 * columns so that any editor, in any organisation, can ask the people who own
 * the information instead of guessing or publishing a correction blind.
 *
 * These are workspace-only, in the sense `content.contacts` already gives that
 * word: no public read model selects them, and nothing here is meant to reach a
 * visitor. That is why they are plain columns rather than another contact row —
 * a `contacts` record can be linked to a public surface by mistake, a column no
 * public query mentions cannot.
 */
export const stewardContact = {
  /** The person or role to ask for — never a member's private identity. */
  stewardName: varchar("steward_name", { length: 120 }),
  stewardPhone: varchar("steward_phone", { length: 40 }),
  stewardEmail: varchar("steward_email", { length: 255 }),
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

/* ------------------------------------------------------------------ */
/* Coordination agenda (docs/DATABASE-SCHEMA.md §13)                   */
/* ------------------------------------------------------------------ */

/**
 * Who may read one coordination event. The first two values are the agenda
 * described in PRODUCT.md §23 (`organization` = the host's own members,
 * `inter_organization` = authenticated members of every verified
 * organisation, never public). `public` is a deliberate third tier the host
 * opts into per event, and the only one any public surface may read; it is
 * off by default and every read model filters on it explicitly.
 */
export const coordinationEventVisibility = pgEnum(
  "coordination_event_visibility",
  ["organization", "inter_organization", "public"],
);
/** A cancelled event stays visible with its reason — it never disappears. */
export const coordinationEventStatus = pgEnum("coordination_event_status", [
  "scheduled",
  "cancelled",
]);

/* ------------------------------------------------------------------ */
/* Account settings (docs/DATABASE-SCHEMA.md §4) — one person's own    */
/* choices about the console, never organisation policy.               */
/* ------------------------------------------------------------------ */

/** "system" follows the device; it is the default, not a third colour. */
export const themePreference = pgEnum("theme_preference", [
  "system",
  "light",
  "dark",
]);
/** docs/DESIGN.md allows a denser workspace; the person decides. */
export const workspaceDensity = pgEnum("workspace_density", [
  "comfortable",
  "compact",
]);
/** Which sign-in the console offers first; every method stays available. */
export const signInMethod = pgEnum("sign_in_method", [
  "magic_link",
  "password",
  /** Reserved for `auth.authenticators` (WebAuthn) — not yet offered. */
  "passkey",
]);
/** The second factor a person is enrolled in. Slice 0 delivers SMS only. */
export const secondFactorMethod = pgEnum("second_factor_method", [
  "sms",
  "totp",
  "email",
]);
export const digestFrequency = pgEnum("digest_frequency", [
  "off",
  "daily",
  "weekly",
]);
export const clockFormat = pgEnum("clock_format", ["h12", "h24"]);
/** Where "open the console" lands, so a runbook-first editor stays there. */
export const consoleLandingSection = pgEnum("console_landing_section", [
  "runbook",
  "activities",
  "articles",
  "simulator",
]);
/**
 * What the platform may tell someone about (docs/DATABASE-SCHEMA.md §16).
 * `security_alert` exists so the audit trail can name it — it is never
 * switched off; see `notificationPreferences`.
 */
export const notificationKind = pgEnum("notification_kind", [
  "activity_review_due",
  "activity_status_changed",
  "publication_state",
  "translation_assignment",
  "membership_invitation",
  "coordination_event",
  "security_alert",
  "product_update",
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
  [
    "editorial_entry",
    "activity",
    "public_event",
    "simulator_flow",
    /** The organisation's own narrative: purpose, goals, values. */
    "organization_profile",
    /** Directory records: every published string needs a source language too. */
    "place",
    "service",
  ],
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
