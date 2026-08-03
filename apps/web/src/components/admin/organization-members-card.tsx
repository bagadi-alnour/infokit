import type { PublicLocale } from "@infokit/shared/i18n";
import { loadCatalog, loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionFeedbackForm } from "~/components/admin/action-feedback-form";
import { InviteMemberDialog } from "~/components/admin/invite-member-dialog";
import {
  MembersTable,
  type MemberTableRow,
  type MembersTableLabels,
} from "~/components/admin/members-table";
import { Card, Chip, EmptyState } from "~/components/admin/workspace";
import { Icon } from "~/components/icons";
import { PendingButton } from "~/components/pending-button";
import { env } from "~/env";
import { localizedPath } from "~/i18n/routing";
import { memberFullName } from "~/lib/member-name";
import {
  resendOrganizationInvitation,
  revokeOrganizationInvitation,
} from "~/app/[locale]/dashboard/organizations/actions";
import { recordRestrictedRead } from "~/server/audit/reads";
import { authorizationFor } from "~/server/auth/authorization";
import { organizationWriteAccess } from "~/server/auth/org-access";
import { db } from "~/server/db";
import {
  invitationRoles,
  invitations,
  memberRoles,
  organizationMembers,
  organizations,
  roles,
} from "~/server/db/schema";
import {
  ASSIGNABLE_ORGANIZATION_ROLE_CODES,
  INVITABLE_ROLE_CODES,
} from "~/server/invitations";

/**
 * Who is in an organisation, what they may do, and who has been asked to join.
 *
 * Lifted out of the organisation record so it can be a page of its own. The
 * roster had been one card among a dozen on a very long screen, which made
 * "who is in this organisation" a scrolling exercise; it is a question people
 * arrive with, so it gets its own address.
 *
 * Self-contained on purpose: it resolves its own grants rather than taking a
 * dozen booleans as props. Two very different callers render it — an
 * organisation looking at itself, and a platform operator looking at somebody
 * else's record — and the difference between them is exactly what the grant
 * checks below encode. Passing them in would let a caller get that wrong.
 */
