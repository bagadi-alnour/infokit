"use client";

import type { Locale } from "@infokit/shared/i18n";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import {
  createTag,
  deleteTag,
  setTagActive,
  updateTag,
} from "~/app/[locale]/dashboard/catalogue/actions";
import { Field, Notice, Select, TextInput } from "~/components/admin/workspace";

import {
  ActiveToggle,
  CatalogueCreateDialog,
  NewRowScopeFields,
  ScopeChip,
  ScopeFilter,
  StateFilter,
} from "./catalogue-row-controls";
import type {
  CatalogueLabels,
  CatalogueRights,
  CatalogueTagRow,
} from "./catalogue-rows";
import { DataTable } from "./data-table";
import { DeleteButton } from "./delete-button";
import { EditTagButton } from "./edit-tag-button";
import { SelectControl } from "./select-control";

const COLOR_TOKENS = ["neutral", "accent", "ok", "warn", "danger"] as const;

/** "Public" or "Workspace only" — the words a reader sees for a stored value. */
function visibilityText(
  labels: CatalogueLabels,
  value: CatalogueTagRow["visibility"],
) {
  return value === "public"
    ? labels["catalogue.tags.visibility.public"]
    : labels["catalogue.tags.visibility.workspace"];
}

/**
 * Tags — free labels for search and filters. They never grant access, so the
 * panel says so once and then gets out of the way: the namespace filter is
 * what makes a long list usable.
 */
