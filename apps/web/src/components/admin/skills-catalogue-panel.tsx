"use client";

import type { Locale } from "@infokit/shared/i18n";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import {
  createSkill,
  deleteSkill,
  promoteSkillToGlobal,
  setSkillActive,
  updateSkill,
} from "~/app/[locale]/dashboard/skills/actions";
import {
  Field,
  Notice,
  Select,
  TextArea,
  TextInput,
} from "~/components/admin/workspace";

import { actionsColumn, stateColumn } from "./catalogue-columns";
import {
  CatalogueCreateDialog,
  RowEditPopover,
  RowScopeFields,
  StateFilter,
} from "./catalogue-row-controls";
import { matchesState, type CatalogueRights } from "./catalogue-rows";
import { DataTable } from "./data-table";
import { SelectControl } from "./select-control";
import {
  checkColumn,
  declarationsColumn,
  kindColumn,
  ownerColumn,
  PromoteSkillButton,
  reachColumn,
  validityColumn,
} from "./skills-columns";
import { CheckboxField, ReachField } from "./skills-fields";
import {
  kindText,
  matchesKind,
  matchesReach,
  reachText,
  reachValues,
  skillKindValues,
  type SkillsLabels,
  type SkillTableRow,
} from "./skills-rows";

/**
 * One table for both halves of the vocabulary: what InfoKit writes for the whole
 * network, and what an association writes for itself. The rows differ in only
 * two ways — an association's row has an owner and a reach to choose — so the
 * panel takes which half it is showing rather than being written twice.
 */

type Scope = "global" | "ours";

/**
 * The fields a skill is corrected with. Every one of them has to be here: the
 * update action reads each field off the post, so a field left out of this form
 * would arrive empty and blank the column.
 */
