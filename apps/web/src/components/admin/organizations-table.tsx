"use client";

import type { Locale } from "@infokit/shared/i18n";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Chip } from "~/components/admin/workspace";
import { Icon } from "~/components/icons";
import { localizedPath } from "~/i18n/routing";

import { DataTable, type DataTableLabels } from "./data-table";
import { SelectControl } from "./select-control";

export type OrganizationStatus =
  "draft" | "verified" | "suspended" | "archived";

export type OrganizationRow = {
  id: string;
  displayName: string;
  slug: string;
  status: OrganizationStatus;
  /** ISO date, null while the platform still maintains the record. */
  claimedAt: string | null;
  createdAt: string;
  specialityCount: number;
  activityCount: number;
  memberCount: number;
};

export type OrganizationsTableLabels = DataTableLabels & {
  name: string;
  status: string;
  maintainedBy: string;
  maintainedByOrg: string;
  maintainedByPlatform: string;
  specialities: string;
  activities: string;
  members: string;
  created: string;
  anyStatus: string;
  anyMaintainer: string;
  statusLabels: Record<OrganizationStatus, string>;
};

const statusTone = {
  draft: "neutral",
  verified: "ok",
  suspended: "warn",
  archived: "neutral",
} as const;

const STATUSES: OrganizationStatus[] = [
  "draft",
  "verified",
  "suspended",
  "archived",
];

/**
 * The organisation directory. Platform-only (docs/PRODUCT.md §11.3): the list
 * is how an operator finds one record among all of them, so searching,
 * filtering and paging happen here rather than in a page reload, and a row is
 * a door — clicking it opens that organisation's full record.
 */
export function OrganizationsTable({
  rows,
  locale,
  labels,
}: {
  rows: OrganizationRow[];
  locale: Locale;
  labels: OrganizationsTableLabels;
}) {
  const [status, setStatus] = useState("");
  const [maintainer, setMaintainer] = useState("");

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (status === "" || row.status === status) &&
          (maintainer === "" ||
            (maintainer === "claimed"
              ? row.claimedAt !== null
              : row.claimedAt === null)),
      ),
    [maintainer, rows, status],
  );

  const columns = useMemo<ColumnDef<OrganizationRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.displayName,
        header: () => labels.name,
        meta: { label: labels.name },
        enableHiding: false,
        cell: ({ row }) => (
          <>
            <Link
              href={localizedPath(
                `/dashboard/organizations/${row.original.id}`,
                locale,
              )}
              className="font-medium hover:underline"
            >
              {row.original.displayName}
            </Link>
            <p className="text-copy-muted text-xs">{row.original.slug}</p>
          </>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => labels.statusLabels[row.status],
        header: () => labels.status,
        meta: { label: labels.status },
        cell: ({ row }) => (
          <Chip tone={statusTone[row.original.status]}>
            {labels.statusLabels[row.original.status]}
          </Chip>
        ),
      },
      {
        id: "maintainer",
        accessorFn: (row) => (row.claimedAt === null ? 0 : 1),
        header: () => labels.maintainedBy,
        meta: { label: labels.maintainedBy },
        cell: ({ row }) => {
          const claimed = row.original.claimedAt !== null;
          return (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              <Icon name={claimed ? "claimed" : "unclaimed"} size={14} />
              {claimed ? labels.maintainedByOrg : labels.maintainedByPlatform}
            </span>
          );
        },
      },
      {
        id: "specialities",
        accessorFn: (row) => row.specialityCount,
        header: () => labels.specialities,
        meta: { label: labels.specialities, align: "end" },
      },
      {
        id: "activities",
        accessorFn: (row) => row.activityCount,
        header: () => labels.activities,
        meta: { label: labels.activities, align: "end" },
      },
      {
        id: "members",
        accessorFn: (row) => row.memberCount,
        header: () => labels.members,
        meta: { label: labels.members, align: "end" },
      },
      {
        id: "created",
        accessorFn: (row) => row.createdAt,
        header: () => labels.created,
        meta: { label: labels.created },
        cell: ({ row }) => (
          <span className="text-copy-muted text-xs">
            {dateFormat.format(new Date(row.original.createdAt))}
          </span>
        ),
      },
    ],
    [dateFormat, labels, locale],
  );

  return (
    <DataTable
      columns={columns}
      data={filtered}
      totalCount={rows.length}
      labels={labels}
      rowId={(row) => row.id}
      rowHref={(row) =>
        localizedPath(`/dashboard/organizations/${row.id}`, locale)
      }
      searchValue={(row) => `${row.displayName} ${row.slug}`}
      initialSorting={[{ id: "created", desc: true }]}
      filters={
        <>
          <SelectControl
            label={labels.status}
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "", label: labels.anyStatus },
              ...STATUSES.map((value) => ({
                value,
                label: labels.statusLabels[value],
              })),
            ]}
            className="w-44"
          />
          <SelectControl
            label={labels.maintainedBy}
            value={maintainer}
            onValueChange={setMaintainer}
            options={[
              { value: "", label: labels.anyMaintainer },
              { value: "claimed", label: labels.maintainedByOrg },
              { value: "unclaimed", label: labels.maintainedByPlatform },
            ]}
            className="w-44"
          />
        </>
      }
    />
  );
}