export async function OrganizationMembersCard({
  organizationId,
  locale,
  userId,
}: {
  organizationId: string;
  locale: PublicLocale;
  userId: string;
}) {
  const t = await loadPageCatalog(locale, "dashboard-console");
  // Roles read the way the sidebar names them, never as `organization_admin`.
  const roleCatalogue: Record<string, string | undefined> = await loadCatalog(
    locale,
    "dashboard-layout",
  );
  const roleLabel = (code: string) => roleCatalogue[`role.${code}`] ?? code;

  const [org] = await db
    .select({ id: organizations.id, displayName: organizations.displayName })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  if (!org) notFound();

  const [access, authorization] = await Promise.all([
    organizationWriteAccess(userId, organizationId),
    authorizationFor(userId, organizationId),
  ]);
  const canWrite = access.canWrite;
  const canLifecycle =
    canWrite && authorization.effectivePermissions.has("organization.verify");
  /**
   * Reading the roster and reading its inbox are two different grants: an
   * operator may see the shape of a team without its addresses.
   */
  const canReadMembers =
    authorization.isSuperadmin ||
    authorization.effectivePermissions.has("members.read") ||
    access.actor === "platform_admin";
  const canReadMemberEmails =
    authorization.isSuperadmin ||
    authorization.effectivePermissions.has("members.read");
  const canManageMembers =
    canWrite && authorization.effectivePermissions.has("members.manage");
  const canManageRoles =
    canWrite && authorization.effectivePermissions.has("roles.manage");

  const memberRows = canReadMembers
    ? await db
        .select({
          id: organizationMembers.id,
          firstName: organizationMembers.firstName,
          lastName: organizationMembers.lastName,
          contactEmail: organizationMembers.contactEmail,
          phone: organizationMembers.phone,
          title: organizationMembers.title,
          status: organizationMembers.status,
          userId: organizationMembers.userId,
        })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, organizationId))
        .orderBy(
          asc(organizationMembers.lastName),
          asc(organizationMembers.firstName),
        )
    : [];
  /**
   * The roster is a list of people, so the read is recorded and the row says
   * which kind of reader made it: an organisation's own administrator reading
   * their team is the job, and a platform operator reading somebody else's team
   * is worth being able to ask about afterwards. Both are permitted above; only
   * one is routine, and `readerRole` is what tells them apart later.
   */
  if (memberRows.length > 0) {
    await recordRestrictedRead({
      action: "member.directory_read",
      subjectType: "organization",
      subjectId: organizationId,
      subjectLabel: org.displayName,
      organizationId,
      metadata: {
        members: memberRows.length,
        emails: canReadMemberEmails,
        readerRole: access.actor,
      },
    });
  }

  const memberRoleRows =
    memberRows.length > 0
      ? await db
          .select({
            memberId: memberRoles.memberId,
            roleId: roles.id,
            code: roles.code,
            description: roles.description,
            expiresAt: memberRoles.expiresAt,
          })
          .from(memberRoles)
          .innerJoin(roles, eq(roles.id, memberRoles.roleId))
          .where(
            inArray(
              memberRoles.memberId,
              memberRows.map((member) => member.id),
            ),
          )
          .orderBy(asc(roles.code))
      : [];
  const rolesByMember = new Map<string, typeof memberRoleRows>();
  for (const row of memberRoleRows) {
    rolesByMember.set(row.memberId, [
      ...(rolesByMember.get(row.memberId) ?? []),
      row,
    ]);
  }
  const memberStatusLabel = {
    active: t["memberStatus.active"],
    invited: t["memberStatus.invited"],
    inactive: t["memberStatus.inactive"],
    offboarded: t["memberStatus.offboarded"],
  } as const;

  const assignableRoleRows = canManageRoles
    ? await db
        .select({
          id: roles.id,
          code: roles.code,
          organizationId: roles.organizationId,
        })
        .from(roles)
        .where(
          or(
            eq(roles.organizationId, organizationId),
            and(
              isNull(roles.organizationId),
              inArray(roles.code, [...ASSIGNABLE_ORGANIZATION_ROLE_CODES]),
            ),
          ),
        )
        .orderBy(asc(roles.code))
    : [];

  /**
   * Invitations sent for this record that nobody has accepted yet
   * (docs/PHASE-1.3-COLLABORATION.md Flow 1). The roster shows a reserved
   * membership; only the invitation shows when the link dies, so both the
   * operator who may resend it and anyone allowed to read member addresses see
   * it here.
   */
  const canInvite = canLifecycle || (canManageMembers && canManageRoles);
  const canSeeInvitations = canInvite || canReadMemberEmails;
  const invitationRows = canSeeInvitations
    ? await db
        .select({
          id: invitations.id,
          email: invitations.email,
          expiresAt: invitations.expiresAt,
        })
        .from(invitations)
        .where(
          and(
            eq(invitations.organizationId, organizationId),
            isNull(invitations.acceptedAt),
            isNull(invitations.revokedAt),
          ),
        )
        .orderBy(desc(invitations.createdAt))
    : [];
  const invitationRoleRows =
    invitationRows.length > 0
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
              invitationRows.map((invitation) => invitation.id),
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

  const now = Date.now();
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const hidden = (
    <input type="hidden" name="organizationId" value={organizationId} />
  );
  const localeHidden = <input type="hidden" name="locale" value={locale} />;

  /**
   * The roster, flattened for the table. Every permission question is answered
   * here rather than in the client component: an address the reader may not see
   * is `null` before it is serialised, so it never reaches the browser, and a
   * role they may not touch arrives already marked `locked`.
   */
  const tableRows: MemberTableRow[] = memberRows.map((member) => {
    const granted = rolesByMember.get(member.id) ?? [];
    const grantedIds = new Set(granted.map((role) => role.roleId));
    return {
      id: member.id,
      name: memberFullName(member),
      title: member.title,
      email: canReadMemberEmails ? member.contactEmail : null,
      phone: canReadMemberEmails ? member.phone : null,
      status: member.status,
      statusLabel: memberStatusLabel[member.status],
      hasAccount: member.userId !== null,
      roles: granted.map((role) => ({
        roleId: role.roleId,
        label: roleLabel(role.code),
        expiresLabel: role.expiresAt
          ? `${t["members.until"]} ${dateFormat.format(role.expiresAt)}`
          : null,
        // An administrator cannot revoke their own administrator role — the
        // action refuses it, so the menu does not offer it.
        locked:
          !canManageRoles ||
          (member.userId === userId && role.code === "organization_admin"),
      })),
      grantable: canManageRoles
        ? assignableRoleRows
            .filter((role) => !grantedIds.has(role.id))
            .map((role) => ({ roleId: role.id, label: roleLabel(role.code) }))
        : [],
    };
  });

  const tableLabels: MembersTableLabels = {
    search: t["console.search"],
    searchPlaceholder: t["members.searchPlaceholder"],
    columns: t["table.columns"],
    clear: t["table.clearSearch"],
    filterBy: t["table.filterBy"],
    noMatch: t["console.filter.noMatch"],
    rowsPerPage: t["table.rowsPerPage"],
    results: t["table.results"],
    page: t["table.page"],
    previous: t["table.previousPage"],
    next: t["table.nextPage"],
    member: t["members.nameColumn"],
    title: t["members.titleColumn"],
    contact: t["members.contactColumn"],
    status: t["members.statusColumn"],
    roles: t["members.roles"],
    noRole: t["members.noRole"],
    noAccount: t["members.noAccount"],
    rowMenu: t["members.rowMenu"],
    assignNamed: t["members.assignRoleNamed"],
    revokeNamed: t["members.revokeRoleNamed"],
    granted: t["members.roleGranted"],
    revoked: t["members.roleRevoked"],
    actionError: t["toast.actionError"],
  };

  const inviteAction = canInvite ? (
    <InviteMemberDialog
      locale={locale}
      organizationId={organizationId}
      roles={INVITABLE_ROLE_CODES.map((code) => ({
        code,
        label: roleLabel(code),
      }))}
      labels={{
        cta: t["invite.cta"],
        title: t["invite.dialogTitle"],
        hint: t["invite.dialogHint"],
        firstName: t["invite.firstName"],
        lastName: t["invite.lastName"],
        jobTitle: t["invite.title"],
        jobTitleHint: t["invite.titleHint"],
        email: t["invite.email"],
        phone: t["invite.phone"],
        role: t["invite.role"],
        roleHint: t["invite.hint"],
        send: t["invite.send"],
        cancel: t["invite.cancel"],
        sent: t["invite.sentSuccess"],
        error: t["toast.actionError"],
      }}
    />
  ) : null;

  return (
    <section id="organization-members" className="scroll-mt-6">
      <Card
        title={`${t["section.members"]} (${String(memberRows.length)})`}
        hint={t["members.hint"]}
        action={
          // Gated on the flag as well as the grant. The team board is
          // Phase 3 and renders "not available" wherever the flag is off,
          // which is every deployment by default — so without this test the
          // roster offered a link whose only destination was a dead end.
          // Roster work itself does not need it: it happens on this card.
          env.ENABLE_PHASE3_MEMBER_ASSIGNMENTS &&
          canWrite &&
          authorization.effectivePermissions.has("members.manage") ? (
            <Link
              href={localizedPath(
                `/dashboard/my-organization/city-team?org=${organizationId}`,
                locale,
              )}
              className="text-copy-muted hover:text-ink inline-flex items-center gap-1.5 text-xs font-medium"
            >
              <Icon name="external" size={14} />
              {t["members.manage"]}
            </Link>
          ) : null
        }
      >
        {!canReadMembers ? (
          <EmptyState>{t["members.hidden"]}</EmptyState>
        ) : (
          <MembersTable
            rows={tableRows}
            locale={locale}
            labels={tableLabels}
            createAction={inviteAction}
          />
        )}
        {/* An invited colleague belongs with the roster rather than in a
         * card beside it: to the person reading this page, they are simply
         * somebody who is not on the team yet, and having to look in two
         * places to answer "who is in this organisation" is what made the
         * old layout confusing. It keeps a rule and its own heading because
         * an invitation is still a link with an expiry date, resent or
         * revoked on its own, and not a membership row. */}
        {canSeeInvitations ? (
          <div className="border-line mt-6 border-t pt-5">
            <h3 className="text-sm font-semibold">
              {t["invite.pendingTitle"]} ({invitationRows.length})
            </h3>
            {canInvite ? (
              <p className="text-copy-muted mt-1 text-xs">{t["invite.hint"]}</p>
            ) : null}
            {invitationRows.length === 0 ? (
              <EmptyState>{t["invite.none"]}</EmptyState>
            ) : (
              <ul className="divide-line divide-y">
                {invitationRows.map((invitation) => {
                  const expired = invitation.expiresAt.getTime() <= now;
                  return (
                    <li
                      key={invitation.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{invitation.email}</span>
                        <Chip tone={expired ? "warn" : "accent"}>
                          {expired
                            ? t["invite.expired"]
                            : `${t["invite.expires"]} ${dateFormat.format(invitation.expiresAt)}`}
                        </Chip>
                        {(rolesByInvitation.get(invitation.id) ?? []).map(
                          (code) => (
                            <Chip key={code} tone="neutral">
                              {roleLabel(code)}
                            </Chip>
                          ),
                        )}
                      </span>
                      {canInvite ? (
                        <span className="flex items-center gap-1">
                          <ActionFeedbackForm
                            action={resendOrganizationInvitation}
                            successMessage={t["invite.resentSuccess"]}
                            errorMessage={t["toast.actionError"]}
                          >
                            {localeHidden}
                            {hidden}
                            <input
                              type="hidden"
                              name="invitationId"
                              value={invitation.id}
                            />
                            <PendingButton variant="ghost">
                              {t["invite.resend"]}
                            </PendingButton>
                          </ActionFeedbackForm>
                          <ActionFeedbackForm
                            action={revokeOrganizationInvitation}
                            successMessage={t["invite.revokedSuccess"]}
                            errorMessage={t["toast.actionError"]}
                          >
                            {localeHidden}
                            {hidden}
                            <input
                              type="hidden"
                              name="invitationId"
                              value={invitation.id}
                            />
                            <PendingButton variant="ghost">
                              {t["invite.revoke"]}
                            </PendingButton>
                          </ActionFeedbackForm>
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </Card>
    </section>
  );
}
