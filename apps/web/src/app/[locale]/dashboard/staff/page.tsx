import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm";

import { ActionFeedbackForm } from "~/components/admin/action-feedback-form";
import {
  PlatformStaffTable,
  type PlatformStaffTableLabels,
} from "~/components/admin/platform-staff-table";
import {
  Card,
  Chip,
  EmptyState,
  Notice,
  PageHeader,
  WorkspacePage,
} from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import { requireRouteLocale } from "~/i18n/route-locale";
import {
  hasActualPlatformPermission,
  platformStaffPermission,
  platformStaffReadPermission,
} from "~/server/auth/authorization";
import { denyPageAccess, requireEditor } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  invitationRoles,
  invitations,
  roles,
  sessions,
  userPlatformRoles,
  users,
} from "~/server/db/schema";
import { INVITABLE_PLATFORM_ROLE_CODES } from "~/server/invitations";
import { revokePlatformStaffInvitation } from "./actions";

/**
 * The platform's own staff — who works on InfoKit itself, and by what grant.
 *
 * It exists because of the separation the roles are drawn along: the bootstrap
 * account administers the platform and holds no content capability at all, so
 * publishing is somebody else's job by design (server/db/seed.ts). This is where
 * that somebody is named. The alternative — giving the owner every permission —
 * would make the audit trail unable to answer "who published this", which is the
 * one question it exists for.
 *
 * Two grants, because seeing the roster and staffing it are different acts.
 * `platform.staff.read` opens the page — the content manager holds it, since
 * knowing who covers what is ordinary platform maintenance. Changing anything
 * needs `platform.staff.manage`, which stays with the superadmin: without it the
 * page renders without an invite dialog or row menu, and every action behind
 * them refuses on its own account (`./actions`).
 */
