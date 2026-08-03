import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";

import { env } from "~/env";
import { recordAudit } from "~/server/audit";
import { db } from "~/server/db";
import {
  invitationRoles,
  invitations,
  memberRoles,
  organizationMembers,
  organizations,
  rolePermissions,
  roles,
  translators,
  userPlatformRoles,
} from "~/server/db/schema";

/**
 * The invitation kinds that lead to a membership inside one organisation. The
 * other two do not: `translator` opens the person's own space and
 * `platform_admin` grants platform roles globally, each handled below.
 */
const MEMBERSHIP_INVITATION_KINDS = [
  "association_publisher",
  "organization_admin",
  "member",
] as const;

/** The platform role template an activated translator receives (`seed.ts`). */
const TRANSLATOR_ROLE = "translator";

/** Permission that marks a member as able to steward the whole organisation. */
const ORG_STEWARD_PERMISSION = "organization.profile.manage";

/**
 * Mark an organisation claimed the first time one of its stewards links an
 * account. After this, platform admins are read-only for the organisation and
 * its own members maintain its data.
 */
export async function claimOrganizationIfSteward(
  memberId: string,
  organizationId: string,
) {
  const [steward] = await db
    .select({ permissionCode: rolePermissions.permissionCode })
    .from(memberRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, memberRoles.roleId))
    .where(
      and(
        eq(memberRoles.memberId, memberId),
        eq(rolePermissions.permissionCode, ORG_STEWARD_PERMISSION),
      ),
    )
    .limit(1);
  if (!steward) return;
  const claimed = await db
    .update(organizations)
    .set({ claimedAt: new Date() })
    .where(
      and(
        eq(organizations.id, organizationId),
        isNull(organizations.claimedAt),
      ),
    )
    .returning({ id: organizations.id });
  // A claim turns every platform admin read-only for this organisation, so the
  // moment it happened is the answer to "why can I no longer edit this".
  if (claimed.length > 0) {
    await recordAudit({
      action: "organization.claimed",
      subjectType: "organization",
      subjectId: organizationId,
      organizationId,
      severity: "critical",
      metadata: { memberId },
    });
  }
}

/**
 * Grant the roles an accepted invitation promised. The roles ride on the
 * invitation rather than on the reserved membership, so an invitation that is
 * revoked or left to expire never becomes access
 * (docs/PHASE-1.3-COLLABORATION.md Flow 1).
 */
async function grantInvitedRoles(memberId: string, invitationIds: string[]) {
  if (invitationIds.length === 0) return 0;
  const granted = await db
    .select({ roleId: invitationRoles.roleId })
    .from(invitationRoles)
    .where(inArray(invitationRoles.invitationId, invitationIds));
  if (granted.length === 0) return 0;
  const rows = await db
    .insert(memberRoles)
    .values(granted.map(({ roleId }) => ({ memberId, roleId })))
    .onConflictDoNothing()
    .returning({ roleId: memberRoles.roleId });
  return rows.length;
}

/**
 * A live invitation of one kind for the address that just signed in. Acceptance
 * is the same proof for every kind — a magic-link sign-in, or a session already
 * holding the verified address — so the predicate is shared.
 */
function pendingInvitationsOfKind(
  kind: "translator" | "platform_admin",
  normalizedEmail: string,
  now: Date,
) {
  return and(
    sql`lower(${invitations.email}) = ${normalizedEmail}`,
    eq(invitations.kind, kind),
    isNull(invitations.acceptedAt),
    isNull(invitations.revokedAt),
    gt(invitations.expiresAt, now),
  );
}

/**
 * Platform staff invited by the superadmin (`platform.staff.manage`). The roles
 * ride on the invitation exactly as they do for an organisation representative,
 * but they land in `core.user_platform_roles`: platform work is global, and
 * there is no membership to hang it on.
 */
