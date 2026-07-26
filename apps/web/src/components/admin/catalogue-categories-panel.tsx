"use client";

import type { Locale } from "@infokit/shared/i18n";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import {
  createCategory,
  deleteCategory,
  setCategoryEnabled,
  updateCategory,
} from "~/app/[locale]/dashboard/catalogue/actions";
import { Field, Notice, TextInput } from "~/components/admin/workspace";
import { TaxonomyIcon, taxonomyIconNames } from "~/components/taxonomy-icon";

import {
  ActiveToggle,
  CatalogueCreateDialog,
  StateFilter,
} from "./catalogue-row-controls";
import type { CatalogueCategoryRow, CatalogueLabels } from "./catalogue-rows";
import { DataTable } from "./data-table";
import { DeleteButton } from "./delete-button";
import { EditCategoryButton } from "./edit-category-button";
import { IconPicker } from "./icon-picker";

/**
 * Categories — how services are grouped in the public filters. Platform-wide
 * by design (docs/DATABASE-SCHEMA.md §7), so an association sees the list and
 * why it cannot change it, rather than controls that would refuse.
 */
export function CatalogueCategoriesPanel({
  rows,
  canManage,
  locale,
  labels,
}: {
  rows: CatalogueCategoryRow[];
  canManage: boolean;
  locale: Locale;
  labels: CatalogueLabels;
}) {
  const [state, setState] = useState("");

  const filtered = useMemo(
    () => rows.filter((row) => state === "" || String(row.enabled) === state),
    [rows, state],
  );

  const columns = useMemo<ColumnDef<CatalogueCategoryRow>[]>(() => {
    const editLabels = {
      edit: labels["catalogue.categories.edit"],
      name: labels["catalogue.categories.labelFr"],
      icon: labels["catalogue.categories.icon"],
      save: labels["catalogue.save"],
      searchIcons: labels["catalogue.icon.search"],
      emptyIcons: labels["catalogue.icon.empty"],
    };
    const deleteLabels = {
      delete: labels["catalogue.delete"],
      confirm: labels["catalogue.deleteConfirm"],
      hint: labels["catalogue.deleteHint"],
      cancel: labels["catalogue.cancel"],
    };

    return [
      {
        id: "name",
        accessorFn: (row) => row.label,
        header: () => labels["catalogue.categories.title"],
        meta: { label: labels["catalogue.categories.title"] },
        enableHiding: false,
        cell: ({ row }) => (
          <>
            <span className="flex items-center gap-2">
              <TaxonomyIcon name={row.original.icon} size={16} />
              <span className="font-medium">{row.original.label}</span>
            </span>
            <p className="text-copy-muted ms-6 text-xs">{row.original.code}</p>
          </>
        ),
      },
      {
        id: "services",
        accessorFn: (row) => row.serviceCount,
        header: () => labels["catalogue.column.services"],
        meta: { label: labels["catalogue.column.services"], align: "end" },
      },
      {
        id: "order",
        accessorFn: (row) => row.displayOrder,
        header: () => labels["catalogue.column.order"],
        meta: { label: labels["catalogue.column.order"], align: "end" },
      },
      {
        id: "state",
        accessorFn: (row) => (row.enabled ? 0 : 1),
        header: () => labels["catalogue.status.enabled"],
        meta: { label: labels["catalogue.status.enabled"] },
        cell: ({ row }) => (
          <ActiveToggle
            action={setCategoryEnabled}
            idName="categoryId"
            id={row.original.id}
            active={row.original.enabled}
            activeField="enabled"
            organizationId={null}
            canEdit={row.original.canEdit}
            locale={locale}
            labels={labels}
            onLabel={labels["catalogue.status.enabled"]}
            offLabel={labels["catalogue.status.disabled"]}
          />
        ),
      },
      {
        id: "actions",
        header: () => labels["catalogue.column.actions"],
        meta: { label: labels["catalogue.column.actions"], align: "end" },
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) =>
          row.original.canEdit ? (
            <span className="inline-flex items-center justify-end gap-1">
              <EditCategoryButton
                action={updateCategory}
                locale={locale}
                categoryId={row.original.id}
                name={row.original.label}
                icon={row.original.icon}
                icons={taxonomyIconNames}
                labels={editLabels}
              />
              {row.original.canDelete ? (
                <DeleteButton
                  action={deleteCategory}
                  idName="categoryId"
                  id={row.original.id}
                  organizationId={null}
                  locale={locale}
                  labels={deleteLabels}
                />
              ) : null}
            </span>
          ) : null,
      },
    ];
  }, [labels, locale]);

  return (
    <div className="grid gap-4">
      {canManage ? null : (
        <Notice title={labels["catalogue.categories.note"]}>
          {labels["catalogue.readonly"]}
        </Notice>
      )}
      <DataTable
        columns={columns}
        data={filtered}
        totalCount={rows.length}
        labels={{
          ...labels.table,
          searchPlaceholder: labels["catalogue.search.categories"],
        }}
        rowId={(row) => row.id}
        searchValue={(row) => `${row.label} ${row.code}`}
        initialSorting={[{ id: "order", desc: false }]}
        filters={
          <StateFilter
            state={state}
            onChange={setState}
            labels={labels}
            onLabel={labels["catalogue.status.enabled"]}
            offLabel={labels["catalogue.status.disabled"]}
          />
        }
        toolbarExtra={
          canManage ? (
            <CatalogueCreateDialog
              action={createCategory}
              trigger={labels["catalogue.categories.new"]}
              title={labels["catalogue.categories.new"]}
              hint={labels["catalogue.categories.newHint"]}
              submitLabel={labels["catalogue.categories.create"]}
              createdMessage={labels["catalogue.categories.created"]}
              labels={labels}
            >
              <input type="hidden" name="locale" value={locale} />
              <Field label={labels["catalogue.categories.labelFr"]}>
                <TextInput
                  name="labelFr"
                  required
                  minLength={2}
                  autoComplete="off"
                />
              </Field>
              <Field label={labels["catalogue.categories.icon"]}>
                <IconPicker
                  name="icon"
                  icons={taxonomyIconNames}
                  ariaLabel={labels["catalogue.categories.icon"]}
                  searchLabel={labels["catalogue.icon.search"]}
                  emptyLabel={labels["catalogue.icon.empty"]}
                />
              </Field>
              <Field label={labels["catalogue.categories.code"]}>
                <TextInput name="code" placeholder="hygiene" required />
              </Field>
              <details className="text-copy-muted text-sm">
                <summary className="cursor-pointer">
                  {labels["catalogue.optional"]}
                </summary>
                <div className="mt-2 grid gap-3">
                  <Field label={labels["catalogue.categories.labelEn"]}>
                    <TextInput name="labelEn" />
                  </Field>
                  <Field label={labels["catalogue.categories.labelAr"]}>
                    <TextInput name="labelAr" dir="rtl" />
                  </Field>
                </div>
              </details>
            </CatalogueCreateDialog>
          ) : null
        }
      />
    </div>
  );
}
