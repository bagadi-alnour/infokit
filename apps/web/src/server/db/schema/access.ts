import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { languages } from "./catalog";
import { organizations } from "./organizations";
import {
  core,
  invitationKind,
  memberStatus,
  permissionReviewDecision,
  permissionReviewState,
  timestamps,
  verificationStatus,
} from "./schemas";
import { translators } from "./translators";

/**
 * Platform verification of an organisation (FR-P1-033, FR-P2-001):
 * duplicate/impersonation review with recorded evidence and decision.
 */
export const organizationVerifications = core.table(
  "organization_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reviewedById: uuid("reviewed_by_id").references(() => users.id),
    method: varchar("method", { length: 100 }),
    status: verificationStatus("status").notNull().default("pending"),
    notes: text("notes"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...timestamps,
  },
);

/**
 * A person inside one organisation (docs/DATABASE-SCHEMA.md §5). Login
 * identity is global (`auth.users`); membership is organisation-scoped.
 * `userId` stays null until the invited person links an account.
 * Phase 1 uses this for invited association publishers; Phase 3 extends
 * it with member types and engagements — additively.
 *
 * Five things identify a member and all five are required: given name, family
 * name, the function they hold, a phone number and an email address. A
 * coordinator calling round a maraude at short notice needs the number, and a
 * roster of half-filled rows is what makes a coverage board unusable — so the
 * columns say so rather than leaving the check to one form. The name is stored
 * in two columns and never as one string: "who is this?" and "how do we sort
 * and address them?" are different questions, and a single field answers
 * neither reliably once the list is long.
 *
 * A member is *not* required to belong to a city team: someone can be on the
 * books before there is a team to put them on (`core.city_team_members` is the
 * optional link, and `/dashboard/team` keeps the unassigned ones in view).
 */
export const organizationMembers = core.table(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    firstName: varchar("first_name", { length: 120 }).notNull(),
    lastName: varchar("last_name", { length: 120 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }).notNull(),
    /**
     * Reachable on the day, so it is stored as typed rather than normalised to
     * E.164: an association writes down the number it actually dials, which may
     * be an extension or a shared duty phone.
     */
    phone: varchar("phone", { length: 40 }).notNull(),
    /** The function inside the association — "Coordination maraude", not a civility. */
    title: varchar("title", { length: 160 }).notNull(),
    status: memberStatus("status").notNull().default("invited"),
    offboardedAt: timestamp("offboarded_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("org_members_org_user_uq")
      .on(t.organizationId, t.userId)
      .where(sql`${t.userId} is not null`),
    unique("org_members_scope_uq").on(t.id, t.organizationId),
    unique("org_members_org_email_uq").on(t.organizationId, t.contactEmail),
  ],
);

/**
 * Languages a member can welcome people in — codes from `core.languages`.
 *
 * The whole catalogue is offered, not the enabled part of it: `enabled` says
 * the platform publishes content in that language, which is a different
 * question from whether somebody speaks it. A member may speak Italian on a
 * site that will never be readable in Italian.
 *
 * What a member can *do* used to live beside this as free text; it is now a
 * selection from the shared catalogue (`operations.skill_records`), so a
 * requirement can be matched by id instead of by spelling. Both stay private to
 * the organisation: public attribution is approved per activity assignment and
 * never derives from these rows.
 */
export const memberLanguages = core.table(
  "member_languages",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => organizationMembers.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.memberId, t.languageCode] })],
);

/**
 * Roles: platform templates (`organizationId` null) or organisation-defined.
 * Permissions stay explicit; job titles alone are insufficient (PRODUCT.md §15).
 */
export const roles = core.table(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    code: varchar("code", { length: 100 }).notNull(),
    description: text("description"),
    /**
     * Whether holding this role makes the SMS step-up mandatory: the holder
     * enrols a number before their first private read and cannot switch the
     * second factor off (RISKS.md R10). It is a property of the role, not of
     * the person — the nature of the role is the whole reason the enrolment
     * page can give, and a role gaining reach later flips one row instead of
     * hunting through accounts.
     */
    requiresSecondFactor: boolean("requires_second_factor")
      .notNull()
      .default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("roles_platform_code_uq")
      .on(t.code)
      .where(sql`${t.organizationId} is null`),
    uniqueIndex("roles_org_code_uq")
      .on(t.organizationId, t.code)
      .where(sql`${t.organizationId} is not null`),
  ],
);

