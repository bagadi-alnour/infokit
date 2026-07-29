import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm";

import {
  Card,
  Chip,
  EmptyState,
  Field,
  Notice,
  PageHeader,
  Select,
  TextInput,
  WorkspacePage,
} from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import { requireRouteLocale } from "~/i18n/route-locale";
import {
  hasActualPlatformPermission,
  platformStaffPermission,
} from "~/server/auth/authorization";
import { denyPageAccess, requireEditor } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  invitationRoles,
  invitations,
  roles,
  userPlatformRoles,
  users,
} from "~/server/db/schema";
import { INVITABLE_PLATFORM_ROLE_CODES } from "~/server/invitations";
import {
  invitePlatformStaff,
  revokePlatformStaffInvitation,
  revokePlatformStaffRole,
} from "./actions";

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
 * `platform.staff.manage` opens it and nothing else does: an operator or content
 * manager can do their work without seeing, still less changing, who else holds
 * what.
 */
export default async function PlatformStaffPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const t = await loadPageCatalog(locale, "dashboard-console");
  const user = await requireEditor(locale);
  if (!(await hasActualPlatformPermission(user.id, platformStaffPermission))) {
    await denyPageAccess(platformStaffPermission, locale);
  }

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
          gt(invitations.expiresAt, new Date()),
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
      grants: { roleId: string; roleCode: string; expiresAt: Date | null }[];
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
    });
    staff.set(row.userId, entry);
  }

  const localeHidden = <input type="hidden" name="locale" value={locale} />;

  return (
    <WorkspacePage width="content">
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

      <Card
        title={`${t["staff.listTitle"]} (${String(staff.size)})`}
        hint={t["staff.listHint"]}
      >
        {staff.size === 0 ? (
          <EmptyState>{t["staff.empty"]}</EmptyState>
        ) : (
          <ul className="divide-line divide-y">
            {[...staff.values()].map((person) => (
              <li
                key={person.userId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {person.name ?? person.email}
                  </span>
                  <span className="text-copy-muted block truncate text-xs">
                    {person.email}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {person.grants.map((grant) => (
                    <span
                      key={grant.roleId}
                      className="flex items-center gap-1.5"
                    >
                      <Chip tone="neutral">{grant.roleCode}</Chip>
                      {/* Your own grants have no remove control at all: the
                       * action refuses it, and a button that always fails is
                       * worse than no button. */}
                      {person.userId === user.id ? (
                        <span className="text-copy-muted text-xs">
                          {t["staff.you"]}
                        </span>
                      ) : (
                        <form action={revokePlatformStaffRole}>
                          {localeHidden}
                          <input
                            type="hidden"
                            name="userId"
                            value={person.userId}
                          />
                          <input
                            type="hidden"
                            name="roleId"
                            value={grant.roleId}
                          />
                          <PendingButton variant="ghost">
                            {t["staff.revokeRole"]}
                          </PendingButton>
                        </form>
                      )}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}

        <form
          action={invitePlatformStaff}
          className="border-line mt-4 grid items-end gap-3 border-t pt-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        >
          {localeHidden}
          <Field label={t["staff.email"]} hint={t["staff.emailHint"]}>
            <TextInput name="email" type="email" required />
          </Field>
          <Field label={t["staff.role"]}>
            {/* Named by code, as everywhere else in the console: the code is what
             * the permission matrix is written in. `platform_superadmin` is not
             * offered — support access comes from the bootstrap, not a form. */}
            <Select name="roleCode" defaultValue="platform_content_manager">
              {INVITABLE_PLATFORM_ROLE_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <PendingButton variant="secondary" className="min-w-28">
              {t["staff.invite"]}
            </PendingButton>
          </div>
        </form>
      </Card>

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
                <form action={revokePlatformStaffInvitation}>
                  {localeHidden}
                  <input
                    type="hidden"
                    name="invitationId"
                    value={invitation.id}
                  />
                  <PendingButton variant="ghost">
                    {t["invite.revoke"]}
                  </PendingButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </WorkspacePage>
  );
}
