"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  Eye,
  ExternalLink,
  EyeOff,
  RotateCcw,
  SquarePen,
  Trash2,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";

import {
  archiveSimulatorFlow,
  restoreSimulatorFlow,
  unpublishSimulatorVersion,
} from "~/app/[locale]/dashboard/simulator/actions";
import {
  SIMULATOR_STATES,
  simulatorStateTone,
  type SimulatorStateValue,
} from "~/components/admin/content-states";
import {
  DataTable,
  DataTableChips,
  DataTableTitle,
  type DataTableLabels,
} from "~/components/admin/data-table";
import { RowActions, type RowAction } from "~/components/admin/row-actions";
import { Chip } from "~/components/admin/workspace";

/**
 * One simulator path, already resolved by the server: the state follows the
 * version a visitor would actually reach, and the dates are written in the
 * editor's locale rather than the machine's.
 */
export type SimulatorTableRow = {
  id: string;
  href: string;
  title: string;
  /** Its URL key, which version this is, and how many steps it holds. */
  sub: string;
  owner: string;
  /** Where it applies: one city, or everywhere. */
  scopeLabel: string;
  /** Who built it, when the record still names them. */
  createdBy: string | null;
  state: SimulatorStateValue;
  /** Language names a step has been written in — the source language included. */
  languages: string[];
  /** ISO instant — the sort reads this; the label is what a person reads. */
  updatedAtIso: string;
  updatedLabel: string;
  reviewDue: boolean;
  /** The visitor's page: the public one when live, the private preview until then. */
  visitorHref: string;
  /** The version publication points at, for taking it down again. */
  publishedVersionId: string | null;
  /**
   * Whether this editor answers for the path. Decided on the server, from who
   * built it: everyone with the permission reads the whole list, and the person
   * who wrote a record is the one who changes it.
   */
  canEdit: boolean;
  /** Only once nothing of it is public, and only for whoever may edit it. */
  canArchive: boolean;
  canRestore: boolean;
};

export type SimulatorTableLabels = DataTableLabels & {
  path: string;
  owner: string;
  city: string;
  createdBy: string;
  status: string;
  languages: string;
  updated: string;
  reviewDue: string;
  none: string;
  stateLabels: Record<SimulatorStateValue, string>;
  /** Row menu: its own name, then one entry per operation. */
  actions: string;
  open: string;
  /** What the same link is called for someone who may only read the record. */
  view: string;
  viewVisitor: string;
  unpublish: string;
  unpublishTitle: string;
  unpublishBody: string;
  unpublishConfirm: string;
  unpublished: string;
  remove: string;
  removeTitle: string;
  removeBody: string;
  removeConfirm: string;
  removed: string;
  restore: string;
  restored: string;
  cancel: string;
  actionError: string;
};

/**
 * The simulator list as a table: what the path is, who answers for it, where it
 * stands, which languages it has been written in, and when it last moved. Every
 * column filters by the values it actually holds — several at once — because an
 * editor arrives looking for a subset, not for the whole map.
 */
