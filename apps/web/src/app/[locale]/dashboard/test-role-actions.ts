"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  hasActualPlatformPermission,
  superadminPermission,
} from "~/server/auth/authorization";
import { requireEditor } from "~/server/auth/require";
import { currentSessionTokenHash } from "~/server/auth/session-token";
import { db } from "~/server/db";
import {
  auditEvents,
  organizations,
  roles,
  roleTestContextRoles,
  roleTestContexts,
} from "~/server/db/schema";

async function requireSuperadminSession(locale: FormDataEntryValue | null) {
  const localeValue = typeof locale === "string" ? locale : undefined;
  const user = await requireEditor(
    localeValue === "en" || localeValue === "ar" || localeValue === "fr"
      ? localeValue
      : undefined,
  );
  const allowed = await hasActualPlatformPermission(
    user.id,
    superadminPermission,
  );
  const sessionToken = await currentSessionTokenHash();
  if (!allowed || !sessionToken) throw new Error("Forbidden");
  return { user, sessionToken };
}

export async function assumeTestRole(formData: FormData) {
  const { user, sessionToken } = await requireSuperadminSession(
    formData.get("locale"),
  );
  const roleIds = [
    ...new Set(
      formData
        .getAll("roleIds")
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  const organizationIdValue = formData.get("organizationId");
  const organizationId =
    typeof organizationIdValue === "string" && organizationIdValue
      ? organizationIdValue
      : null;
  if (roleIds.length === 0) throw new Error("Select at least one role");

  const selectedRoleRows = await db
    .select({ id: roles.id, code: roles.code })
    .from(roles)
    .where(and(inArray(roles.id, roleIds), isNull(roles.organizationId)));
  if (selectedRoleRows.length !== roleIds.length) {
    throw new Error("Invalid test role");
  }
  const roleById = new Map(selectedRoleRows.map((role) => [role.id, role]));
  const orderedRoles = roleIds.flatMap((roleId) => {
    const role = roleById.get(roleId);
    return role ? [role] : [];
  });
  const selectedRoles =
    orderedRoles.length > 1
      ? orderedRoles.filter((role) => role.code !== "platform_superadmin")
      : orderedRoles;

  // The real superadmin role is represented by the absence of a test context.
  // Selecting it from the complete role list therefore exits test mode rather
  // than creating a context that could outlive the actor's actual grant.
  if (
    selectedRoles.length === 1 &&
    selectedRoles[0]?.code === "platform_superadmin"
  ) {
    await db.transaction(async (tx) => {
      await tx
        .delete(roleTestContexts)
        .where(
          and(
            eq(roleTestContexts.sessionToken, sessionToken),
            eq(roleTestContexts.actorUserId, user.id),
          ),
        );
      await tx.insert(auditEvents).values({
        actorUserId: user.id,
        action: "support.role_test.exited",
        subjectType: "auth.session",
        metadata: { selectedRoleCode: "platform_superadmin" },
      });
    });
    revalidatePath("/", "layout");
    return;
  }
  const primaryRole = selectedRoles[0];
  if (!primaryRole) throw new Error("Select at least one test role");

  const needsOrganization = selectedRoles.some(
    (role) => !role.code.startsWith("platform_"),
  );
  const contextOrganizationId = needsOrganization ? organizationId : null;
  if (needsOrganization) {
    if (!organizationId) throw new Error("An organisation is required");
    const [organization] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    if (!organization) throw new Error("Invalid organisation");
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(roleTestContexts)
      .values({
        sessionToken,
        actorUserId: user.id,
        roleId: primaryRole.id,
        organizationId: contextOrganizationId,
      })
      .onConflictDoUpdate({
        target: roleTestContexts.sessionToken,
        set: {
          actorUserId: user.id,
          roleId: primaryRole.id,
          organizationId: contextOrganizationId,
          updatedAt: new Date(),
        },
      });
    await tx
      .delete(roleTestContextRoles)
      .where(eq(roleTestContextRoles.sessionToken, sessionToken));
    await tx.insert(roleTestContextRoles).values(
      selectedRoles.map((role) => ({
        sessionToken,
        roleId: role.id,
      })),
    );
    await tx.insert(auditEvents).values({
      actorUserId: user.id,
      action: "support.role_test.assumed",
      subjectType: "core.role",
      subjectId: primaryRole.id,
      organizationId: contextOrganizationId,
      metadata: { roleCodes: selectedRoles.map((role) => role.code) },
    });
  });
  revalidatePath("/", "layout");
}

export async function exitTestRole(formData: FormData) {
  const { user, sessionToken } = await requireSuperadminSession(
    formData.get("locale"),
  );
  await db.transaction(async (tx) => {
    await tx
      .delete(roleTestContexts)
      .where(
        and(
          eq(roleTestContexts.sessionToken, sessionToken),
          eq(roleTestContexts.actorUserId, user.id),
        ),
      );
    await tx.insert(auditEvents).values({
      actorUserId: user.id,
      action: "support.role_test.exited",
      subjectType: "auth.session",
    });
  });
  revalidatePath("/", "layout");
}
