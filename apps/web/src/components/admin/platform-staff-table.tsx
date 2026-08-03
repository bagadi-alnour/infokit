"use client";

import type { Locale } from "@infokit/shared/i18n";
import type { ColumnDef } from "@tanstack/react-table";
import {
  KeyRound,
  LogOut,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  ShieldOff,
  UserCog,
  UserMinus,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  changePlatformStaffRole,
  disablePlatformStaffAccess,
  enablePlatformStaffAccess,
  invitePlatformStaff,
  removePlatformStaff,
  revokePlatformStaffAccess,
} from "~/app/[locale]/dashboard/staff/actions";
import { ActionFeedbackForm } from "~/components/admin/action-feedback-form";
import { DataTable, type DataTableLabels } from "~/components/admin/data-table";
import { Chip } from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SelectField } from "~/components/ui/select-field";

export type PlatformStaffAccess = "active" | "disabled";

export type PlatformStaffRow = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  access: PlatformStaffAccess;
  sessionCount: number;
  grantedAt: string;
  isCurrentUser: boolean;
  isProtected: boolean;
};

type ConfirmationKind = "revoke" | "disable" | "enable" | "remove";

export type PlatformStaffTableLabels = DataTableLabels & {
  member: string;
  email: string;
  roles: string;
  access: string;
  sessions: string;
  granted: string;
  active: string;
  disabled: string;
  you: string;
  protected: string;
  noSessions: string;
  sessionCount: string;
  actions: string;
  actionsFor: string;
  changeRole: string;
  changeRoleTitle: string;
  changeRoleBody: string;
  changeRoleConfirm: string;
  roleChanged: string;
  revokeAccess: string;
  revokeAccessTitle: string;
  revokeAccessBody: string;
  revokeAccessConfirm: string;
  accessRevoked: string;
  disableAccess: string;
  disableAccessTitle: string;
  disableAccessBody: string;
  disableAccessConfirm: string;
  accessDisabled: string;
  enableAccess: string;
  enableAccessTitle: string;
  enableAccessBody: string;
  enableAccessConfirm: string;
  accessEnabled: string;
  removeStaff: string;
  removeStaffTitle: string;
  removeStaffBody: string;
  removeStaffConfirm: string;
  staffRemoved: string;
  inviteUser: string;
  inviteTitle: string;
  inviteBody: string;
  emailHint: string;
  role: string;
  inviteConfirm: string;
  invitedSuccess: string;
  actionError: string;
  cancel: string;
};

function fill(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  );
}

function InvitePlatformStaffDialog({
  locale,
  roleCodes,
  labels,
}: {
  locale: Locale;
  roleCodes: string[];
  labels: PlatformStaffTableLabels;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus aria-hidden />
        {labels.inviteUser}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.inviteTitle}</DialogTitle>
          <DialogDescription>{labels.inviteBody}</DialogDescription>
        </DialogHeader>
        <ActionFeedbackForm
          action={invitePlatformStaff}
          successMessage={labels.invitedSuccess}
          errorMessage={labels.actionError}
          onSuccess={() => {
            setOpen(false);
          }}
          className="grid gap-4"
        >
          <input type="hidden" name="locale" value={locale} />
          <Field>
            <FieldLabel htmlFor="platform-staff-email">
              {labels.email}
            </FieldLabel>
            <Input
              id="platform-staff-email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            <FieldDescription>{labels.emailHint}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="platform-staff-role">{labels.role}</FieldLabel>
            <SelectField
              id="platform-staff-role"
              name="roleCode"
              defaultValue={roleCodes[0]}
              required
            >
              {roleCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </SelectField>
          </Field>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {labels.cancel}
            </DialogClose>
            <PendingButton>
              <Plus aria-hidden />
              {labels.inviteConfirm}
            </PendingButton>
          </DialogFooter>
        </ActionFeedbackForm>
      </DialogContent>
    </Dialog>
  );
}