async function acceptPlatformStaffInvitations({
  userId,
  normalizedEmail,
  now,
}: {
  userId: string;
  normalizedEmail: string;
  now: Date;
}) {
  const accepted = await db
    .update(invitations)
    .set({ acceptedAt: now })
    .where(pendingInvitationsOfKind("platform_admin", normalizedEmail, now))
    .returning({ id: invitations.id });
  if (accepted.length === 0) return;

  const granted = await db
    .select({ roleId: invitationRoles.roleId })
    .from(invitationRoles)
    .where(
      inArray(
        invitationRoles.invitationId,
        accepted.map((row) => row.id),
      ),
    );
  if (granted.length === 0) return;
  const rows = await db
    .insert(userPlatformRoles)
    .values(granted.map(({ roleId }) => ({ userId, roleId })))
    .onConflictDoNothing()
    .returning({ roleId: userPlatformRoles.roleId });
  // Platform roles are the widest grant the system makes, and this is the one
  // path that hands them out without an operator pressing anything: the actor is
  // named explicitly because the session is still being established.
  await recordAudit({
    action: "platform.staff_invitation_accepted",
    subjectType: "auth.user",
    subjectId: userId,
    actorUserId: userId,
    severity: "critical",
    metadata: { invitations: accepted.length, rolesGranted: rows.length },
  });
}

/**
 * Open an invited translator's own space: link their `core.translators` entry
 * to the account that just proved the invited address, and grant the platform
 * `translator` role that lets them read the assignments addressed to that entry.
 * No membership is created — a translator belongs to no organisation.
 */
async function acceptTranslatorInvitations({
  userId,
  normalizedEmail,
  now,
}: {
  userId: string;
  normalizedEmail: string;
  now: Date;
}) {
  const accepted = await db
    .update(invitations)
    .set({ acceptedAt: now })
    .where(pendingInvitationsOfKind("translator", normalizedEmail, now))
    .returning({ translatorId: invitations.translatorId });
  const translatorIds = accepted
    .map((row) => row.translatorId)
    .filter((id): id is string => id !== null);
  if (translatorIds.length === 0) return;

  /** Activation is one-way: a second invitation never reassigns the entry. */
  const linked = await db
    .update(translators)
    .set({ userId, status: "active", activatedAt: now, deactivatedAt: null })
    .where(
      and(inArray(translators.id, translatorIds), isNull(translators.userId)),
    )
    .returning({ id: translators.id });
  if (linked.length === 0) return;

  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.code, TRANSLATOR_ROLE), isNull(roles.organizationId)))
    .limit(1);
  if (!role) return;
  await db
    .insert(userPlatformRoles)
    .values({ userId, roleId: role.id })
    .onConflictDoNothing();
  await recordAudit({
    action: "translator.invitation_accepted",
    subjectType: "translator",
    subjectId: linked[0]?.id ?? null,
    actorUserId: userId,
    severity: "critical",
    metadata: { entries: linked.length },
  });
}

/**
 * Connect email-first member records when the invited person authenticates.
 * Assignments already point at the stable membership row, so their teams and
 * activities become available without copying or recreating anything. The
 * matching pending invitations are marked accepted at the same moment — a
 * magic-link sign-in already proves ownership of the invited address — and the
 * roles they carry are granted then, never before.
 *
 * An invitation is its own reason to link: an organisation representative
 * invited by a platform operator is Phase 1.3 work and must not wait on the
 * Phase 3 flag, which only governs email-first memberships created by team
 * management.
 */
