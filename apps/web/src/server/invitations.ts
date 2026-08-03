import { createHash, randomBytes } from "node:crypto";

import { brandName, type Locale } from "@infokit/shared/i18n";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";

import { env } from "~/env";
import { localizedPath } from "~/i18n/routing";
import { recordAudit } from "~/server/audit";
import { sendInvitationEmail } from "~/server/auth/aws";
import { db } from "~/server/db";
import {
  invitationRoles,
  invitations,
  organizations,
  roles,
  users,
} from "~/server/db/schema";

/** How long a link lives. Exported so the page that has to explain an expired
 * invitation quotes the real number rather than repeating it in prose. */
export const INVITATION_TTL_DAYS = 14;

/**
 * Only the hash is stored (docs/DATABASE-SCHEMA.md §11), so every lookup by
 * link hashes first and compares hashes. One function, so the write side and
 * the read side cannot drift onto different digests.
 */
export function invitationTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * The roles a platform operator may hand to an invited representative
 * (docs/PHASE-1.3-COLLABORATION.md Flow 1). Platform roles are deliberately
 * absent: an organisation invitation grants access to one organisation, never
 * to the platform.
 */
export const INVITABLE_ROLE_CODES = [
  "organization_admin",
  "organization_editor",
  "organization_publisher",
  "organization_verifier",
] as const;

export type InvitableRoleCode = (typeof INVITABLE_ROLE_CODES)[number];

/**
 * Platform templates that may be assigned inside an organisation. Platform
 * staff and the standalone external-translator role are deliberately absent:
 * those grants live outside a membership and have their own invitation flows.
 *
 * Only roles whose work exists. `document_signatory`, `inventory_manager` and
 * `inventory_finance` are gone from this list because the features behind them
 * are not built — `documents.sign_assigned` and every `inventory.*` permission
 * have no reader anywhere in the app, so granting one changed nothing a member
 * could see. What it did change was the cost of arriving: somebody setting up
 * their first organisation had to rule out three roles before finding the one
 * they wanted, and the access grid carried six actions nobody could perform.
 *
 * The rows stay in `core.roles` (server/db/seed.ts) rather than being deleted.
 * `member_roles` and `permission_review_items` reference them, and a role that
 * is merely not offered is a line in this array away from coming back the day
 * its screens land.
 */
export const ASSIGNABLE_ORGANIZATION_ROLE_CODES = [
  "organization_admin",
  "organization_author",
  "organization_editor",
  "organization_publisher",
  "organization_verifier",
  "organization_translator",
  "translation_reviewer",
  "coordinator",
  "team_lead",
] as const;

export type AssignableOrganizationRoleCode =
  (typeof ASSIGNABLE_ORGANIZATION_ROLE_CODES)[number];

/**
 * The platform roles the superadmin may hand out (`platform.staff.manage`).
 * `platform_superadmin` is absent on purpose: support access and the authority
 * to staff the platform are not delegated by email.
 */
export const INVITABLE_PLATFORM_ROLE_CODES = [
  "platform_content_manager",
  "platform_operator",
] as const;

export type InvitablePlatformRoleCode =
  (typeof INVITABLE_PLATFORM_ROLE_CODES)[number];

/**
 * Only the administrator invitation carries organisation stewardship, so it is
 * the one the claim rule watches for — accepting it hands the record to the
 * organisation and leaves the platform read-only (docs/PRODUCT.md §11.3). The
 * other roles publish and verify inside a record the platform still maintains.
 */
export function invitationKindForRole(role: InvitableRoleCode) {
  return role === "organization_admin"
    ? "organization_admin"
    : "association_publisher";
}

/**
 * Create — or refresh, when one is still pending — the invitation row for an
 * email inside one organisation. Only the token hash is stored
 * (docs/DATABASE-SCHEMA.md §11); the raw token is returned once, for the email
 * link alone. The roles granted on acceptance travel with the invitation, so a
 * refresh replaces them rather than accumulating grants.
 */
