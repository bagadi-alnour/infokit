"use client";

import { formatMessage } from "@infokit/shared/i18n";
import type { ColumnDef } from "@tanstack/react-table";
import { ShieldMinus, ShieldPlus } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import {
  grantOrganizationMemberRole,
  revokeOrganizationMemberRole,
} from "~/app/[locale]/dashboard/organizations/actions";
import {
  DataTable,
  DataTableChips,
  type DataTableLabels,
} from "~/components/admin/data-table";
import { RowActions, type RowAction } from "~/components/admin/row-actions";
import { Chip } from "~/components/admin/workspace";

/** One role a member holds, already named and dated for reading. */
export interface MemberRoleChip {
  roleId: string;
  label: string;
  /** "until 3 May 2026", or null for a grant that does not expire. */
  expiresLabel: string | null;
  /**
   * An administrator cannot take their own administrator role away — the
   * server refuses it, and offering it in the menu would be a lie.
   */
  locked: boolean;
}

export interface MemberTableRow {
  id: string;
  name: string;
  title: string;
  /** Null when the reader may see the roster but not its addresses. */
  email: string | null;
  phone: string | null;
  status: "active" | "invited" | "inactive" | "offboarded";
  statusLabel: string;
  hasAccount: boolean;
  roles: MemberRoleChip[];
  /** Roles this reader may still add to this member. Empty when they may not. */
  grantable: { roleId: string; label: string }[];
}

export type MembersTableLabels = DataTableLabels & {
  member: string;
  title: string;
  contact: string;
  status: string;
  roles: string;
  noRole: string;
  noAccount: string;
  rowMenu: string;
  assignNamed: string;
  revokeNamed: string;
  granted: string;
  revoked: string;
  actionError: string;
};

const statusTone = {
  active: "ok",
  invited: "accent",
  inactive: "neutral",
  offboarded: "neutral",
} as const;

/**
 * The roster as a table, the same one the activities and articles lists use.
 *
 * It was a stack of list items carrying their own inline forms, which meant the
 * roster was the only list in the workspace that could not be sorted, searched
 * or narrowed, and whose columns could not be put away. Granting and revoking a
 * role are now row commands, so they arrive through the same menu, the same
 * confirmations and the same error toast as every other operation in the
 * console — and inviting sits in the toolbar beside the column menu, where
 * "the record I wanted is not in this list" is actually noticed.
 */
export function MembersTable({
  rows,
  locale,
  labels,
  createAction,
}: {
  rows: MemberTableRow[];
  locale: string;
  labels: MembersTableLabels;
  createAction?: ReactNode;
}) {
  const columns = useMemo<ColumnDef<MemberTableRow>[]>(
    () => [
      {
        id: "member",
        accessorFn: (row) => row.name,
        meta: { label: labels.member },
        header: () => labels.member,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-sm font-medium">{row.original.name}</p>
            {!row.original.hasAccount ? (
              <p className="text-copy-muted text-xs">{labels.noAccount}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: "title",
        accessorFn: (row) => row.title,
        meta: { label: labels.title },
        header: () => labels.title,
        cell: ({ row }) => (
          <span className="text-copy-muted text-sm">{row.original.title}</span>
        ),
      },
      {
        id: "contact",
        accessorFn: (row) => `${row.email ?? ""} ${row.phone ?? ""}`.trim(),
        meta: { label: labels.contact },
        enableSorting: false,
        header: () => labels.contact,
        cell: ({ row }) =>
          row.original.email === null && row.original.phone === null ? null : (
            <div className="text-copy-muted min-w-0 text-xs">
              {row.original.email ? <p>{row.original.email}</p> : null}
              {row.original.phone ? (
                <p dir="ltr">{row.original.phone}</p>
              ) : null}
            </div>
          ),
      },
      {
        id: "status",
        accessorFn: (row) => row.statusLabel,
        meta: { label: labels.status },
        filterFn: "equalsString",
        header: () => labels.status,
        cell: ({ row }) => (
          <Chip tone={statusTone[row.original.status]}>
            {row.original.statusLabel}
          </Chip>
        ),
      },
      {
        id: "roles",
        accessorFn: (row) => row.roles.map((role) => role.label).join(" "),
        meta: { label: labels.roles },
        enableSorting: false,
        header: () => labels.roles,
        cell: ({ row }) => (
          <DataTableChips
            items={row.original.roles.map((role) =>
              role.expiresLabel
                ? `${role.label} · ${role.expiresLabel}`
                : role.label,
            )}
            empty={labels.noRole}
          />
        ),
      },
    ],
    [labels],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      labels={labels}
      rowId={(row) => row.id}
      searchValue={(row) =>
        [row.name, row.title, row.email ?? "", row.phone ?? ""].join(" ")
      }
      initialSorting={[{ id: "member", desc: false }]}
      createAction={createAction}
      rowActions={{
        label: labels.rowMenu,
        render: (row) => {
          const actions: RowAction[] = [
            // Revoking first: the menu is opened far more often to correct a
            // grant than to add one.
            ...row.roles
              .filter((role) => !role.locked)
              .map<RowAction>((role) => ({
                kind: "command",
                key: `revoke-${role.roleId}`,
                label: formatMessage(labels.revokeNamed, {
                  role: role.label,
                }),
                icon: ShieldMinus,
                action: revokeOrganizationMemberRole,
                fields: {
                  locale,
                  memberId: row.id,
                  roleId: role.roleId,
                },
                success: labels.revoked,
                error: labels.actionError,
                destructive: true,
              })),
            ...(row.roles.length > 0 && row.grantable.length > 0
              ? [{ kind: "separator" as const, key: `sep-${row.id}` }]
              : []),
            ...row.grantable.map<RowAction>((role) => ({
              kind: "command",
              key: `grant-${role.roleId}`,
              label: formatMessage(labels.assignNamed, { role: role.label }),
              icon: ShieldPlus,
              action: grantOrganizationMemberRole,
              fields: {
                locale,
                memberId: row.id,
                roleId: role.roleId,
              },
              success: labels.granted,
              error: labels.actionError,
            })),
          ];
          return actions.length === 0 ? null : (
            <RowActions label={labels.rowMenu} actions={actions} />
          );
        },
      }}
    />
  );
}
