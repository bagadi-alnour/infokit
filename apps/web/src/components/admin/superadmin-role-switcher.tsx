"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";

import {
  assumeTestRole,
  exitTestRole,
} from "~/app/[locale]/dashboard/test-role-actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { SearchableMultiSelect } from "~/components/admin/searchable-select";
import { Button } from "~/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";

export function SuperadminRoleSwitcher({
  locale,
  roles,
  organizations,
  activeRoles,
  activeOrganization,
  labels,
}: {
  locale: string;
  roles: { id: string; code: string }[];
  organizations: { id: string; name: string }[];
  activeRoles: {
    roleId: string;
    roleCode: string;
  }[];
  activeOrganization: { id: string; name: string } | null;
  labels: {
    testing: string;
    role: string;
    organization: string;
    apply: string;
    applyError: string;
    exit: string;
    noMatch: string;
  };
}) {
  const defaultRoleIds =
    activeRoles.length > 0
      ? activeRoles.map((role) => role.roleId)
      : [
          roles.find((role) => role.code === "platform_superadmin")?.id ??
            roles[0]?.id ??
            "",
        ].filter(Boolean);
  const [selectedRoleIds, setSelectedRoleIds] = useState(defaultRoleIds);
  const superadminRoleId = roles.find(
    (role) => role.code === "platform_superadmin",
  )?.id;
  const updateSelectedRoles = (nextRoleIds: string[]) => {
    if (!superadminRoleId) {
      setSelectedRoleIds(nextRoleIds);
      return;
    }
    if (
      nextRoleIds.includes(superadminRoleId) &&
      !selectedRoleIds.includes(superadminRoleId)
    ) {
      setSelectedRoleIds([superadminRoleId]);
      return;
    }
    setSelectedRoleIds(
      nextRoleIds.length > 1
        ? nextRoleIds.filter((roleId) => roleId !== superadminRoleId)
        : nextRoleIds,
    );
  };
  const selectedRoles = roles.filter((role) =>
    selectedRoleIds.includes(role.id),
  );
  const needsOrganization = selectedRoles.some(
    (role) => !role.code.startsWith("platform_"),
  );
  const showActionError = useActionErrorToast();
  const applyRoles = async (formData: FormData) => {
    try {
      await assumeTestRole(formData);
    } catch (error) {
      showActionError(error, labels.applyError);
    }
  };
  const exitRoles = async (formData: FormData) => {
    try {
      await exitTestRole(formData);
    } catch (error) {
      showActionError(error, labels.applyError);
    }
  };
  const activeRoleLabel =
    activeRoles.length > 0
      ? activeRoles.map((role) => role.roleCode).join(" + ")
      : "platform_superadmin";

  return (
    <div className="border-warn/40 bg-warn-soft text-ink grid gap-2 rounded-lg border p-2.5 group-data-[collapsible=icon]:hidden">
      <strong className="flex min-w-0 items-center gap-2 text-xs">
        <ShieldCheck className="text-warn size-4 shrink-0" aria-hidden />
        <span className="truncate" title={activeRoleLabel}>
          {labels.testing}: {activeRoleLabel}
          {activeOrganization ? ` · ${activeOrganization.name}` : ""}
        </span>
      </strong>
      <form action={applyRoles} className="grid gap-2">
        <input type="hidden" name="locale" value={locale} />
        <div className="min-w-0">
          <SearchableMultiSelect
            name="roleIds"
            options={roles.map((role) => ({
              value: role.id,
              label: role.code,
            }))}
            value={selectedRoleIds}
            onValueChange={updateSelectedRoles}
            label={labels.role}
            placeholder={labels.role}
            emptyLabel={labels.noMatch}
          />
        </div>
        <NativeSelect
          name="organizationId"
          aria-label={labels.organization}
          defaultValue={activeOrganization?.id ?? organizations[0]?.id}
          disabled={!needsOrganization}
        >
          {organizations.map((organization) => (
            <NativeSelectOption key={organization.id} value={organization.id}>
              {organization.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline" size="sm" className="w-full">
          {labels.apply}
        </Button>
      </form>
      {activeRoles.length > 0 ? (
        <form action={exitRoles}>
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="ghost" size="sm" className="w-full">
            {labels.exit}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