export async function linkPendingMemberships({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;
  const now = new Date();

  await acceptPlatformStaffInvitations({ userId, normalizedEmail, now });
  await acceptTranslatorInvitations({ userId, normalizedEmail, now });

  const invitedEmail = and(
    sql`lower(${invitations.email}) = ${normalizedEmail}`,
    inArray(invitations.kind, [...MEMBERSHIP_INVITATION_KINDS]),
    isNull(invitations.acceptedAt),
    isNull(invitations.revokedAt),
    gt(invitations.expiresAt, now),
  );
  const pending = await db
    .selectDistinct({ organizationId: invitations.organizationId })
    .from(invitations)
    .where(invitedEmail);
  const invitedOrganizationIds = pending
    .map((row) => row.organizationId)
    .filter((id): id is string => id !== null);
  const teamManagement = env.ENABLE_PHASE3_MEMBER_ASSIGNMENTS;
  if (!teamManagement && invitedOrganizationIds.length === 0) return;

  const linked = await db
    .update(organizationMembers)
    .set({ userId, status: "active" })
    .where(
      and(
        isNull(organizationMembers.userId),
        sql`lower(${organizationMembers.contactEmail}) = ${normalizedEmail}`,
        teamManagement
          ? undefined
          : inArray(organizationMembers.organizationId, invitedOrganizationIds),
      ),
    )
    .returning({
      id: organizationMembers.id,
      organizationId: organizationMembers.organizationId,
    });
  for (const member of linked) {
    const accepted = await db
      .update(invitations)
      .set({ acceptedAt: now, acceptedMemberId: member.id })
      .where(
        and(
          eq(invitations.organizationId, member.organizationId),
          invitedEmail,
        ),
      )
      .returning({ id: invitations.id });
    const rolesGranted = await grantInvitedRoles(
      member.id,
      accepted.map((row) => row.id),
    );
    // Signing in is one event; becoming a member of an organisation with roles
    // attached is another, and it is the one that changed what this account may
    // do. Critical for the same reason a console role grant is.
    await recordAudit({
      action: "member.invitation_accepted",
      subjectType: "member",
      subjectId: member.id,
      organizationId: member.organizationId,
      actorUserId: userId,
      severity: "critical",
      metadata: { invitations: accepted.length, rolesGranted },
    });
    await claimOrganizationIfSteward(member.id, member.organizationId);
  }
}

/** Why an accept-in-place attempt did not become access. */
export type AcceptInvitationResult =
  | { ok: true; organizationId: string | null }
  | { ok: false; reason: "not_open" | "wrong_address" | "no_membership" };

/**
 * Accept one invitation on behalf of an account that is **already** signed in.
 *
 * The session hook covers the person who signs in *because* of the link; this
 * covers the one who was already signed in when it arrived — a colleague
 * invited to a second organisation, or anyone who opened the link in a browser
 * that still had a session. Without it their invitation sits pending until they
 * happen to sign out and back in.
 *
 * The proof is the same one the session hook relies on, checked here rather
 * than assumed: the session's address must be the invited address. Holding the
 * link is not enough — it is what lets someone *see* the invitation, never what
 * grants it.
 */
export async function acceptInvitationForUser({
  invitationId,
  userId,
  email,
}: {
  invitationId: string;
  userId: string;
  email: string;
}): Promise<AcceptInvitationResult> {
  const now = new Date();
  const normalizedEmail = email.trim().toLowerCase();

  const [invitation] = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      kind: invitations.kind,
      organizationId: invitations.organizationId,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.id, invitationId),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, now),
      ),
    )
    .limit(1);
  if (!invitation) return { ok: false, reason: "not_open" };
  if (invitation.email.trim().toLowerCase() !== normalizedEmail) {
    return { ok: false, reason: "wrong_address" };
  }

  /**
   * The two kinds that hang off no membership are already keyed by address
   * alone, and their handlers are idempotent, so the sign-in path is also the
   * accept-in-place path for them.
   */
  if (
    invitation.kind === "platform_admin" ||
    invitation.kind === "translator"
  ) {
    await linkPendingMemberships({ userId, email });
    return { ok: true, organizationId: null };
  }

  const organizationId = invitation.organizationId;
  if (!organizationId) return { ok: false, reason: "not_open" };

  /**
   * The reserved row, whether it is still waiting for an account or already
   * belongs to this one. Both are acceptances: somebody invited again into an
   * organisation they are already on the roster of is being granted the roles
   * this invitation carries, not being made a member twice.
   */
  const [member] = await db
    .select({ id: organizationMembers.id, userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        sql`lower(${organizationMembers.contactEmail}) = ${normalizedEmail}`,
        or(
          isNull(organizationMembers.userId),
          eq(organizationMembers.userId, userId),
        ),
      ),
    )
    .limit(1);
  if (!member) return { ok: false, reason: "no_membership" };

  if (!member.userId) {
    await db
      .update(organizationMembers)
      .set({ userId, status: "active" })
      .where(
        and(
          eq(organizationMembers.id, member.id),
          isNull(organizationMembers.userId),
        ),
      );
  }

  // Conditional on still being open, so two tabs pressing accept grant the
  // roles once and audit it once.
  const accepted = await db
    .update(invitations)
    .set({ acceptedAt: now, acceptedMemberId: member.id })
    .where(
      and(
        eq(invitations.id, invitation.id),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
      ),
    )
    .returning({ id: invitations.id });
  if (accepted.length === 0) return { ok: false, reason: "not_open" };

  const rolesGranted = await grantInvitedRoles(member.id, [invitation.id]);
  await recordAudit({
    action: "member.invitation_accepted",
    subjectType: "member",
    subjectId: member.id,
    organizationId,
    actorUserId: userId,
    severity: "critical",
    metadata: { invitations: 1, rolesGranted, acceptedInSession: true },
  });
  await claimOrganizationIfSteward(member.id, organizationId);
  return { ok: true, organizationId };
}
