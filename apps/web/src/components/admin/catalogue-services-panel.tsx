"use client";

import type { Locale } from "@infokit/shared/i18n";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import {
  createService,
  deleteService,
  setServiceActive,
  updateService,
} from "~/app/[locale]/dashboard/catalogue/actions";
import { Field, Select, TextInput } from "~/components/admin/workspace";
import { TaxonomyIcon, taxonomyIconNames } from "~/components/taxonomy-icon";

import {
  ActiveToggle,
  CatalogueCreateDialog,
  NewRowScopeFields,
  ScopeChip,
  ScopeFilter,
  StateFilter,
} from "./catalogue-row-controls";
import type {
  CatalogueCategoryOption,
  CatalogueLabels,
  CatalogueRights,
  CatalogueServiceRow,
} from "./catalogue-rows";
import { DataTable } from "./data-table";
import { DeleteButton } from "./delete-button";
import { EditServiceButton } from "./edit-service-button";
import { IconPicker } from "./icon-picker";
import { SelectControl } from "./select-control";

/**
 * Services — what an activity offers. The list is the page: an editor arrives
 * looking for one row among dozens, so search, the category filter and paging
 * live here, and adding a service is a dialog over the same list.
 */
export function CatalogueServicesPanel({
  rows,
  categories,
  enabledCategories,
  rights,
  locale,
  labels,
}: {
  rows: CatalogueServiceRow[];
  /** Every category, so a row keeps a disabled one it was already filed under. */
  categories: CatalogueCategoryOption[];
  /** Categories a new service may be filed under. */
  enabledCategories: CatalogueCategoryOption[];
  rights: CatalogueRights;
  locale: Locale;
  labels: CatalogueLabels;
}) {
  const [category, setCategory] = useState("");
  const [scope, setScope] = useState("");
  const [state, setState] = useState("");

  const mixedScopes =
    rows.some((row) => row.organizationId === null) &&
    rows.some((row) => row.organizationId !== null);

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (category === "" || row.categoryId === category) &&
          (scope === "" ||
            (scope === "global"
              ? row.organizationId === null
              : row.organizationId !== null)) &&
          (state === "" || String(row.active) === state),
      ),
    [category, rows, scope, state],
  );

  const columns = useMemo<ColumnDef<CatalogueServiceRow>[]>(() => {
    const editLabels = {
      edit: labels["catalogue.services.edit"],
      name: labels["catalogue.services.nameFr"],
      category: labels["catalogue.services.category"],
      icon: labels["catalogue.services.icon"],
      save: labels["catalogue.services.save"],
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
        accessorFn: (row) => row.name,
        header: () => labels["catalogue.services.title"],
        meta: { label: labels["catalogue.services.title"] },
        enableHiding: false,
        cell: ({ row }) => (
          <>
            <span className="flex items-center gap-2">
              <TaxonomyIcon name={row.original.icon} size={16} />
              <span className="font-medium">{row.original.name}</span>
            </span>
            {row.original.code ? (
              <p className="text-copy-muted ms-6 text-xs">
                {row.original.code}
              </p>
            ) : null}
          </>
        ),
      },
      {
        id: "category",
        accessorFn: (row) => row.categoryLabel,
        header: () => labels["catalogue.services.category"],
        meta: { label: labels["catalogue.services.category"] },
        cell: ({ row }) => (
          <span className="text-copy-muted text-xs">
            {row.original.categoryLabel}
          </span>
        ),
      },
      {
        id: "scope",
        accessorFn: (row) => (row.organizationId === null ? 0 : 1),
        header: () => labels["catalogue.services.scope"],
        meta: { label: labels["catalogue.services.scope"] },
        cell: ({ row }) => (
          <ScopeChip
            organizationId={row.original.organizationId}
            labels={labels}
          />
        ),
      },
      {
        id: "usage",
        accessorFn: (row) => row.usageCount,
        header: () => labels["catalogue.column.usage"],
        meta: { label: labels["catalogue.column.usage"], align: "end" },
      },
      {
        id: "state",
        accessorFn: (row) => (row.active ? 0 : 1),
        header: () => labels["catalogue.status.active"],
        meta: { label: labels["catalogue.status.active"] },
        cell: ({ row }) => (
          <ActiveToggle
            action={setServiceActive}
            idName="serviceId"
            id={row.original.id}
            active={row.original.active}
            organizationId={row.original.organizationId}
            canEdit={row.original.canEdit}
            locale={locale}
            labels={labels}
            onLabel={labels["catalogue.status.active"]}
            offLabel={labels["catalogue.status.inactive"]}
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
              <EditServiceButton
                action={updateService}
                locale={locale}
                serviceId={row.original.id}
                organizationId={row.original.organizationId}
                name={row.original.nameFr}
                icon={row.original.icon}
                categoryId={row.original.categoryId}
                categories={categories}
                icons={taxonomyIconNames}
                labels={editLabels}
                steward={{
                  values: row.original.steward,
                  labels: labels.shared,
                }}
              />
              {row.original.canDelete ? (
                <DeleteButton
                  action={deleteService}
                  idName="serviceId"
                  id={row.original.id}
                  organizationId={row.original.organizationId}
                  locale={locale}
                  labels={deleteLabels}
                />
              ) : null}
            </span>
          ) : null,
      },
    ];
  }, [categories, labels, locale]);

  return (
    <DataTable
      columns={columns}
      data={filtered}
      totalCount={rows.length}
      labels={{
        ...labels.table,
        searchPlaceholder: labels["catalogue.search.services"],
      }}
      rowId={(row) => row.id}
      searchValue={(row) =>
        `${row.name} ${row.nameFr} ${row.code ?? ""} ${row.categoryLabel}`
      }
      initialSorting={[{ id: "name", desc: false }]}
      filters={
        <>
          <SelectControl
            label={labels["catalogue.services.category"]}
            value={category}
            onValueChange={setCategory}
            options={[
              { value: "", label: labels["catalogue.filter.anyCategory"] },
              ...categories.map((option) => ({
                value: option.id,
                label: option.label,
              })),
            ]}
            className="w-44"
          />
          {mixedScopes ? (
            <ScopeFilter scope={scope} onChange={setScope} labels={labels} />
          ) : null}
          <StateFilter
            state={state}
            onChange={setState}
            labels={labels}
            onLabel={labels["catalogue.status.active"]}
            offLabel={labels["catalogue.status.inactive"]}
          />
        </>
      }
      toolbarExtra={
        rights.canManageGlobal || rights.canManageOrg ? (
          <CatalogueCreateDialog
            action={createService}
            trigger={labels["catalogue.services.new"]}
            title={labels["catalogue.services.new"]}
            hint={labels["catalogue.services.newHint"]}
            submitLabel={labels["catalogue.services.create"]}
            createdMessage={labels["catalogue.services.created"]}
            labels={labels}
            disabled={enabledCategories.length === 0}
          >
            <NewRowScopeFields
              rights={rights}
              locale={locale}
              labels={labels}
            />
            <Field label={labels["catalogue.services.nameFr"]}>
              <TextInput
                name="nameFr"
                required
                minLength={2}
                autoComplete="off"
              />
            </Field>
            <Field label={labels["catalogue.services.category"]}>
              <Select name="categoryId" required>
                {enabledCategories.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={labels["catalogue.services.icon"]}>
              <IconPicker
                name="icon"
                icons={taxonomyIconNames}
                ariaLabel={labels["catalogue.services.icon"]}
                searchLabel={labels["catalogue.icon.search"]}
                emptyLabel={labels["catalogue.icon.empty"]}
              />
            </Field>
            <Field
              label={labels["catalogue.services.code"]}
              hint={labels["catalogue.services.codeHint"]}
            >
              <TextInput name="code" placeholder="hot_shower" />
            </Field>
            <details className="text-copy-muted text-sm">
              <summary className="cursor-pointer">
                {labels["catalogue.optional"]}
              </summary>
              <div className="mt-2 grid gap-3">
                <Field label={labels["catalogue.services.nameEn"]}>
                  <TextInput name="nameEn" />
                </Field>
                <Field label={labels["catalogue.services.nameAr"]}>
                  <TextInput name="nameAr" dir="rtl" />
                </Field>
              </div>
            </details>
          </CatalogueCreateDialog>
        ) : null
      }
    />
  );
}