export function CatalogueTagsPanel({
  rows,
  rights,
  locale,
  labels,
}: {
  rows: CatalogueTagRow[];
  rights: CatalogueRights;
  locale: Locale;
  labels: CatalogueLabels;
}) {
  const [namespace, setNamespace] = useState("");
  const [visibility, setVisibility] = useState("");
  const [scope, setScope] = useState("");
  const [state, setState] = useState("");

  const namespaces = useMemo(
    () => [...new Set(rows.map((row) => row.namespace))].sort(),
    [rows],
  );
  const mixedScopes =
    rows.some((row) => row.organizationId === null) &&
    rows.some((row) => row.organizationId !== null);

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (namespace === "" || row.namespace === namespace) &&
          (visibility === "" || row.visibility === visibility) &&
          (scope === "" ||
            (scope === "global"
              ? row.organizationId === null
              : row.organizationId !== null)) &&
          (state === "" || String(row.active) === state),
      ),
    [namespace, rows, scope, state, visibility],
  );

  const columns = useMemo<ColumnDef<CatalogueTagRow>[]>(() => {
    const editLabels = {
      edit: labels["catalogue.tags.edit"],
      name: labels["catalogue.tags.labelFr"],
      namespace: labels["catalogue.tags.namespace"],
      color: labels["catalogue.tags.color"],
      visibility: labels["catalogue.tags.visibility"],
      visibilityPublic: labels["catalogue.tags.visibility.public"],
      visibilityWorkspace: labels["catalogue.tags.visibility.workspace"],
      save: labels["catalogue.save"],
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
        header: () => labels["catalogue.tags.title"],
        meta: { label: labels["catalogue.tags.title"] },
        enableHiding: false,
        cell: ({ row }) => (
          <>
            <span className="font-medium">{row.original.label}</span>
            <p className="text-copy-muted text-xs">{row.original.code}</p>
          </>
        ),
      },
      {
        id: "namespace",
        accessorFn: (row) => row.namespace,
        header: () => labels["catalogue.tags.namespace"],
        meta: { label: labels["catalogue.tags.namespace"] },
        cell: ({ row }) => (
          <span className="text-copy-muted text-xs">
            {row.original.namespace}
          </span>
        ),
      },
      {
        id: "visibility",
        accessorFn: (row) => visibilityText(labels, row.visibility),
        header: () => labels["catalogue.tags.visibility"],
        meta: { label: labels["catalogue.tags.visibility"] },
        cell: ({ row }) => (
          <span className="text-copy-muted text-xs">
            {visibilityText(labels, row.original.visibility)}
          </span>
        ),
      },
      {
        id: "scope",
        accessorFn: (row) => (row.organizationId === null ? 0 : 1),
        header: () => labels["catalogue.tags.scope"],
        meta: { label: labels["catalogue.tags.scope"] },
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
            action={setTagActive}
            idName="tagId"
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
              <EditTagButton
                action={updateTag}
                locale={locale}
                tagId={row.original.id}
                organizationId={row.original.organizationId}
                name={row.original.labelFr}
                namespace={row.original.namespace}
                colorToken={row.original.colorToken}
                visibility={row.original.visibility}
                labels={editLabels}
              />
              {row.original.canDelete ? (
                <DeleteButton
                  action={deleteTag}
                  idName="tagId"
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
  }, [labels, locale]);

  return (
    <div className="grid gap-4">
      <Notice title={labels["catalogue.tags.title"]}>
        {labels["catalogue.tags.note"]}
      </Notice>
      <DataTable
        columns={columns}
        data={filtered}
        totalCount={rows.length}
        labels={{
          ...labels.table,
          searchPlaceholder: labels["catalogue.search.tags"],
        }}
        rowId={(row) => row.id}
        searchValue={(row) =>
          `${row.label} ${row.labelFr} ${row.code} ${row.namespace}`
        }
        initialSorting={[{ id: "name", desc: false }]}
        filters={
          <>
            {namespaces.length > 1 ? (
              <SelectControl
                label={labels["catalogue.tags.namespace"]}
                value={namespace}
                onValueChange={setNamespace}
                options={[
                  {
                    value: "",
                    label: labels["catalogue.filter.anyNamespace"],
                  },
                  ...namespaces.map((value) => ({ value, label: value })),
                ]}
                className="w-40"
              />
            ) : null}
            <SelectControl
              label={labels["catalogue.tags.visibility"]}
              value={visibility}
              onValueChange={setVisibility}
              options={[
                { value: "", label: labels["catalogue.filter.anyVisibility"] },
                { value: "public", label: visibilityText(labels, "public") },
                {
                  value: "workspace",
                  label: visibilityText(labels, "workspace"),
                },
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
              action={createTag}
              trigger={labels["catalogue.tags.new"]}
              title={labels["catalogue.tags.new"]}
              hint={labels["catalogue.tags.newHint"]}
              submitLabel={labels["catalogue.tags.create"]}
              createdMessage={labels["catalogue.tags.created"]}
              labels={labels}
            >
              <NewRowScopeFields
                rights={rights}
                locale={locale}
                labels={labels}
              />
              <Field label={labels["catalogue.tags.labelFr"]}>
                <TextInput
                  name="labelFr"
                  required
                  minLength={2}
                  autoComplete="off"
                />
              </Field>
              <Field label={labels["catalogue.tags.code"]}>
                <TextInput name="code" placeholder="winter" required />
              </Field>
              <Field
                label={labels["catalogue.tags.namespace"]}
                hint={labels["catalogue.tags.namespaceHint"]}
              >
                <TextInput name="namespace" defaultValue="topic" />
              </Field>
              <Field label={labels["catalogue.tags.visibility"]}>
                <Select name="visibility" defaultValue="public">
                  <option value="public">
                    {visibilityText(labels, "public")}
                  </option>
                  <option value="workspace">
                    {visibilityText(labels, "workspace")}
                  </option>
                </Select>
              </Field>
              <Field label={labels["catalogue.tags.color"]}>
                <Select name="colorToken" defaultValue="neutral">
                  {COLOR_TOKENS.map((tone) => (
                    <option key={tone} value={tone}>
                      {tone}
                    </option>
                  ))}
                </Select>
              </Field>
              <details className="text-copy-muted text-sm">
                <summary className="cursor-pointer">
                  {labels["catalogue.optional"]}
                </summary>
                <div className="mt-2 grid gap-3">
                  <Field label={labels["catalogue.tags.labelEn"]}>
                    <TextInput name="labelEn" />
                  </Field>
                  <Field label={labels["catalogue.tags.labelAr"]}>
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
