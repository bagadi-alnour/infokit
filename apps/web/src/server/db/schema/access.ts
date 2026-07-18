import { sql } from "drizzle-orm";
import {
  date,
  primaryKey,
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
  core,
  invitationKind,
  memberStatus,
  timestamps,
  verificationStatus,
} from "./schemas";

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
    reviewedById: varchar("reviewed_by_id", { length: 255 }).references(
      () => users.id,
    ),
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
 */
export const organizationMembers = core.table(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 }).references(() => users.id),
    displayName: varchar("display_name", { length: 200 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }),
    status: memberStatus("status").notNull().default("invited"),
    offboardedAt: timestamp("offboarded_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("org_members_org_user_uq")
      .on(t.organizationId, t.userId)
      .where(sql`${t.userId} is not null`),
  ],
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
    grantedById: varchar("granted_by_id", { length: 255 }).references(
      () => users.id,
    ),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.memberId, t.roleId] })],
);

/**
 * Expiring, resendable, revocable invitations (FR-P1-022). Only the token
 * hash is stored — never the raw token (docs/DATABASE-SCHEMA.md §11 habit).
 * State (pending/accepted/expired/revoked) derives from the timestamps.
 */
export const invitations = core.table("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  kind: invitationKind("kind").notNull().default("association_publisher"),
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
  invitedById: varchar("invited_by_id", { length: 255 }).references(
    () => users.id,
  ),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  acceptedMemberId: uuid("accepted_member_id").references(
    () => organizationMembers.id,
  ),
  ...timestamps,
});

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
    userId: varchar("user_id", { length: 255 })
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
