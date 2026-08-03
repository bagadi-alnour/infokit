"use server";

import { brandName, type Locale } from "@infokit/shared/i18n";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import { recordAudit } from "~/server/audit";
import { platformStaffPermission } from "~/server/auth/authorization";
import { protectedPermissionAction } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  invitations,
  roles,
  sessions,
  userPlatformRoles,
  users,
} from "~/server/db/schema";
import {
  INVITABLE_PLATFORM_ROLE_CODES,
  sendPlatformStaffInvitation,
} from "~/server/invitations";

const roleCodeSchema = z.enum(INVITABLE_PLATFORM_ROLE_CODES);
const emailSchema = z.string().trim().toLowerCase().email().max(255);
const uuidSchema = z.string().uuid();

function refresh(locale: Locale) {
  revalidatePath(localizedPath("/dashboard/staff", locale));
}

/** The platform-defined (organisation-agnostic) template for a role code. */
async function requirePlatformRole(code: string) {
  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.code, code), isNull(roles.organizationId)))
    .limit(1);
  if (!role) throw new Error(`Role ${code} is not seeded`);
  return role;
}

/**
 * Resolve the target before a staff-management action.
 *
 * The signed-in administrator and every bootstrap superadmin are protected:
 * changing either from this page could remove the only grant capable of
 * repairing platform access.
 */
async function requireMutablePlatformStaff(userId: string, actorId: string) {
  if (userId === actorId) {
    throw new Error("You cannot change your own platform access");
  }
  const grants = await db
    .select({ roleId: roles.id, roleCode: roles.code })
    .from(userPlatformRoles)
    .innerJoin(roles, eq(roles.id, userPlatformRoles.roleId))
    .where(
      and(eq(userPlatformRoles.userId, userId), isNull(roles.organizationId)),
    );
  if (grants.length === 0) throw new Error("No platform staff record");
  if (grants.some((grant) => grant.roleCode === "platform_superadmin")) {
    throw new Error("Bootstrap platform access cannot be changed here");
  }
  return grants;
}

/**
 * Invite somebody onto the platform's own staff.
 *
 * One role per invitation, named by code, from the two codes that may be handed
 * out this way: `platform_superadmin` is deliberately not among them
 * (`INVITABLE_PLATFORM_ROLE_CODES`) — support access is granted by the bootstrap,
 * not by a form.
 *
 * When the address already has an account there is nothing left to prove, so the
 * role is granted on the spot; otherwise the invitation is what turns into
 * access, and the grant rides on it until accepted. Both paths are audited as
 * critical: this is the widest grant the console makes.
 */
export const invitePlatformStaff = protectedPermissionAction(
  platformStaffPermission,
  async (formData, locale, user) => {
    const email = emailSchema.parse(formData.get("email"));
    const roleCode = roleCodeSchema.parse(formData.get("roleCode"));
    const role = await requirePlatformRole(roleCode);

    const [account] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    if (account) {
      const granted = await db
        .insert(userPlatformRoles)
        .values({
          userId: account.id,
          roleId: role.id,
          grantedById: user.id,
        })
        .onConflictDoNothing()
        .returning({ roleId: userPlatformRoles.roleId });
      await recordAudit({
        action: "platform.staff_granted",
        subjectType: "auth.user",
        subjectId: account.id,
        severity: "critical",
        metadata: { role: roleCode, granted: granted.length > 0 },
      });
    } else {
      await sendPlatformStaffInvitation({
        email,
        roleIds: [role.id],
        invitedById: user.id,
        locale,
        inviterName: user.name.trim() || user.email.trim() || brandName(locale),
      });
    }
    refresh(locale);
  },
);

/**
 * Withdraw a pending staff invitation. Nothing was granted yet — the roles ride
 * on the invitation — so this is the whole of the undo. Somebody who already
 * signed in holds their roles directly and is removed below instead.
 */
export const revokePlatformStaffInvitation = protectedPermissionAction(
  platformStaffPermission,
  async (formData, locale) => {
    const invitationId = uuidSchema.parse(formData.get("invitationId"));
    const [invitation] = await db
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.kind, "platform_admin"),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      )
      .returning({ email: invitations.email });
    if (!invitation) throw new Error("No pending invitation to revoke");

    await recordAudit({
      action: "platform.staff_invitation_revoked",
      subjectType: "platform_staff",
      subjectId: invitation.email,
      severity: "critical",
    });
    refresh(locale);
  },
);

/**
 * Take a platform role back off an account.
 *
 * Never your own: an administrator who can remove their own last grant can lock
 * the platform out of itself, and the recovery from that is a database console.
 * Offboarding somebody else is what this is for, and the trail records it as
 * critical the same way granting does.
 */