function StaffConfirmationDialog({
  kind,
  row,
  locale,
  labels,
  open,
  onOpenChange,
}: {
  kind: ConfirmationKind;
  row: PlatformStaffRow;
  locale: Locale;
  labels: PlatformStaffTableLabels;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const configuration = {
    revoke: {
      action: revokePlatformStaffAccess,
      title: labels.revokeAccessTitle,
      body: labels.revokeAccessBody,
      confirm: labels.revokeAccessConfirm,
      success: labels.accessRevoked,
      destructive: false,
    },
    disable: {
      action: disablePlatformStaffAccess,
      title: labels.disableAccessTitle,
      body: labels.disableAccessBody,
      confirm: labels.disableAccessConfirm,
      success: labels.accessDisabled,
      destructive: true,
    },
    enable: {
      action: enablePlatformStaffAccess,
      title: labels.enableAccessTitle,
      body: labels.enableAccessBody,
      confirm: labels.enableAccessConfirm,
      success: labels.accessEnabled,
      destructive: false,
    },
    remove: {
      action: removePlatformStaff,
      title: labels.removeStaffTitle,
      body: labels.removeStaffBody,
      confirm: labels.removeStaffConfirm,
      success: labels.staffRemoved,
      destructive: true,
    },
  } satisfies Record<
    ConfirmationKind,
    {
      action: (formData: FormData) => Promise<unknown>;
      title: string;
      body: string;
      confirm: string;
      success: string;
      destructive: boolean;
    }
  >;
  const selected = configuration[kind];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{selected.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {fill(selected.body, { name: row.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ActionFeedbackForm
          action={selected.action}
          successMessage={selected.success}
          errorMessage={labels.actionError}
          onSuccess={() => {
            onOpenChange(false);
          }}
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="userId" value={row.id} />
          <AlertDialogFooter>
            <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
            <PendingButton
              variant={selected.destructive ? "danger" : "primary"}
            >
              {selected.confirm}
            </PendingButton>
          </AlertDialogFooter>
        </ActionFeedbackForm>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PlatformStaffActions({
  row,
  locale,
  roleCodes,
  labels,
}: {
  row: PlatformStaffRow;
  locale: Locale;
  roleCodes: string[];
  labels: PlatformStaffTableLabels;
}) {
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationKind | null>(
    null,
  );
  const actionLabel = fill(labels.actionsFor, { name: row.name });
  const currentRole =
    row.roles.find((role) => roleCodes.includes(role)) ?? roleCodes[0];

  if (row.isCurrentUser || row.isProtected) {
    return (
      <span className="text-copy-muted text-xs">
        {row.isCurrentUser ? labels.you : labels.protected}
      </span>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={actionLabel}
            />
          }
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem
            onClick={() => {
              setRoleDialogOpen(true);
            }}
          >
            <UserCog aria-hidden />
            {labels.changeRole}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setConfirmation("revoke");
            }}
          >
            <LogOut aria-hidden />
            {labels.revokeAccess}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {row.access === "active" ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                setConfirmation("disable");
              }}
            >
              <ShieldOff aria-hidden />
              {labels.disableAccess}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => {
                setConfirmation("enable");
              }}
            >
              <ShieldCheck aria-hidden />
              {labels.enableAccess}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setConfirmation("remove");
            }}
          >
            <UserMinus aria-hidden />
            {labels.removeStaff}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{labels.changeRoleTitle}</DialogTitle>
            <DialogDescription>
              {fill(labels.changeRoleBody, { name: row.name })}
            </DialogDescription>
          </DialogHeader>
          <ActionFeedbackForm
            action={changePlatformStaffRole}
            successMessage={labels.roleChanged}
            errorMessage={labels.actionError}
            onSuccess={() => {
              setRoleDialogOpen(false);
            }}
            className="grid gap-4"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="userId" value={row.id} />
            <Field>
              <FieldLabel htmlFor={`platform-role-${row.id}`}>
                {labels.role}
              </FieldLabel>
              <SelectField
                id={`platform-role-${row.id}`}
                name="roleCode"
                defaultValue={currentRole}
                required
              >
                {roleCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </SelectField>
            </Field>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {labels.cancel}
              </DialogClose>
              <PendingButton>
                <UserCog aria-hidden />
                {labels.changeRoleConfirm}
              </PendingButton>
            </DialogFooter>
          </ActionFeedbackForm>
        </DialogContent>
      </Dialog>

      {confirmation ? (
        <StaffConfirmationDialog
          kind={confirmation}
          row={row}
          locale={locale}
          labels={labels}
          open
          onOpenChange={(open) => {
            if (!open) setConfirmation(null);
          }}
        />
      ) : null}
    </>
  );
}

export function PlatformStaffTable({
  rows,
  locale,
  roleCodes,
  labels,
  canManage,
}: {
  rows: PlatformStaffRow[];
  locale: Locale;
  roleCodes: string[];
  labels: PlatformStaffTableLabels;
  /**
   * Whether this reader may *change* the roster, as opposed to read it.
   *
   * `platform.staff.read` opens the page; `platform.staff.manage` is what the
   * actions behind these controls demand. Rendering an invite dialog and a row
   * menu to somebody holding only the first would offer them a refusal, so the
   * controls are absent rather than disabled — an inert button explains
   * nothing. The actions gate themselves regardless of what is drawn here.
   */
  canManage: boolean;
}) {
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );
  const columns = useMemo<ColumnDef<PlatformStaffRow>[]>(
    () => [
      {
        id: "member",
        accessorFn: (row) => row.name,
        header: () => labels.member,
        meta: { label: labels.member },
        cell: ({ row }) => (
          // Baseline-aligned and inline: "you" is an aside about the name, not a
          // second fact about the person, so it sits beside it in small muted
          // type rather than taking a line of its own under every other row.
          <div className="flex min-w-40 flex-wrap items-baseline gap-x-1.5">
            <span className="font-medium">{row.original.name}</span>
            {row.original.isCurrentUser ? (
              <span className="text-copy-muted text-xs">{labels.you}</span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: () => labels.email,
        meta: { label: labels.email },
        cell: ({ getValue }) => (
          <span className="text-copy-muted">{String(getValue())}</span>
        ),
      },
      {
        id: "roles",
        accessorFn: (row) => row.roles.join(", "),
        header: () => labels.roles,
        meta: { label: labels.roles },
        cell: ({ row }) => (
          <span className="flex min-w-44 flex-wrap gap-1.5">
            {row.original.roles.map((role) => (
              <Chip key={role} tone="neutral">
                {role}
              </Chip>
            ))}
          </span>
        ),
      },
      {
        accessorKey: "access",
        header: () => labels.access,
        meta: {
          label: labels.access,
          filter: {
            options: [
              { value: "active", label: labels.active },
              { value: "disabled", label: labels.disabled },
            ],
          },
        },
        cell: ({ getValue }) =>
          getValue() === "active" ? (
            <Chip tone="ok">
              <ShieldCheck aria-hidden />
              {labels.active}
            </Chip>
          ) : (
            <Chip tone="warn">
              <ShieldOff aria-hidden />
              {labels.disabled}
            </Chip>
          ),
      },
      {
        accessorKey: "sessionCount",
        header: () => labels.sessions,
        meta: { label: labels.sessions, align: "end" },
        cell: ({ getValue }) => {
          const count = Number(getValue());
          return count === 0 ? (
            <span className="text-copy-muted">{labels.noSessions}</span>
          ) : (
            <span
              className="inline-flex items-center justify-end gap-1.5"
              title={fill(labels.sessionCount, { count: String(count) })}
            >
              <KeyRound className="text-copy-muted size-3.5" aria-hidden />
              {count}
            </span>
          );
        },
      },
      {
        accessorKey: "grantedAt",
        header: () => labels.granted,
        meta: { label: labels.granted },
        cell: ({ getValue }) => (
          <span className="text-copy-muted">
            {dateFormat.format(new Date(String(getValue())))}
          </span>
        ),
      },
    ],
    [dateFormat, labels],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      labels={labels}
      rowId={(row) => row.id}
      searchValue={(row) =>
        [row.name, row.email, ...row.roles, row.access].join(" ")
      }
      initialSorting={[{ id: "member", desc: false }]}
      initialColumnVisibility={{ grantedAt: false }}
      rowActions={
        canManage
          ? {
              label: labels.actions,
              render: (row) => (
                <PlatformStaffActions
                  row={row}
                  locale={locale}
                  roleCodes={roleCodes}
                  labels={labels}
                />
              ),
            }
          : undefined
      }
      createAction={
        canManage ? (
          <InvitePlatformStaffDialog
            locale={locale}
            roleCodes={roleCodes}
            labels={labels}
          />
        ) : undefined
      }
      totalCount={rows.length}
    />
  );
}
