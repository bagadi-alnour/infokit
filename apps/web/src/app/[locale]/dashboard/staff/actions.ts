"use server";

import type { Locale } from "@infokit/shared/i18n";
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
        inviterName: user.name ?? user.email ?? "InfoKit",
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
    if (userId === user.id) {
      throw new Error("You cannot remove your own platform role");
    }

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