export const revokePlatformStaffRole = protectedPermissionAction(
  platformStaffPermission,
  async (formData, locale, user) => {
    const userId = uuidSchema.parse(formData.get("userId"));
    const roleId = uuidSchema.parse(formData.get("roleId"));
    await requireMutablePlatformStaff(userId, user.id);

    const removed = await db
      .delete(userPlatformRoles)
      .where(
        and(
          eq(userPlatformRoles.userId, userId),
          eq(userPlatformRoles.roleId, roleId),
        ),
      )
      .returning({ roleId: userPlatformRoles.roleId });
    if (removed.length === 0) throw new Error("No such platform grant");

    await recordAudit({
      action: "platform.staff_revoked",
      subjectType: "auth.user",
      subjectId: userId,
      severity: "critical",
      metadata: { roleId },
    });
    refresh(locale);
  },
);

/** Replace every delegable platform grant on one staff account with one role. */
export const changePlatformStaffRole = protectedPermissionAction(
  platformStaffPermission,
  async (formData, locale, user) => {
    const userId = uuidSchema.parse(formData.get("userId"));
    const roleCode = roleCodeSchema.parse(formData.get("roleCode"));
    const previous = await requireMutablePlatformStaff(userId, user.id);
    const role = await requirePlatformRole(roleCode);

    await db.transaction(async (tx) => {
      await tx
        .delete(userPlatformRoles)
        .where(eq(userPlatformRoles.userId, userId));
      await tx.insert(userPlatformRoles).values({
        userId,
        roleId: role.id,
        grantedById: user.id,
      });
    });

    await recordAudit({
      action: "platform.staff_role_changed",
      subjectType: "auth.user",
      subjectId: userId,
      severity: "critical",
      metadata: {
        from: previous.map((grant) => grant.roleCode).join(","),
        to: roleCode,
      },
    });
    refresh(locale);
  },
);

/**
 * End every current session without changing grants. The person may sign in
 * again; this is the immediate response to a lost device or suspicious session.
 */
export const revokePlatformStaffAccess = protectedPermissionAction(
  platformStaffPermission,
  async (formData, locale, user) => {
    const userId = uuidSchema.parse(formData.get("userId"));
    await requireMutablePlatformStaff(userId, user.id);

    const revoked = await db
      .delete(sessions)
      .where(eq(sessions.userId, userId))
      .returning({ id: sessions.id });

    await recordAudit({
      action: "platform.staff_sessions_revoked",
      subjectType: "auth.user",
      subjectId: userId,
      severity: "critical",
      metadata: { sessions: revoked.length },
    });
    refresh(locale);
  },
);

/**
 * Suspend platform access while retaining the staff record and its role names.
 * Authorization already treats an expired grant as inactive.
 */
export const disablePlatformStaffAccess = protectedPermissionAction(
  platformStaffPermission,
  async (formData, locale, user) => {
    const userId = uuidSchema.parse(formData.get("userId"));
    await requireMutablePlatformStaff(userId, user.id);
    const disabledAt = new Date();

    const disabled = await db.transaction(async (tx) => {
      const grants = await tx
        .update(userPlatformRoles)
        .set({ expiresAt: disabledAt })
        .where(eq(userPlatformRoles.userId, userId))
        .returning({ roleId: userPlatformRoles.roleId });
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      return grants;
    });
    if (disabled.length === 0) throw new Error("No platform grants to disable");

    await recordAudit({
      action: "platform.staff_access_disabled",
      subjectType: "auth.user",
      subjectId: userId,
      severity: "critical",
      metadata: {
        disabledAt: disabledAt.toISOString(),
        roles: disabled.map((grant) => grant.roleId).join(","),
      },
    });
    refresh(locale);
  },
);

/** Restore a suspended staff record by making its retained grants current. */
export const enablePlatformStaffAccess = protectedPermissionAction(
  platformStaffPermission,
  async (formData, locale, user) => {
    const userId = uuidSchema.parse(formData.get("userId"));
    await requireMutablePlatformStaff(userId, user.id);

    const enabled = await db
      .update(userPlatformRoles)
      .set({ expiresAt: null })
      .where(eq(userPlatformRoles.userId, userId))
      .returning({ roleId: userPlatformRoles.roleId });
    if (enabled.length === 0) throw new Error("No platform grants to enable");

    await recordAudit({
      action: "platform.staff_access_enabled",
      subjectType: "auth.user",
      subjectId: userId,
      severity: "critical",
      metadata: { roles: enabled.map((grant) => grant.roleId).join(",") },
    });
    refresh(locale);
  },
);

/** Remove the person from platform staff and end any session they still hold. */
export const removePlatformStaff = protectedPermissionAction(
  platformStaffPermission,
  async (formData, locale, user) => {
    const userId = uuidSchema.parse(formData.get("userId"));
    const previous = await requireMutablePlatformStaff(userId, user.id);

    const removed = await db.transaction(async (tx) => {
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      return tx
        .delete(userPlatformRoles)
        .where(eq(userPlatformRoles.userId, userId))
        .returning({ roleId: userPlatformRoles.roleId });
    });
    if (removed.length === 0) throw new Error("No platform staff record");

    await recordAudit({
      action: "platform.staff_removed",
      subjectType: "auth.user",
      subjectId: userId,
      severity: "critical",
      metadata: { roles: previous.map((grant) => grant.roleCode).join(",") },
    });
    refresh(locale);
  },
);
