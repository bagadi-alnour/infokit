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
  organizationId: string;
  email: string;
  kind: "member" | "association_publisher" | "organization_admin";
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
          eq(invitations.organizationId, organizationId),
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
  teamName: string;
  inviterName: string;
}) {
  const { token, expiresAt, resent } = await upsertInvitation({
    organizationId,
    email,
    kind: "member",
    roleIds: [],
    invitedById,
  });

  await sendInvitationEmail({
    email,
    url: invitationUrl(email, token, locale),
    locale,
    organizationName,
    teamName,
    inviterName,
    expiresAt,
  });
  await recordAudit({
    action: resent ? "member.invitation_resent" : "member.invited",
    subjectType: "member",
    subjectId: memberId,
    organizationId,
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

  await sendInvitationEmail({
    email,
    url: invitationUrl(email, token, locale),
    locale,
    organizationName,
    inviterName,
    expiresAt,
  });
  await recordAudit({
    action: resent
      ? "organization.representative_invitation_resent"
      : "organization.representative_invited",
    subjectType: "member",
    subjectId: memberId,
    organizationId,
    metadata: { kind },
  });
}
