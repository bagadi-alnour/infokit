"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DataTable, type DataTableLabels } from "~/components/admin/data-table";
import { SelectControl } from "~/components/admin/select-control";
import { Chip } from "~/components/admin/workspace";

import { EVENT_VISIBILITIES, type EventVisibilityValue } from "./visibility";

/**
 * One agenda row, already formatted by the server: the date and time an event
 * shows are the city's wall clock, which the browser's own timezone would get
 * wrong.
 */
export type EventTableRow = {
  id: string;
  href: string;
  title: string;
  hostName: string | null;
  visibility: EventVisibilityValue;
  cancelled: boolean;
  archived: boolean;
  /** ISO instants — sorting and the past/upcoming split use these. */
  startsAt: string;
  endsAt: string;
  dateLabel: string;
  timeLabel: string;
  whereLabel: string | null;
  cityName: string;
};

export type EventsTableLabels = DataTableLabels & {
  event: string;
  when: string;
  where: string;
  /** The header's own wording — "By", above the organiser's name. */
  by: string;
  /** What that column is, for the filter and columns menus: "Host". */
  host: string;
  reach: string;
  hostPlatform: string;
  cancelled: string;
  archived: string;
  upcoming: string;
  past: string;
  state: string;
  active: string;
  anyState: string;
  visibilityLabels: Record<EventVisibilityValue, string>;
};

const reachTone = {
  organization: "neutral",
  inter_organization: "accent",
  public: "ok",
} as const;

/**
 * The agenda as a list: what the event is, who is holding it, when it happens,
 * where, and how far it reaches. Every column filters by the values it actually
 * holds — several at once, so "public and inter-organisation" is one question —
 * because an editor arrives looking for a subset, not for the whole agenda.
 */
export function EventsTable({
  rows,
  labels,
  nowIso,
}: {
  rows: EventTableRow[];
  labels: EventsTableLabels;
  /** The server's "now", so the past/upcoming split matches the page. */
  nowIso: string;
}) {
  // An archived event stays reachable — that is how it gets restored — but it
  // is not part of the agenda until someone asks for it, so it is kept out of
  // the rows rather than filtered in the header.
  const [state, setState] = useState("active");

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (state === "active" && row.archived) return false;
        if (state === "archived" && !row.archived) return false;
        return true;
      }),
    [rows, state],
  );

  const columns = useMemo<ColumnDef<EventTableRow>[]>(
    () => [
      {
        id: "event",
        accessorFn: (row) => row.title,
        header: () => labels.event,
        // No filter here: every title is its own value, so a menu of them would
        // be a menu of the rows — that is what the search box is for.
        meta: { label: labels.event },
        enableHiding: false,
        cell: ({ row }) => (
          <>
            <Link
              href={row.original.href}
              className="font-medium hover:underline"
            >
              {row.original.title}
            </Link>
            {row.original.cancelled || row.original.archived ? (
              <p className="flex flex-wrap items-center gap-1.5 text-xs">
                {row.original.cancelled ? (
                  <Chip tone="danger">{labels.cancelled}</Chip>
                ) : null}
                {row.original.archived ? (
                  <Chip tone="neutral">{labels.archived}</Chip>
                ) : null}
              </p>
            ) : null}
          </>
        ),
      },
      {
        id: "host",
        accessorFn: (row) => row.hostName ?? labels.hostPlatform,
        header: () => labels.by,
        meta: { label: labels.host, filter: {} },
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.hostName ?? labels.hostPlatform}
          </span>
        ),
      },
      {
        id: "when",
        accessorFn: (row) => row.startsAt,
        header: () => labels.when,
        meta: {
          label: labels.when,
          // Every date is its own value, so a list of them would be a list of
          // the rows; the useful question of a date column is which side of
          // today it falls on.
          filter: {
            options: [
              { value: "upcoming", label: labels.upcoming },
              { value: "past", label: labels.past },
            ],
          },
        },
        filterFn: (row, _columnId, filterValue) => {
          const wanted = filterValue as string[] | undefined;
          if (!wanted || wanted.length === 0) return true;
          const upcoming = row.original.endsAt >= nowIso;
          return wanted.includes(upcoming ? "upcoming" : "past");
        },
        cell: ({ row }) => (
          <>
            <span
              className={
                row.original.cancelled ? "line-through" : "font-medium"
              }
            >
              {row.original.dateLabel}
            </span>
            <p className="text-copy-muted text-xs">{row.original.timeLabel}</p>
          </>
        ),
      },
      {
        id: "where",
        accessorFn: (row) => row.whereLabel ?? row.cityName,
        header: () => labels.where,
        meta: { label: labels.where, filter: {} },
        cell: ({ row }) => (
          <>
            {/* A street address is the longest thing in the row: left on one
             * line it pushes the reach chip past the edge of the table. */}
            <span className="block max-w-56 whitespace-normal text-sm">
              {row.original.whereLabel ?? "—"}
            </span>
            <p className="text-copy-muted text-xs">{row.original.cityName}</p>
          </>
        ),
      },
      {
        id: "reach",
        // The tier itself, not its wording: the filter's options and the
        // column's values have to be the same thing.
        accessorFn: (row) => row.visibility,
        header: () => labels.reach,
        meta: {
          label: labels.reach,
          filter: {
            options: EVENT_VISIBILITIES.map((value) => ({
              value,
              label: labels.visibilityLabels[value],
            })),
          },
        },
        cell: ({ row }) => (
          <Chip tone={reachTone[row.original.visibility]}>
            {labels.visibilityLabels[row.original.visibility]}
          </Chip>
        ),
      },
    ],
    [labels, nowIso],
  );

  return (
    <DataTable
      columns={columns}
      data={filtered}
      totalCount={rows.length}
      labels={labels}
      rowId={(row) => row.id}
      rowHref={(row) => row.href}
      searchValue={(row) =>
        `${row.title} ${row.hostName ?? ""} ${row.whereLabel ?? ""} ${row.cityName}`
      }
      initialSorting={[{ id: "when", desc: false }]}
      // What is coming is the agenda; what already happened is a record of it.
      initialColumnFilters={[{ id: "when", value: ["upcoming"] }]}
      filters={
        <SelectControl
          label={labels.state}
          value={state}
          onValueChange={setState}
          options={[
            { value: "active", label: labels.active },
            { value: "archived", label: labels.archived },
            { value: "", label: labels.anyState },
          ]}
          className="w-40"
        />
      }
    />
  );
}
