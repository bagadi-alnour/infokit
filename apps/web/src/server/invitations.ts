import { createHash, randomBytes } from "node:crypto";

import type { Locale } from "@infokit/shared/i18n";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { env } from "~/env";
import { localizedPath } from "~/i18n/routing";
import { recordAudit } from "~/server/audit";
import { sendInvitationEmail } from "~/server/auth/aws";
import { db } from "~/server/db";
import { invitationRoles, invitations } from "~/server/db/schema";

const INVITATION_TTL_DAYS = 14;

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
  const tokenHash = createHash("sha256").update(token).digest("hex");
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

function invitationUrl(email: string, token: string, locale: Locale) {
  return `${env.SITE_URL}${localizedPath("/login", locale)}?email=${encodeURIComponent(email)}&invite=${token}`;
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
    url: invitationUrl(email, token, locale),
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
    url: invitationUrl(email, token, locale),
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
    url: invitationUrl(email, token, locale),
    locale,
    organizationName: "InfoKit",
    inviterName,
    expiresAt,
    auditEvent,
  });
}