async function upsertInvitation({
  organizationId,
  email,
  kind,
  roleIds,
  invitedById,
}: {
  /** Null only for the kinds that lead nowhere near a membership. */
  organizationId: string | null;
  email: string;
  kind:
    | "member"
    | "association_publisher"
    | "organization_admin"
    | "platform_admin";
  roleIds: string[];
  invitedById: string | null;
}) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = invitationTokenHash(token);
  const expiresAt = new Date(
    Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const resent = await db.transaction(async (tx) => {
    const [pending] = await tx
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          organizationId === null
            ? and(
                isNull(invitations.organizationId),
                eq(invitations.kind, kind),
              )
            : eq(invitations.organizationId, organizationId),
          sql`lower(${invitations.email}) = ${email.toLowerCase()}`,
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, new Date()),
        ),
      )
      .limit(1);

    let invitationId = pending?.id;
    if (invitationId) {
      await tx
        .update(invitations)
        .set({ tokenHash, expiresAt, invitedById, kind })
        .where(eq(invitations.id, invitationId));
    } else {
      const [created] = await tx
        .insert(invitations)
        .values({
          organizationId,
          email,
          kind,
          tokenHash,
          invitedById,
          expiresAt,
        })
        .returning({ id: invitations.id });
      if (!created) throw new Error("Invitation insert returned no row");
      invitationId = created.id;
    }

    await tx
      .delete(invitationRoles)
      .where(eq(invitationRoles.invitationId, invitationId));
    if (roleIds.length > 0) {
      await tx
        .insert(invitationRoles)
        .values(roleIds.map((roleId) => ({ invitationId, roleId })))
        .onConflictDoNothing();
    }
    return Boolean(pending);
  });

  return { token, expiresAt, resent };
}

/**
 * The link the invited person opens. It carries the token and nothing else:
 * the invitation page reads who and what from the row the token finds, so the
 * address does not have to travel in a query string that lands in browser
 * history, referrers and proxy logs.
 */
function invitationUrl(token: string, locale: Locale) {
  return `${env.SITE_URL}${localizedPath(`/invite/${token}`, locale)}`;
}

/**
 * Team invitation for a person who may not have an account yet. Acceptance
 * happens on first sign-in with the invited address
 * (`linkPendingMemberships`), because a magic-link login already proves
 * ownership of that address.
 *
 * `teamName` is optional because membership of a city team is: somebody can be
 * added to the association before there is a team to put them on. The email says
 * so — `sendInvitationEmail` picks the organisation-level wording when no team
 * is named, rather than inventing one.
 */
export async function sendMemberInvitation({
  organizationId,
  email,
  memberId,
  invitedById,
  locale,
  organizationName,
  teamName,
  inviterName,
}: {
  organizationId: string;
  email: string;
  memberId: string;
  invitedById: string | null;
  locale: Locale;
  organizationName: string;
  teamName?: string;
  inviterName: string;
}) {
  const { token, expiresAt, resent } = await upsertInvitation({
    organizationId,
    email,
    kind: "member",
    roleIds: [],
    invitedById,
  });

  // The event is written before the send, and its reference travels with the
  // message: "who invited this person" and "did it arrive" become one lookup,
  // and an invitation that never leaves still leaves a record of the attempt.
  const auditEvent = await recordAudit({
    action: resent ? "member.invitation_resent" : "member.invited",
    subjectType: "member",
    subjectId: memberId,
    organizationId,
  });
  await sendInvitationEmail({
    email,
    url: invitationUrl(token, locale),
    locale,
    organizationName,
    teamName,
    inviterName,
    expiresAt,
    organizationId,
    auditEvent,
  });
}

/**
 * Invitation for the organisation's own representative, sent by a platform
 * operator (docs/PHASE-1.3-COLLABORATION.md Flow 1). Unlike a team invitation
 * it carries the roles the person receives on acceptance, because the whole
 * point is the access — there is no public organisation signup.
 */
export async function sendRepresentativeInvitation({
  organizationId,
  email,
  memberId,
  kind,
  roleIds,
  invitedById,
  locale,
  organizationName,
  inviterName,
}: {
  organizationId: string;
  email: string;
  memberId: string;
  kind: "association_publisher" | "organization_admin";
  roleIds: string[];
  invitedById: string | null;
  locale: Locale;
  organizationName: string;
  inviterName: string;
}) {
  const { token, expiresAt, resent } = await upsertInvitation({
    organizationId,
    email,
    kind,
    roleIds,
    invitedById,
  });

  const auditEvent = await recordAudit({
    action: resent
      ? "organization.representative_invitation_resent"
      : "organization.representative_invited",
    subjectType: "member",
    subjectId: memberId,
    organizationId,
    metadata: { kind },
  });
  await sendInvitationEmail({
    email,
    url: invitationUrl(token, locale),
    locale,
    organizationName,
    inviterName,
    expiresAt,
    organizationId,
    auditEvent,
  });
}