export default async function PlatformStaffPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const t = await loadPageCatalog(locale, "dashboard-console");
  const user = await requireEditor(locale);
  /**
   * Reading the roster and staffing it are two grants, so the page asks twice:
   * the first decides whether anyone gets in, the second whether what they see
   * has controls on it. `platform_content_manager` holds only the first.
   */
  const [canRead, canManage] = await Promise.all([
    hasActualPlatformPermission(user.id, platformStaffReadPermission),
    hasActualPlatformPermission(user.id, platformStaffPermission),
  ]);
  if (!canRead) {
    await denyPageAccess(platformStaffReadPermission, locale);
  }

  const now = new Date();
  const [staffRows, invitationRows] = await Promise.all([
    // Platform grants only: an association's own roles are that association's
    // roster, shown on its record.
    db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        roleId: roles.id,
        roleCode: roles.code,
        expiresAt: userPlatformRoles.expiresAt,
        grantedAt: userPlatformRoles.createdAt,
      })
      .from(userPlatformRoles)
      .innerJoin(users, eq(users.id, userPlatformRoles.userId))
      .innerJoin(roles, eq(roles.id, userPlatformRoles.roleId))
      .where(isNull(roles.organizationId))
      .orderBy(asc(users.email), asc(roles.code)),
    // Still live: not accepted, not withdrawn. State derives from the
    // timestamps, so "pending" is asked here rather than stored anywhere.
    db
      .select({
        id: invitations.id,
        email: invitations.email,
        expiresAt: invitations.expiresAt,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.kind, "platform_admin"),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, now),
        ),
      )
      .orderBy(desc(invitations.createdAt)),
  ]);
  const pendingInvitations = invitationRows;
  const invitationRoleRows = pendingInvitations.length
    ? await db
        .select({
          invitationId: invitationRoles.invitationId,
          code: roles.code,
        })
        .from(invitationRoles)
        .innerJoin(roles, eq(roles.id, invitationRoles.roleId))
        .where(
          inArray(
            invitationRoles.invitationId,
            pendingInvitations.map((invitation) => invitation.id),
          ),
        )
        .orderBy(asc(roles.code))
    : [];
  const rolesByInvitation = new Map<string, string[]>();
  for (const row of invitationRoleRows) {
    rolesByInvitation.set(row.invitationId, [
      ...(rolesByInvitation.get(row.invitationId) ?? []),
      row.code,
    ]);
  }

  /** One row per person, with every grant they hold, so the list reads as a team. */
  const staff = new Map<
    string,
    {
      userId: string;
      name: string | null;
      email: string;
      grants: {
        roleId: string;
        roleCode: string;
        expiresAt: Date | null;
        grantedAt: Date;
      }[];
    }
  >();
  for (const row of staffRows) {
    const entry = staff.get(row.userId) ?? {
      userId: row.userId,
      name: row.name,
      email: row.email,
      grants: [],
    };
    entry.grants.push({
      roleId: row.roleId,
      roleCode: row.roleCode,
      expiresAt: row.expiresAt,
      grantedAt: row.grantedAt,
    });
    staff.set(row.userId, entry);
  }

  const activeSessionRows =
    staff.size > 0
      ? await db
          .select({ userId: sessions.userId })
          .from(sessions)
          .where(
            and(
              inArray(sessions.userId, [...staff.keys()]),
              gt(sessions.expiresAt, now),
            ),
          )
      : [];
  const sessionsByUser = new Map<string, number>();
  for (const session of activeSessionRows) {
    sessionsByUser.set(
      session.userId,
      (sessionsByUser.get(session.userId) ?? 0) + 1,
    );
  }

  const tableRows = [...staff.values()].map((person) => {
    const name = person.name?.trim();
    return {
      id: person.userId,
      name: name && name.length > 0 ? name : person.email,
      email: person.email,
      roles: person.grants.map((grant) => grant.roleCode),
      access: person.grants.some(
        (grant) => grant.expiresAt === null || grant.expiresAt > now,
      )
        ? ("active" as const)
        : ("disabled" as const),
      sessionCount: sessionsByUser.get(person.userId) ?? 0,
      grantedAt: new Date(
        Math.min(...person.grants.map((grant) => grant.grantedAt.getTime())),
      ).toISOString(),
      isCurrentUser: person.userId === user.id,
      isProtected: person.grants.some(
        (grant) => grant.roleCode === "platform_superadmin",
      ),
    };
  });

  const tableLabels: PlatformStaffTableLabels = {
    search: t["staff.search"],
    searchPlaceholder: t["staff.searchPlaceholder"],
    columns: t["table.columns"],
    clear: t["table.clearSearch"],
    filterBy: t["table.filterBy"],
    noMatch: t["staff.empty"],
    rowsPerPage: t["table.rowsPerPage"],
    results: t["table.results"],
    page: t["table.page"],
    previous: t["table.previousPage"],
    next: t["table.nextPage"],
    member: t["staff.member"],
    email: t["staff.email"],
    roles: t["staff.roles"],
    access: t["staff.access"],
    sessions: t["staff.sessions"],
    granted: t["staff.granted"],
    active: t["staff.active"],
    disabled: t["staff.disabled"],
    you: t["staff.you"],
    protected: t["staff.protected"],
    noSessions: t["staff.noSessions"],
    sessionCount: t["staff.sessionCount"],
    actions: t["table.actions"],
    actionsFor: t["staff.actionsFor"],
    changeRole: t["staff.changeRole"],
    changeRoleTitle: t["staff.changeRoleTitle"],
    changeRoleBody: t["staff.changeRoleBody"],
    changeRoleConfirm: t["staff.changeRoleConfirm"],
    roleChanged: t["staff.roleChanged"],
    revokeAccess: t["staff.revokeAccess"],
    revokeAccessTitle: t["staff.revokeAccessTitle"],
    revokeAccessBody: t["staff.revokeAccessBody"],
    revokeAccessConfirm: t["staff.revokeAccessConfirm"],
    accessRevoked: t["staff.accessRevoked"],
    disableAccess: t["staff.disableAccess"],
    disableAccessTitle: t["staff.disableAccessTitle"],
    disableAccessBody: t["staff.disableAccessBody"],
    disableAccessConfirm: t["staff.disableAccessConfirm"],
    accessDisabled: t["staff.accessDisabled"],
    enableAccess: t["staff.enableAccess"],
    enableAccessTitle: t["staff.enableAccessTitle"],
    enableAccessBody: t["staff.enableAccessBody"],
    enableAccessConfirm: t["staff.enableAccessConfirm"],
    accessEnabled: t["staff.accessEnabled"],
    removeStaff: t["staff.removeStaff"],
    removeStaffTitle: t["staff.removeStaffTitle"],
    removeStaffBody: t["staff.removeStaffBody"],
    removeStaffConfirm: t["staff.removeStaffConfirm"],
    staffRemoved: t["staff.staffRemoved"],
    inviteUser: t["staff.inviteUser"],
    inviteTitle: t["staff.inviteTitle"],
    inviteBody: t["staff.inviteBody"],
    emailHint: t["staff.emailHint"],
    role: t["staff.role"],
    inviteConfirm: t["staff.inviteConfirm"],
    invitedSuccess: t["staff.invitedSuccess"],
    actionError: t["staff.actionError"],
    cancel: t.cancel,
  };

  return (
    <WorkspacePage>
      <PageHeader
        title={t["staff.title"]}
        sub={t["staff.sub"]}
        badges={
          <Chip tone="accent">
            <span>{t["org.platformOnly"]}</span>
          </Chip>
        }
      />

      <Notice tone="info" title={t["staff.separationTitle"]}>
        {t["staff.separationBody"]}
      </Notice>

      <section
        className="mb-6 grid gap-3"
        aria-labelledby="platform-staff-list"
      >
        <div>
          <h2 id="platform-staff-list" className="text-base font-semibold">
            {`${t["staff.listTitle"]} (${String(staff.size)})`}
          </h2>
          <p className="text-copy-muted mt-1 text-sm">{t["staff.listHint"]}</p>
        </div>
        <PlatformStaffTable
          rows={tableRows}
          locale={locale}
          roleCodes={[...INVITABLE_PLATFORM_ROLE_CODES]}
          labels={tableLabels}
          canManage={canManage}
        />
      </section>

      <Card
        title={`${t["staff.pendingTitle"]} (${String(pendingInvitations.length)})`}
        hint={t["staff.pendingHint"]}
      >
        {pendingInvitations.length === 0 ? (
          <EmptyState>{t["staff.noPending"]}</EmptyState>
        ) : (
          <ul className="divide-line divide-y">
            {pendingInvitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {invitation.email}
                  </span>
                  <span className="text-copy-muted block text-xs">
                    {(rolesByInvitation.get(invitation.id) ?? []).join(", ")}
                  </span>
                </span>
                {/* Absent without the manage grant, like the table's controls:
                    a reader may see that an invitation is outstanding, and only
                    a staffer may withdraw it. */}
                {canManage ? (
                  <ActionFeedbackForm
                    action={revokePlatformStaffInvitation}
                    successMessage={t["staff.invitationRevoked"]}
                    errorMessage={t["staff.actionError"]}
                  >
                    <input type="hidden" name="locale" value={locale} />
                    <input
                      type="hidden"
                      name="invitationId"
                      value={invitation.id}
                    />
                    <PendingButton variant="ghost">
                      {t["invite.revoke"]}
                    </PendingButton>
                  </ActionFeedbackForm>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </WorkspacePage>
  );
}
