import { pgSchema, timestamp, varchar } from "drizzle-orm/pg-core";

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
 * Opens with the shared coordination agenda (DATABASE-SCHEMA.md §13): an event
 * is a coordination artefact, not published content, even when its host
 * chooses to show it publicly. The training/course catalogue of §12 joins it
 * early — a course is the same kind of object, something an organisation
 * maintains for the people working with it rather than for visitors. Internal
 * planning, shifts and missions land here later — additively.
 */
export const operations = pgSchema("operations");

/* ------------------------------------------------------------------ */
/* Constraint names past 63 bytes                                      */
/* ------------------------------------------------------------------ */

/**
 * Postgres truncates every identifier at 63 bytes, silently. Drizzle names a
 * generated foreign key `{table}_{column}_{refTable}_{refColumn}_fk`, which for
 * the longer table names here runs to 90 — so the database ends up holding a
 * name the schema does not know it wrote.
 *
 * That costs three things. `drizzle-kit push` compares the name it intended
 * against the name it reads back, finds them different, and proposes to drop and
 * recreate the key — on every run, forever, because the recreation truncates
 * again; real drift then hides among the phantom statements. Two long names can
 * also truncate to the same 63 bytes, and the second `add constraint` fails
 * outright — nothing today prevents that but the accident of where the names
 * happen to differ. And a constraint violation names the truncated key, which
 * greps to nothing.
 *
 * So anything whose generated name would overrun is named explicitly, as
 * `{table}_{column}_fk` for a key and `{table}_pk` for a composite primary key.
 * That fits because the referenced table is redundant — `organization_id`
 * already says what it points at. Keys whose generated name fits keep
 * `.references()`: moving all of them would put the reference a screen away
 * from the column for no gain.
 */

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
/* Enums — reserved for stable state machines; taxonomies are rows.    */
/*                                                                     */
/* Each one is declared on the schema of the tables that use it, via   */
/* `<schema>.enum(...)` rather than a bare `pgEnum(...)`, so the type  */
/* sits inside the same domain boundary as its columns                 */
/* (docs/DATABASE-SCHEMA.md §1). They were all in `public` while the   */
/* database was built by `drizzle-kit push`, which does not emit       */
/* schema-qualified enum types; migrations do, so the exception is     */
/* gone and `drizzle.config.ts` no longer needs `public` in its        */
/* `schemaFilter`.                                                     */
/*                                                                     */
/* Placement rule: the schema of the only domain that uses the enum;   */
/* `core` when more than one does, since `core` is what the others     */
/* already depend on. Two are shared today — `transit_mode`            */
/* (content + operations) and `translation_state` (content +           */
/* simulator). Nothing imports these by schema, so a consumer only     */
/* ever sees the exported const and moving one is not a call-site      */
/* change; `pnpm db:names` scopes enum names per schema, so it catches */
/* a collision a move introduces.                                      */
/*                                                                     */
/* Naming rule, and it is a hard one: an enum name must not begin with */
/* the name of a Postgres native type. drizzle-kit 0.31.10 decides     */
/* whether a column type needs its schema prefix with                  */
/* `pgNativeTypes.some((it) => type.startsWith(it))`                   */
/* (drizzle-kit/api.mjs, `parseType`), so `text_direction` is read as  */
/* the native `text` and emitted bare — `CREATE TABLE` then fails with */
/* `type "text_direction" does not exist`, since the type really lives */
/* in a schema. `writing_direction` and `asset_text_track_kind` below  */
/* are named around that; `pnpm db:names` fails the build on a new     */
/* one, so this stays mechanical rather than remembered.               */
/* ------------------------------------------------------------------ */

