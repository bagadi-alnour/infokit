"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { ActiveToggle, ScopeChip } from "./catalogue-row-controls";
import {
  stateWords,
  type CatalogueLabels,
  type StateKind,
} from "./catalogue-rows";
import { DeleteButton } from "./delete-button";

/**
 * The columns every catalogue table answers the same way: where a row lives,
 * how much is riding on it, whether editors are offered it, and what may be
 * done to it. Written once here so each table is left holding only the columns
 * that are its own — a service's category, a tag's namespace.
 */

/** What every catalogue row carries, whatever kind of row it is. */
type CatalogueRow = {
  id: string;
  canEdit: boolean;
  canDelete: boolean;
  /** Absent on a platform-only row: a category belongs to no association. */
  organizationId?: string | null;
};

type Action = (formData: FormData) => Promise<void>;

/** Platform-wide or this association's — a chip, because it is read at a glance. */
export function scopeColumn<Row extends { organizationId: string | null }>(
  labels: CatalogueLabels,
  header: string,
): ColumnDef<Row> {
  return {
    id: "scope",
    accessorFn: (row) => (row.organizationId === null ? 0 : 1),
    header: () => header,
    meta: { label: header },
    cell: ({ row }) => (
      <ScopeChip organizationId={row.original.organizationId} labels={labels} />
    ),
  };
}

/** How much content points at this row — and so why it may not be deleted. */
export function usageColumn<Row extends { usageCount: number }>(
  labels: CatalogueLabels,
): ColumnDef<Row> {
  return {
    id: "usage",
    accessorFn: (row) => row.usageCount,
    header: () => labels["catalogue.column.usage"],
    meta: { label: labels["catalogue.column.usage"], align: "end" },
  };
}

/** The in-place switch, or the state as a chip for a viewer who may not flip it. */
export function stateColumn<Row extends CatalogueRow>({
  labels,
  locale,
  action,
  idName,
  value,
  kind = "active",
}: {
  labels: CatalogueLabels;
  locale: string;
  action: Action;
  idName: string;
  /** Reads the row's own state field — `enabled` on a category, `active` elsewhere. */
  value: (row: Row) => boolean;
  kind?: StateKind;
}): ColumnDef<Row> {
  const { on } = stateWords(labels, kind);
  return {
    id: "state",
    accessorFn: (row) => (value(row) ? 0 : 1),
    header: () => on,
    meta: { label: on },
    cell: ({ row }) => (
      <ActiveToggle
        action={action}
        idName={idName}
        id={row.original.id}
        active={value(row.original)}
        kind={kind}
        organizationId={row.original.organizationId ?? null}
        canEdit={row.original.canEdit}
        locale={locale}
        labels={labels}
      />
    ),
  };
}

/**
 * Edit and delete, shown only to a viewer who may. The pair and the
 * confirm-then-delete wording are the same in every table; the editor behind
 * the pencil is not, so it is passed in.
 */
export function actionsColumn<Row extends CatalogueRow>({
  labels,
  locale,
  action,
  idName,
  edit,
}: {
  labels: CatalogueLabels;
  locale: string;
  /** The delete action — the editor brings its own. */
  action: Action;
  idName: string;
  edit: (row: Row) => ReactNode;
}): ColumnDef<Row> {
  return {
    id: "actions",
    header: () => labels["catalogue.column.actions"],
    meta: { label: labels["catalogue.column.actions"], align: "end" },
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) =>
      row.original.canEdit ? (
        <span className="inline-flex items-center justify-end gap-1">
          {edit(row.original)}
          {row.original.canDelete ? (
            <DeleteButton
              action={action}
              idName={idName}
              id={row.original.id}
              organizationId={row.original.organizationId ?? null}
              locale={locale}
              labels={{
                delete: labels["catalogue.delete"],
                confirm: labels["catalogue.deleteConfirm"],
                hint: labels["catalogue.deleteHint"],
                cancel: labels["catalogue.cancel"],
              }}
            />
          ) : null}
        </span>
      ) : null,
  };
}