/** Extensible permission catalogue — rows, not enums. */
export const permissions = core.table("permissions", {
  code: varchar("code", { length: 100 }).primaryKey(),
  description: text("description"),
  ...timestamps,
});

export const rolePermissions = core.table(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionCode: varchar("permission_code", { length: 100 })
      .notNull()
      .references(() => permissions.code),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionCode] })],
);

export const memberRoles = core.table(
  "member_roles",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => organizationMembers.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    grantedById: uuid("granted_by_id").references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.memberId, t.roleId] })],
);

/** Global platform-role assignments. Organisation roles stay on memberRoles. */
export const userPlatformRoles = core.table(
  "user_platform_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    grantedById: uuid("granted_by_id").references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

/**
 * Expiring, resendable, revocable invitations (FR-P1-022). Only the token
 * hash is stored — never the raw token (docs/DATABASE-SCHEMA.md §11 habit).
 * State (pending/accepted/expired/revoked) derives from the timestamps.
 *
 * One table for every kind of invitation, because the lifecycle is the same
 * one: a hashed single-use token, an expiry, an acceptance proved by signing in
 * with the invited address. What differs is what acceptance produces: the three
 * organisation kinds link a membership, `translator` opens the person's own
 * space against their `core.translators` row, and `platform_admin` grants
 * platform roles globally. Only the first three name an organisation.
 */
export const invitations = core.table(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    email: varchar("email", { length: 255 }).notNull(),
    kind: invitationKind("kind").notNull().default("association_publisher"),
    tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
    invitedById: uuid("invited_by_id").references(() => users.id),
    /**
     * Set when an invited association publisher/verifier invites a colleague
     * into the same organisation-scoped Phase 1 workflow (Phase 1.3); null for
     * invitations created by a platform operator. Records the invitation chain
     * and lets the per-organisation colleague cap be enforced by counting
     * (docs/PHASE-1.3-COLLABORATION.md).
     */
    invitedByMemberId: uuid("invited_by_member_id").references(
      () => organizationMembers.id,
    ),
    /**
     * The directory entry a `translator` invitation belongs to — created first,
     * status `invited`, the same way a team invitation is preceded by its member
     * row. Accepting links that row's `userId`; it grants no membership.
     */
    translatorId: uuid("translator_id").references(() => translators.id, {
      onDelete: "cascade",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    acceptedMemberId: uuid("accepted_member_id").references(
      () => organizationMembers.id,
    ),
    ...timestamps,
  },
  (t) => [
    /**
     * Every invitation names what it leads to: an organisation for the three
     * membership kinds, a translator entry for `translator`, and neither for
     * platform staff. An organisation may still invite its own translator, so
     * `organizationId` stays allowed alongside a translator entry.
     */
    check(
      "invitations_target_check",
      sql`case
        when ${t.kind} = 'translator' then ${t.translatorId} is not null
        when ${t.kind} = 'platform_admin' then ${t.translatorId} is null and ${t.organizationId} is null
        else ${t.translatorId} is null and ${t.organizationId} is not null
      end`,
    ),
  ],
);

/**
 * A periodic re-check that the people holding permissions inside one workspace
 * still need them (FR-P2-011).
 *
 * The reason this is a table and not a report: permissions decay quietly. Someone
 * is made a publisher for one campaign and stays one for two years; a volunteer
 * leaves and nobody thinks to remove the role because nothing breaks when it
 * stays. A review is a dated, attributable pass over the current grants, and what
 * makes it worth anything is the record that it happened — including a review
 * that was opened and never finished, which is exactly what the `open` state and
 * `due_on` are for.
 */
export const permissionReviews = core.table(
  "permission_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    state: permissionReviewState("state").notNull().default("open"),
    /** When this pass should have been finished by. */
    dueOn: date("due_on"),
    /**
     * Who is answerable for the pass. Null while it is scheduled and unclaimed —
     * an unassigned overdue review is a finding in its own right.
     */
    assignedToMemberId: uuid("assigned_to_member_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedById: uuid("completed_by_id").references(() => users.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** What the reviewer concluded overall. Never personal data about members. */
    summary: text("summary"),
    ...timestamps,
  },
  (t) => [
    check(
      "permission_reviews_completion_check",
      sql`(${t.state} = 'completed' and ${t.completedAt} is not null) or ${t.state} <> 'completed'`,
    ),
    // One live pass per organisation: two open reviews of the same grants produce
    // two different answers about the same day.
    uniqueIndex("permission_reviews_open_uq")
      .on(t.organizationId)
      .where(sql`${t.state} in ('open', 'in_progress')`),
    unique("permission_reviews_scope_uq").on(t.id, t.organizationId),
    foreignKey({
      name: "permission_reviews_assignee_scope_fk",
      columns: [t.assignedToMemberId, t.organizationId],
      foreignColumns: [
        organizationMembers.id,
        organizationMembers.organizationId,
      ],
    }).onDelete("set null"),
    index("permission_reviews_state_due_idx").on(t.state, t.dueOn),
  ],
);

/**
 * One role assignment looked at during a review, and what was decided about it.
 *
 * The row is written when the review opens — a snapshot of who held what on that
 * day — so a grant removed mid-review still shows as having been examined. That is
 * why the role and member are recorded here rather than read back from
 * `member_roles` at completion time: the point of the record is what was true
 * when the reviewer looked.
 *
 * `revoke` is a decision, not the act. Applying it deletes the `member_roles` row
 * and writes an audit event; this row keeps the reason.
 */
export const permissionReviewItems = core.table(
  "permission_review_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    decision: permissionReviewDecision("decision").notNull().default("pending"),
    /** Why the grant was kept or removed — the sentence a later review reads. */
    note: text("note"),
    decidedById: uuid("decided_by_id").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    /** Set once a `revoke` has actually been carried out. */
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "permission_review_items_review_scope_fk",
      columns: [t.reviewId, t.organizationId],
      foreignColumns: [permissionReviews.id, permissionReviews.organizationId],
    }).onDelete("cascade"),
    // The member under review must belong to the organisation being reviewed;
    // `restrict` because deleting the membership would erase the evidence that
    // its permissions were examined.
    foreignKey({
      name: "permission_review_items_member_scope_fk",
      columns: [t.memberId, t.organizationId],
      foreignColumns: [
        organizationMembers.id,
        organizationMembers.organizationId,
      ],
    }).onDelete("restrict"),
    uniqueIndex("permission_review_items_review_grant_uq").on(
      t.reviewId,
      t.memberId,
      t.roleId,
    ),
    check(
      "permission_review_items_decision_check",
      sql`(${t.decision} = 'pending' and ${t.decidedAt} is null) or (${t.decision} <> 'pending' and ${t.decidedAt} is not null and ${t.decidedById} is not null)`,
    ),
    // Only a revocation is ever carried out, so only a revocation can be applied.
    check(
      "permission_review_items_applied_check",
      sql`${t.appliedAt} is null or ${t.decision} = 'revoke'`,
    ),
    // The reviewer's screen: the undecided ones first.
    index("permission_review_items_review_decision_idx").on(
      t.reviewId,
      t.decision,
    ),
  ],
);

/** Roles granted when the invitation is accepted. */
export const invitationRoles = core.table(
  "invitation_roles",
  {
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
  },
  (t) => [primaryKey({ columns: [t.invitationId, t.roleId] })],
);

/**
 * Versioned privacy notice / terms / publishing responsibilities, and the
 * evidence that a user accepted a specific version (Journey P1-D step 2).
 */
export const legalDocuments = core.table(
  "legal_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: varchar("kind", { length: 100 }).notNull(),
    version: varchar("version", { length: 50 }).notNull(),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    body: text("body").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("legal_documents_kind_version_lang_uq").on(
      t.kind,
      t.version,
      t.languageCode,
    ),
  ],
);

export const legalAcceptances = core.table(
  "legal_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    organizationId: uuid("organization_id").references(() => organizations.id),
    legalDocumentId: uuid("legal_document_id")
      .notNull()
      .references(() => legalDocuments.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("legal_acceptances_user_doc_uq").on(
      t.userId,
      t.legalDocumentId,
    ),
  ],
);