export const writingDirection = core.enum("writing_direction", ["ltr", "rtl"]);
export const organizationStatus = core.enum("organization_status", [
  "draft",
  "verified",
  "suspended",
  "archived",
]);
export const translationState = core.enum("translation_state", [
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
/**
 * Who one language is still waiting on before it may face the public.
 *
 * Two stages, deliberately unequal. A colleague reading the text through is
 * optional — useful, often the fastest way to catch a mistranslation, but the
 * editors decide among themselves whether to ask. The platform's own check is
 * not: nothing reaches a visitor in a language nobody at the platform has
 * confirmed. `changes_requested` is either reviewer sending it back, which is
 * why it is one value rather than one per stage — what matters to the editor is
 * that it is theirs again.
 */
export const translationReviewStage = content.enum("translation_review_stage", [
  "none",
  "team_requested",
  "team_validated",
  "platform_requested",
  "platform_verified",
  "changes_requested",
]);
/** Effect of one source version on translations tied to its predecessor. */
export const translationImpact = content.enum("translation_impact", [
  "initial",
  "none",
  "review_required",
  "regenerate",
]);
export const translationJobState = content.enum("translation_job_state", [
  "queued",
  "submitted",
  "succeeded",
  "failed",
  "cancelled",
]);
/** RISKS.md R5: how precisely a place may be published. */
export const locationPrecision = content.enum("location_precision", [
  "exact",
  "area_only",
  "contact_to_learn",
]);
/**
 * Which public transport takes someone to an activity or an event.
 *
 * An enum rather than free text because the mode is the one part of "how to get
 * here" that must read in the visitor's own language: the line number and the
 * stop are proper nouns nobody translates, but "bus" has to say bus in Pashto.
 * The list is the modes a French coastal city actually runs, plus the two a
 * reader arrives on without a ticket — `bike` for a hire dock, `other` for
 * anything a network invents next.
 */
export const transitMode = core.enum("transit_mode", [
  "bus",
  "tram",
  "metro",
  "train",
  "coach",
  "ferry",
  "bike",
  "other",
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
/** Originating actor scope; this is provenance, not an RBAC role code. */
export const activityActorScope = content.enum("activity_actor_scope", [
  "platform",
  "organization",
  "system",
]);
export const activityRelationshipState = content.enum(
  "activity_relationship_state",
  ["proposed", "confirmed", "rejected", "retired"],
);
export const activityClaimState = content.enum("activity_claim_state", [
  "pending",
  "accepted",
  "declined",
  "expired",
  "cancelled",
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
export const coordinationEventVisibility = operations.enum(
  "coordination_event_visibility",
  ["organization", "inter_organization", "public"],
);
/** A cancelled event stays visible with its reason — it never disappears. */
export const coordinationEventStatus = operations.enum(
  "coordination_event_status",
  ["scheduled", "cancelled"],
);
/**
 * What one organisation answered about one coordination event (FR-P2-025).
 * Three values because a coordinator plans differently for each: `attending` is
 * a commitment to be there, `interested` says keep us informed, and `declined`
 * is an answer rather than silence — knowing an association will not come is
 * what stops someone chasing them. There is no `pending`: not having answered
 * is the absence of a row.
 */
export const coordinationParticipationState = operations.enum(
  "coordination_participation_state",
  ["attending", "interested", "declined"],
);

/* ------------------------------------------------------------------ */
/* Account settings (docs/DATABASE-SCHEMA.md §4) — one person's own    */
/* choices about the console, never organisation policy.               */
/* ------------------------------------------------------------------ */

/** "system" follows the device; it is the default, not a third colour. */
export const themePreference = authSchema.enum("theme_preference", [
  "system",
  "light",
  "dark",
]);
/** docs/DESIGN.md allows a denser workspace; the person decides. */
export const workspaceDensity = authSchema.enum("workspace_density", [
  "comfortable",
  "compact",
]);
/** Which sign-in the console offers first; every method stays available. */
export const signInMethod = authSchema.enum("sign_in_method", [
  "magic_link",
  "password",
  /** Reserved for `auth.authenticators` (WebAuthn) — not yet offered. */
  "passkey",
]);
export const digestFrequency = authSchema.enum("digest_frequency", [
  "off",
  "daily",
  "weekly",
]);
export const clockFormat = authSchema.enum("clock_format", ["h12", "h24"]);
/** Where "open the console" lands, so a runbook-first editor stays there. */
export const consoleLandingSection = authSchema.enum(
  "console_landing_section",
  ["runbook", "activities", "articles", "simulator"],
);
/**
 * What the platform may tell someone about (docs/DATABASE-SCHEMA.md §16).
 * `security_alert` exists so the audit trail can name it — it is never
 * switched off; see `notificationPreferences`.
 */
export const notificationKind = notifications.enum("notification_kind", [
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
  /**
   * An external translator invited to their own space (`core.translators`).
   * Carries no organisation: a translator works for the network, not inside
   * one organisation's membership.
   */
  "translator",
  /**
   * Platform staff — today the content manager the superadmin invites. It
   * carries no organisation either, and grants its roles globally in
   * `core.user_platform_roles` rather than inside a membership.
   */
  "platform_admin",
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
/**
 * How a basic-information tile is reached, where reaching it means placing a
 * call rather than opening a page (`basicInformationDetails`).
 *
 * `sms` exists because 114 is written to and not answered by voice, and a
 * surface must never offer a call that cannot connect. `whatsapp` is the line
 * that is also reachable there — often the only route on a data-only phone.
 */
export const basicInformationReach = content.enum("basic_information_reach", [
  "voice",
  "sms",
  "whatsapp",
]);
/**
 * Whose phone rings: the country's own emergency service, or an association.
 *
 * This is the fact behind the two blocks the public page draws — "the numbers
 * for right now", and beneath them the association lines under a heading that
 * says in so many words that they are *not* the State's. That heading is a
 * claim about the number, so it has to be recorded as one.
 *
 * Deliberately not inferred from `answered_by_organization_id`. That column says
 * *which* association answers, and it is legitimately null for a line whose
 * network has no record here — Alarm Phone is transnational and is not one of
 * the Calais associations, so naming one of them would put a false claim on a
 * published card. "Run by an association" and "run by *this* association" are
 * different questions, and only the first decides where the card is drawn.
 *
 * `state` is the default a new tile takes, because it is the answer that claims
 * least: a mis-filed tile then sits among the emergency numbers, where the page
 * asserts nothing about who owns it, rather than under a heading that tells a
 * reader an association is on the other end.
 */
export const basicInformationOperator = content.enum(
  "basic_information_operator",
  ["state", "association"],
);
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

/* ------------------------------------------------------------------ */
/* Phase 2 — association onboarding (docs/DATABASE-SCHEMA.md §5, §8,   */
/* §11, §13, §16; PRODUCT.md §11)                                      */
/* ------------------------------------------------------------------ */

/**
 * A custody handover waiting on the destination (FR-P2-019). The same lifecycle
 * as `activity_claim_state`, kept as its own type because the two are decided by
 * different people about different things and one gaining a value must not
 * silently give it to the other.
 */
export const custodyTransferState = content.enum("custody_transfer_state", [
  "pending",
  "accepted",
  "declined",
  "expired",
  "cancelled",
]);
/**
 * Where one speciality change set stands (FR-P2-018). `partially_approved` is
 * not an administrative nicety: a set that adds one claim and removes another is
 * routine, removal takes effect at once, and the addition waits for platform
 * reverification — so the set as a whole is genuinely half-decided, and calling
 * it `approved` would say the platform verified something it did not.
 */
export const specialityChangeState = content.enum("speciality_change_state", [
  "submitted",
  "under_review",
  "approved",
  "partially_approved",
  "rejected",
  "cancelled",
]);
/** What one line of a change set asks for (FR-P2-018). */
export const specialityChangeAction = content.enum("speciality_change_action", [
  "add",
  "remove",
  "reorder",
  "set_primary",
]);
/** The platform's answer to one line. `pending` until somebody decides. */
export const specialityChangeItemDecision = content.enum(
  "speciality_change_item_decision",
  ["pending", "approved", "rejected"],
);
/** What the platform is looking at (FR-P2-013, docs/DATABASE-SCHEMA.md §11). */
export const moderationCaseKind = core.enum("moderation_case_kind", [
  "duplicate",
  "impersonation",
  "conflict",
  "unsafe_content",
  "suspension",
  "departure",
]);
export const moderationCaseStatus = core.enum("moderation_case_status", [
  "open",
  "in_review",
  "resolved",
  "dismissed",
]);
/**
 * A periodic re-check that the people holding permissions still need them
 * (FR-P2-011). `open` is a campaign nobody has started, which is a different
 * state from one under way — an untouched review that quietly stayed open is
 * exactly what a security review needs to be able to count.
 */
export const permissionReviewState = core.enum("permission_review_state", [
  "open",
  "in_progress",
  "completed",
  "cancelled",
]);
/** The decision on one role assignment; `pending` until it is reviewed. */
export const permissionReviewDecision = core.enum(
  "permission_review_decision",
  ["pending", "keep", "revoke"],
);
/**
 * Where the platform may reach one person (docs/DATABASE-SCHEMA.md §16). Three
 * values rather than reusing `delivery_channel`: an in-app notification has no
 * endpoint to verify, so allowing `in_app` here would create rows that can never
 * be confirmed and never be sent to.
 */
export const notificationEndpointChannel = notifications.enum(
  "notification_endpoint_channel",
  ["email", "sms", "push"],
);

/**
 * Phase 1.3 translator collaboration (docs/PHASE-1.3-COLLABORATION.md).
 * The explicit assignment lifecycle: a sender requests a translation, the
 * external translator drafts and submits it, a reviewer reviews and then
 * accepts or rejects it, and an accepted translation is finally published.
 */
export const translationAssignmentState = content.enum(
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
export const translationAssignmentEntity = content.enum(
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

/**
 * A translator's standing in the directory (`core.translators`). `invited`
 * until they open their space by signing in with the invited address;
 * `inactive` is the reversible pause a translator or an operator asks for, and
 * `suspended` the platform's own decision. Only `active` translators are
 * offered when an editor picks who to send a language to.
 */
export const translatorStatus = core.enum("translator_status", [
  "invited",
  "active",
  "inactive",
  "suspended",
]);
/**
 * Who may pick one translator from the directory. An organisation inviting its
 * own trusted translator keeps them to itself by default — the entry names a
 * real person, so widening it is a decision, never an accident.
 */
export const translatorDirectoryScope = core.enum(
  "translator_directory_scope",
  ["organization", "all_organizations"],
);

/* ------------------------------------------------------------------ */
/* Skills and courses (docs/DATABASE-SCHEMA.md §12)                    */
/* ------------------------------------------------------------------ */

/**
 * How far one course or skill reaches. An organisation always sees its own
 * rows; the two wider tiers are what the owner deliberately opens up —
 * `all_organizations` to every verified organisation's members, and
 * `all_organizations_and_translators` additionally to the external translators
 * in `core.translators`, who are not members of anything.
 *
 * `organization` is the default, because reaching further is a decision. A row
 * the platform owns has no organisation to keep it in, so it is always network
 * wide — both tables check that.
 */
export const courseVisibility = operations.enum("course_visibility", [
  "organization",
  "all_organizations",
  "all_organizations_and_translators",
]);
/**
 * What kind of thing one `operations.skills` row is. Four kinds, because a
 * requirement reads differently for each: a `driving_permit` is a category on a
 * licence, `software` is a tool someone has been shown how to use,
 * `certification` is proof issued by a body, and `skill` is everything else a
 * coordinator needs to know somebody can do.
 *
 * Spoken languages are deliberately absent: `core.languages` already is that
 * vocabulary, and `core.member_languages` / `core.translator_languages` already
 * record who speaks what — a requirement points at a language code directly.
 */
export const skillKind = operations.enum("skill_kind", [
  "skill",
  "software",
  "driving_permit",
  "certification",
]);
/**
 * How badly a mission needs one requirement. `required` is a condition to be
 * there; `preferred` is what a coordinator would like in the group and can do
 * without. Two values, so a screen can sort a gap that blocks above a gap that
 * only costs something.
 */
export const requirementNecessity = operations.enum("requirement_necessity", [
  "required",
  "preferred",
]);
/**
 * What one person's entry is worth — shared by `operations.training_records`
 * and `operations.skill_records`, because the question is the same one. A
 * declaration starts as the person's own word (`self_declared`); a course or
 * skill whose owner requires proof waits at `awaiting_verification` until
 * someone with the qualification permission decides. `expired` is what a
 * validity period turns a verified record into — it stays visible rather than
 * disappearing.
 */
export const trainingRecordState = operations.enum("training_record_state", [
  "self_declared",
  "awaiting_verification",
  "verified",
  "rejected",
  "expired",
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
export const assetTextTrackKind = content.enum("asset_text_track_kind", [
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
/**
 * Who was at the other end. `translator` is a person without an account: they
 * hold a one-time assignment link and act on their own behalf, which is neither
 * a scheduled job (`system`) nor a delivery provider's callback (`provider`), and
 * reading their submissions as "Automatic" would misdescribe every one of them.
 */
export const auditActorType = audit.enum("actor_type", [
  "user",
  "system",
  "provider",
  "support",
  "translator",
]);
/**
 * How the attempt ended. `denied` is the one the security review reads first:
 * the actor was identified, asked for something, and the permission gate said
 * no — a refusal nobody logged is a refusal nobody can count. `failure` is the
 * action's own error (validation, a conflict, a provider timeout), which says
 * something about the system rather than about the actor.
 */
export const auditOutcome = audit.enum("audit_outcome", [
  "success",
  "failure",
  "denied",
]);
/**
 * How loudly one event should read. Derived at write time from what happened,
 * not from who it happened to: `warning` is a refusal or a failed attempt,
 * `critical` is reserved for events that change who can do what — role grants,
 * second-factor changes, support access into an organisation.
 */
export const auditSeverity = audit.enum("audit_severity", [
  "info",
  "warning",
  "critical",
]);

/* Delivery ledger (docs/DATABASE-SCHEMA.md §16) */
export const deliveryChannel = notifications.enum("delivery_channel", [
  "email",
  "sms",
  "push",
  "in_app",
]);
/**
 * What became of one message. `skipped` is a deliberate non-send the platform
 * must still be able to explain — the development log transport, or the
 * anti-enumeration gate that answers a sign-in form the same way whether or not
 * the address is known. `failed` carries the provider's error code.
 */
export const deliveryStatus = notifications.enum("delivery_status", [
  "queued",
  "sent",
  "failed",
  "skipped",
]);