export function SimulatorTable({
  rows,
  locale,
  labels,
  createAction,
}: {
  rows: SimulatorTableRow[];
  locale: string;
  labels: SimulatorTableLabels;
  createAction?: ReactNode;
}) {
  // Only the languages some path is actually written in: a menu offering all
  // three when two are empty is a list of empty answers.
  const languageOptions = useMemo(
    () =>
      [...new Set(rows.flatMap((row) => row.languages))]
        .sort((left, right) => left.localeCompare(right))
        .map((language) => ({ value: language, label: language })),
    [rows],
  );

  const columns = useMemo<ColumnDef<SimulatorTableRow>[]>(
    () => [
      {
        id: "path",
        accessorFn: (row) => row.title,
        header: () => labels.path,
        // No filter here: every name is its own value, so a menu of them would
        // be a menu of the rows — that is what the search box is for.
        meta: { label: labels.path },
        enableHiding: false,
        cell: ({ row }) => (
          <DataTableTitle
            href={row.original.href}
            title={row.original.title}
            sub={row.original.sub}
            note={
              row.original.reviewDue ? (
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                  <Chip tone="warn">{labels.reviewDue}</Chip>
                </p>
              ) : null
            }
          />
        ),
      },
      {
        id: "owner",
        accessorFn: (row) => row.owner,
        header: () => labels.owner,
        meta: { label: labels.owner, filter: {} },
        cell: ({ row }) => (
          <span className="text-sm">{row.original.owner}</span>
        ),
      },
      {
        id: "city",
        accessorFn: (row) => row.scopeLabel,
        header: () => labels.city,
        meta: { label: labels.city, filter: {} },
        cell: ({ row }) => (
          <span className="text-copy-muted text-sm">
            {row.original.scopeLabel}
          </span>
        ),
      },
      {
        id: "createdBy",
        // Filterable, because "everything I built" is the question this column
        // is asked; the dash is a value too — nobody is recorded.
        accessorFn: (row) => row.createdBy ?? labels.none,
        header: () => labels.createdBy,
        meta: { label: labels.createdBy, filter: {} },
        cell: ({ row }) => (
          <span className="text-copy-muted text-sm">
            {row.original.createdBy ?? labels.none}
          </span>
        ),
      },
      {
        id: "status",
        // The state itself, not its wording: the filter's options and the
        // column's values have to be the same thing.
        accessorFn: (row) => row.state,
        header: () => labels.status,
        meta: {
          label: labels.status,
          filter: {
            options: SIMULATOR_STATES.map((value) => ({
              value,
              label: labels.stateLabels[value],
            })),
          },
        },
        cell: ({ row }) => (
          <Chip tone={simulatorStateTone[row.original.state]}>
            {labels.stateLabels[row.original.state]}
          </Chip>
        ),
      },
      {
        id: "languages",
        accessorFn: (row) => row.languages.join(" "),
        header: () => labels.languages,
        meta: { label: labels.languages, filter: { options: languageOptions } },
        // A row holds a set of languages, so "written in Arabic" is a question
        // about membership rather than about the cell's text.
        filterFn: (row, _columnId, filterValue) => {
          const wanted = filterValue as string[] | undefined;
          if (!wanted || wanted.length === 0) return true;
          return wanted.some((language) =>
            row.original.languages.includes(language),
          );
        },
        cell: ({ row }) => (
          <DataTableChips items={row.original.languages} empty={labels.none} />
        ),
      },
      {
        id: "updated",
        accessorFn: (row) => row.updatedAtIso,
        header: () => labels.updated,
        meta: { label: labels.updated },
        cell: ({ row }) => (
          <time
            dateTime={row.original.updatedAtIso}
            className="text-copy-muted text-sm tabular-nums"
          >
            {row.original.updatedLabel}
          </time>
        ),
      },
    ],
    [labels, languageOptions],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      labels={labels}
      rowId={(row) => row.id}
      rowHref={(row) => row.href}
      searchValue={(row) =>
        `${row.title} ${row.sub} ${row.owner} ${row.createdBy ?? ""} ${row.scopeLabel}`
      }
      // The list is a work queue: whatever moved last is what someone is on.
      initialSorting={[{ id: "updated", desc: true }]}
      createAction={createAction}
      rowActions={{
        label: labels.actions,
        render: (row) => (
          <RowActions
            label={labels.actions}
            actions={
              [
                // The same editor either way; what changes is what an editor is
                // being invited to do with it.
                {
                  kind: "link",
                  key: "open",
                  label: row.canEdit ? labels.open : labels.view,
                  icon: row.canEdit ? SquarePen : Eye,
                  href: row.href,
                },
                // What a visitor sees: the public page once it is live, and the
                // private preview while it is not.
                {
                  kind: "link",
                  key: "visitor",
                  label: labels.viewVisitor,
                  icon: ExternalLink,
                  href: row.visitorHref,
                  newTab: true,
                },
                ...(row.canEdit && row.publishedVersionId
                  ? [
                      { kind: "separator" as const, key: "publication" },
                      {
                        kind: "command" as const,
                        key: "unpublish",
                        label: labels.unpublish,
                        icon: EyeOff,
                        action: unpublishSimulatorVersion,
                        fields: {
                          locale,
                          flowId: row.id,
                          versionId: row.publishedVersionId,
                        },
                        success: labels.unpublished,
                        error: labels.actionError,
                        destructive: true,
                        confirm: {
                          title: labels.unpublishTitle,
                          body: labels.unpublishBody,
                          confirm: labels.unpublishConfirm,
                          cancel: labels.cancel,
                        },
                      },
                    ]
                  : []),
                // Deleting is offered only once nothing of it is public: the way
                // out of the list runs through the unpublish entry above.
                ...(row.canArchive
                  ? [
                      { kind: "separator" as const, key: "removal" },
                      {
                        kind: "command" as const,
                        key: "delete",
                        label: labels.remove,
                        icon: Trash2,
                        action: archiveSimulatorFlow,
                        fields: { locale, flowId: row.id },
                        success: labels.removed,
                        error: labels.actionError,
                        destructive: true,
                        confirm: {
                          title: labels.removeTitle,
                          body: labels.removeBody,
                          confirm: labels.removeConfirm,
                          cancel: labels.cancel,
                        },
                      },
                    ]
                  : []),
                ...(row.canRestore
                  ? [
                      { kind: "separator" as const, key: "recovery" },
                      {
                        kind: "command" as const,
                        key: "restore",
                        label: labels.restore,
                        icon: RotateCcw,
                        action: restoreSimulatorFlow,
                        fields: { locale, flowId: row.id },
                        success: labels.restored,
                        error: labels.actionError,
                      },
                    ]
                  : []),
              ] satisfies RowAction[]
            }
          />
        ),
      }}
    />
  );
}
