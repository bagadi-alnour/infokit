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
  actionsColumn,
  scopeColumn,
  stateColumn,
  usageColumn,
} from "./catalogue-columns";
import {
  CatalogueCreateDialog,
  NewRowScopeFields,
  ScopeFilter,
  StateFilter,
} from "./catalogue-row-controls";
import {
  hasMixedScopes,
  matchesScope,
  matchesState,
  tagColorTokens,
  visibilityText,
  type CatalogueLabels,
  type CatalogueRights,
  type CatalogueTagRow,
} from "./catalogue-rows";
import { DataTable } from "./data-table";
import { EditTagButton } from "./edit-tag-button";
import { SelectControl } from "./select-control";

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
  const mixedScopes = hasMixedScopes(rows);

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (namespace === "" || row.namespace === namespace) &&
          (visibility === "" || row.visibility === visibility) &&
          matchesScope(scope, row.organizationId) &&
          matchesState(state, row.active),
      ),
    [namespace, rows, scope, state, visibility],
  );

  const columns = useMemo<ColumnDef<CatalogueTagRow>[]>(
    () => [
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
      scopeColumn<CatalogueTagRow>(labels, labels["catalogue.tags.scope"]),
      usageColumn<CatalogueTagRow>(labels),
      stateColumn<CatalogueTagRow>({
        labels,
        locale,
        action: setTagActive,
        idName: "tagId",
        value: (row) => row.active,
      }),
      actionsColumn<CatalogueTagRow>({
        labels,
        locale,
        action: deleteTag,
        idName: "tagId",
        edit: (row) => (
          <EditTagButton
            action={updateTag}
            locale={locale}
            tagId={row.id}
            organizationId={row.organizationId}
            name={row.labelFr}
            namespace={row.namespace}
            colorToken={row.colorToken}
            visibility={row.visibility}
            labels={labels}
          />
        ),
      }),
    ],
    [labels, locale],
  );

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
            <StateFilter state={state} onChange={setState} labels={labels} />
          </>
        }
        createAction={
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
                  {tagColorTokens.map((tone) => (
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