function EditSkillButton({
  row,
  scope,
  locale,
  labels,
}: {
  row: SkillTableRow;
  scope: Scope;
  locale: Locale;
  labels: SkillsLabels;
}) {
  return (
    <RowEditPopover
      action={updateSkill}
      label={labels["skills.edit"]}
      save={labels["catalogue.save"]}
      locale={locale}
      idName="skillId"
      id={row.id}
      organizationId={row.organizationId}
    >
      <Field label={labels["skills.kind"]}>
        <Select name="kind" defaultValue={row.kind}>
          {skillKindValues.map((kind) => (
            <option key={kind} value={kind}>
              {kindText(labels, kind)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={labels["skills.nameFr"]}>
        <TextInput
          name="nameFr"
          defaultValue={row.nameFr}
          required
          minLength={2}
          autoComplete="off"
        />
      </Field>
      {scope === "ours" ? (
        <ReachField labels={labels} defaultValue={row.visibility} />
      ) : null}
      <Field
        label={labels["skills.validityMonths"]}
        hint={labels["skills.validityMonthsHint"]}
      >
        <TextInput
          name="validityMonths"
          type="number"
          min={1}
          max={600}
          defaultValue={row.validityMonths ?? ""}
        />
      </Field>
      <CheckboxField
        name="verificationRequired"
        label={labels["skills.verificationRequired"]}
        defaultChecked={row.verificationRequired}
      />
      <details className="text-copy-muted text-sm">
        <summary className="cursor-pointer">
          {labels["catalogue.optional"]}
        </summary>
        <div className="mt-2 grid gap-3">
          <Field label={labels["skills.nameEn"]}>
            <TextInput name="nameEn" defaultValue={row.nameEn} />
          </Field>
          <Field label={labels["skills.nameAr"]}>
            <TextInput name="nameAr" defaultValue={row.nameAr} dir="rtl" />
          </Field>
          <Field label={labels["skills.descriptionFr"]}>
            <TextArea
              name="descriptionFr"
              rows={2}
              defaultValue={row.descriptionFr}
            />
          </Field>
          <Field label={labels["skills.referenceUrl"]}>
            <TextInput
              name="referenceUrl"
              type="url"
              defaultValue={row.referenceUrl}
            />
          </Field>
        </div>
      </details>
    </RowEditPopover>
  );
}

export function SkillsCataloguePanel({
  scope,
  rows,
  rights,
  locale,
  labels,
}: {
  scope: Scope;
  rows: SkillTableRow[];
  rights: CatalogueRights;
  locale: Locale;
  labels: SkillsLabels;
}) {
  const [kind, setKind] = useState("");
  const [reach, setReach] = useState("");
  const [state, setState] = useState("");

  const ours = scope === "ours";
  const canCreate = ours
    ? rights.canManageOrg && rights.scopeOrgId !== null
    : rights.canManageGlobal;

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          matchesKind(kind, row.kind) &&
          (!ours || matchesReach(reach, row.visibility)) &&
          matchesState(state, row.active),
      ),
    [kind, ours, reach, rows, state],
  );

  const columns = useMemo<ColumnDef<SkillTableRow>[]>(() => {
    const list: ColumnDef<SkillTableRow>[] = [
      {
        id: "name",
        accessorFn: (row) => row.name,
        header: () =>
          ours ? labels["skills.ours.title"] : labels["skills.global.title"],
        meta: {
          label: ours
            ? labels["skills.ours.title"]
            : labels["skills.global.title"],
        },
        enableHiding: false,
        cell: ({ row }) => (
          <>
            <span className="font-medium">{row.original.name}</span>
            <p className="text-copy-muted text-xs">{row.original.code}</p>
          </>
        ),
      },
      kindColumn<SkillTableRow>(labels),
    ];
    // An association reads rows other associations shared with it, so who wrote
    // a row is what tells the editable ones from the rest.
    if (ours) {
      list.push(
        ownerColumn<SkillTableRow>(labels),
        reachColumn<SkillTableRow>(labels),
      );
    }
    list.push(
      validityColumn<SkillTableRow>(labels),
      checkColumn<SkillTableRow>(labels),
      declarationsColumn<SkillTableRow>(labels),
      stateColumn<SkillTableRow>({
        labels,
        locale,
        action: setSkillActive,
        idName: "skillId",
        value: (row) => row.active,
      }),
      actionsColumn<SkillTableRow>({
        labels,
        locale,
        action: deleteSkill,
        idName: "skillId",
        edit: (row) => (
          <>
            <EditSkillButton
              row={row}
              scope={scope}
              locale={locale}
              labels={labels}
            />
            {row.canPromote ? (
              <PromoteSkillButton
                action={promoteSkillToGlobal}
                skillId={row.id}
                locale={locale}
                labels={labels}
              />
            ) : null}
          </>
        ),
      }),
    );
    return list;
  }, [labels, locale, ours, scope]);

  return (
    <div className="grid gap-4">
      <Notice
        title={
          ours ? labels["skills.ours.title"] : labels["skills.global.title"]
        }
      >
        {ours ? labels["skills.ours.note"] : labels["skills.global.note"]}
      </Notice>
      {canCreate ? null : (
        <Notice tone="warn" title={labels["skills.title"]}>
          {labels["skills.readonly"]}
        </Notice>
      )}
      <DataTable
        columns={columns}
        data={filtered}
        totalCount={rows.length}
        labels={{
          ...labels.table,
          searchPlaceholder: ours
            ? labels["skills.search.ours"]
            : labels["skills.search.global"],
        }}
        rowId={(row) => row.id}
        searchValue={(row) =>
          `${row.name} ${row.nameFr} ${row.nameEn} ${row.code} ${row.ownerName}`
        }
        initialSorting={[{ id: "name", desc: false }]}
        filters={
          <>
            <SelectControl
              label={labels["skills.kind"]}
              value={kind}
              onValueChange={setKind}
              options={[
                { value: "", label: labels["skills.filter.anyKind"] },
                ...skillKindValues.map((value) => ({
                  value,
                  label: kindText(labels, value),
                })),
              ]}
              className="w-44"
            />
            {ours ? (
              <SelectControl
                label={labels["skills.reach"]}
                value={reach}
                onValueChange={setReach}
                options={[
                  { value: "", label: labels["skills.filter.anyReach"] },
                  ...reachValues.map((value) => ({
                    value,
                    label: reachText(labels, value),
                  })),
                ]}
                className="w-52"
              />
            ) : null}
            <StateFilter state={state} onChange={setState} labels={labels} />
          </>
        }
        createAction={
          canCreate ? (
            <CatalogueCreateDialog
              action={createSkill}
              trigger={
                ours ? labels["skills.ours.new"] : labels["skills.global.new"]
              }
              title={
                ours ? labels["skills.ours.new"] : labels["skills.global.new"]
              }
              hint={
                ours
                  ? labels["skills.ours.newHint"]
                  : labels["skills.global.newHint"]
              }
              submitLabel={labels["skills.add"]}
              createdMessage={
                ours
                  ? labels["skills.ours.created"]
                  : labels["skills.global.created"]
              }
              labels={labels}
            >
              <RowScopeFields
                locale={locale}
                organizationId={ours ? rights.scopeOrgId : null}
              />
              <Field label={labels["skills.kind"]}>
                <Select name="kind" defaultValue="skill">
                  {skillKindValues.map((value) => (
                    <option key={value} value={value}>
                      {kindText(labels, value)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={labels["skills.nameFr"]}>
                <TextInput
                  name="nameFr"
                  required
                  minLength={2}
                  autoComplete="off"
                />
              </Field>
              <Field
                label={labels["skills.code"]}
                hint={labels["skills.codeHint"]}
              >
                <TextInput name="code" placeholder="permit-b" required />
              </Field>
              {ours ? (
                <ReachField
                  labels={labels}
                  hint={labels["skills.ours.scopeNudge"]}
                />
              ) : null}
              <Field
                label={labels["skills.validityMonths"]}
                hint={labels["skills.validityMonthsHint"]}
              >
                <TextInput
                  name="validityMonths"
                  type="number"
                  min={1}
                  max={600}
                />
              </Field>
              <CheckboxField
                name="verificationRequired"
                label={labels["skills.verificationRequired"]}
                hint={labels["skills.verificationRequiredHint"]}
              />
              <details className="text-copy-muted text-sm">
                <summary className="cursor-pointer">
                  {labels["catalogue.optional"]}
                </summary>
                <div className="mt-2 grid gap-3">
                  <Field label={labels["skills.nameEn"]}>
                    <TextInput name="nameEn" />
                  </Field>
                  <Field label={labels["skills.nameAr"]}>
                    <TextInput name="nameAr" dir="rtl" />
                  </Field>
                  <Field label={labels["skills.descriptionFr"]}>
                    <TextArea name="descriptionFr" rows={2} />
                  </Field>
                  <Field
                    label={labels["skills.referenceUrl"]}
                    hint={labels["skills.referenceUrlHint"]}
                  >
                    <TextInput name="referenceUrl" type="url" />
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