/**
 * Invitation for platform staff, sent by an account holding
 * `platform.staff.manage`. It names no organisation and reserves no membership:
 * acceptance grants the invited platform roles globally
 * (`linkPendingMemberships` → `core.user_platform_roles`). The platform is the
 * organisation here, so the email reads as InfoKit's.
 */
export async function sendPlatformStaffInvitation({
  email,
  roleIds,
  invitedById,
  locale,
  inviterName,
}: {
  email: string;
  roleIds: string[];
  invitedById: string | null;
  locale: Locale;
  inviterName: string;
}) {
  if (roleIds.length === 0) {
    throw new Error("A platform staff invitation must grant at least one role");
  }
  const { token, expiresAt, resent } = await upsertInvitation({
    organizationId: null,
    email,
    kind: "platform_admin",
    roleIds,
    invitedById,
  });

  const auditEvent = await recordAudit({
    action: resent
      ? "platform.staff_invitation_resent"
      : "platform.staff_invited",
    subjectType: "platform_staff",
    subjectId: email,
    metadata: { roleIds: roleIds.join(",") },
  });
  await sendInvitationEmail({
    email,
    url: invitationUrl(token, locale),
    locale,
    organizationName: brandName(locale),
    inviterName,
    expiresAt,
    auditEvent,
  });
}

/* ------------------------- reading a link back ------------------------ */

/**
 * Why the invitation page is showing what it is showing. Every reason a link
 * can fail is its own state rather than one "invalid": somebody whose
 * invitation lapsed needs to be told to ask for another, and somebody who
 * already accepted needs to be sent to their console, not to a dead end.
 */
export type InvitationState =
  "open" | "expired" | "revoked" | "accepted" | "unknown";

export interface InvitationView {
  state: InvitationState;
  id: string;
  /** The address the invitation was sent to — the one that can accept it. */
  email: string;
  kind:
    | "member"
    | "association_publisher"
    | "organization_admin"
    | "platform_admin"
    | "translator";
  organizationId: string | null;
  /** Null for the kinds that name no organisation (platform staff, translator). */
  organizationName: string | null;
  /** Role codes the invitation grants on acceptance; empty for a team invite. */
  roleCodes: string[];
  /** Empty when the inviting account has since been removed. */
  inviterName: string;
  expiresAt: Date;
}

/**
 * Resolve an invitation link. Returns null — not a state — when the token
 * matches nothing, so the page cannot accidentally distinguish "never existed"
 * from "malformed" in what it renders.
 *
 * This is the only read keyed by the token, and it grants nothing on its own:
 * possession of the link is enough to *see* who invited you and to what, which
 * the invited person needs before deciding to sign in. Becoming a member still
 * requires proving the address (`acceptInvitationForUser`).
 */
export async function describeInvitationToken(
  token: string,
): Promise<InvitationView | null> {
  // A token is 32 random bytes in base64url. Anything else never hashed to a
  // stored row, so it is not worth a query.
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return null;

  const [row] = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      kind: invitations.kind,
      organizationId: invitations.organizationId,
      organizationName: organizations.displayName,
      inviterName: users.name,
      inviterEmail: users.email,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      revokedAt: invitations.revokedAt,
    })
    .from(invitations)
    .leftJoin(organizations, eq(organizations.id, invitations.organizationId))
    .leftJoin(users, eq(users.id, invitations.invitedById))
    .where(eq(invitations.tokenHash, invitationTokenHash(token)))
    .limit(1);
  if (!row) return null;

  const roleRows = await db
    .select({ code: roles.code })
    .from(invitationRoles)
    .innerJoin(roles, eq(roles.id, invitationRoles.roleId))
    .where(eq(invitationRoles.invitationId, row.id))
    .orderBy(asc(roles.code));

  const state: InvitationState = row.revokedAt
    ? "revoked"
    : row.acceptedAt
      ? "accepted"
      : row.expiresAt.getTime() <= Date.now()
        ? "expired"
        : "open";

  /**
   * Better Auth writes `""` for a magic-link account that never named itself,
   * so an empty name is not a name: it falls through to the address rather
   * than rendering as an empty byline. Both are null when the inviting account
   * has since been removed, and the page drops the line entirely.
   */
  const named = row.inviterName?.trim() ?? "";
  const inviterName = named.length > 0 ? named : (row.inviterEmail ?? "");

  return {
    state,
    id: row.id,
    email: row.email,
    kind: row.kind,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    roleCodes: roleRows.map((role) => role.code),
    inviterName,
    expiresAt: row.expiresAt,
  };
}
