"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, type ReactNode } from "react";

import { DataTable, type DataTableLabels } from "~/components/admin/data-table";
import { Chip } from "~/components/admin/workspace";

export type PlacePrecision = "exact" | "area_only" | "contact_to_learn";

export interface PlaceTableRow {
  id: string;
  name: string;
  organization: string | null;
  area: string | null;
  address: string | null;
  precision: PlacePrecision;
  precisionLabel: string;
}

export type PlacesTableLabels = DataTableLabels & {
  place: string;
  organization: string;
  area: string;
  address: string;
  precision: string;
};

/**
 * Only the exact locations are reassuring. The other two states exist because
 * publishing a precise address would put somebody at risk, so they are drawn as
 * a caution rather than as neutral information — the colour is the reminder
 * that this row is deliberately withheld, not merely incomplete.
 */
const precisionTone: Record<PlacePrecision, "ok" | "warn"> = {
  exact: "ok",
  area_only: "warn",
  contact_to_learn: "warn",
};

/**
 * Places as a table, the same one the rest of the console uses.
 *
 * It had been a plain `<ul>` beside a permanently-open form, which made it the
 * only list in the workspace that could not be searched, sorted or paged — and
 * the one where the form took a third of the width whether or not anybody was
 * filling it in. Creating a place is now a toolbar button like everywhere else,
 * so the list gets the room and the search box it always needed.
 */
export function PlacesTable({
  rows,
  labels,
  createAction,
}: {
  rows: PlaceTableRow[];
  labels: PlacesTableLabels;
  createAction?: ReactNode;
}) {
  const columns = useMemo<ColumnDef<PlaceTableRow>[]>(
    () => [
      {
        id: "place",
        accessorFn: (row) => row.name,
        meta: { label: labels.place },
        header: () => labels.place,
        enableHiding: false,
        cell: ({ row }) => (
          <span className="text-sm font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "organization",
        accessorFn: (row) => row.organization ?? "",
        meta: { label: labels.organization },
        header: () => labels.organization,
        cell: ({ row }) => (
          <span className="text-copy-muted text-sm">
            {row.original.organization ?? "—"}
          </span>
        ),
      },
      {
        id: "area",
        accessorFn: (row) => row.area ?? "",
        meta: { label: labels.area },
        header: () => labels.area,
        cell: ({ row }) => (
          <span className="text-copy-muted text-sm">
            {row.original.area ?? "—"}
          </span>
        ),
      },
      {
        id: "address",
        accessorFn: (row) => row.address ?? "",
        meta: { label: labels.address },
        header: () => labels.address,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-copy-muted text-sm">
            {row.original.address ?? "—"}
          </span>
        ),
      },
      {
        id: "precision",
        accessorFn: (row) => row.precisionLabel,
        meta: { label: labels.precision },
        filterFn: "equalsString",
        header: () => labels.precision,
        cell: ({ row }) => (
          <Chip tone={precisionTone[row.original.precision]}>
            {row.original.precisionLabel}
          </Chip>
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
        [
          row.name,
          row.organization ?? "",
          row.area ?? "",
          row.address ?? "",
        ].join(" ")
      }
      initialSorting={[{ id: "place", desc: false }]}
      createAction={createAction}
    />
  );
}
