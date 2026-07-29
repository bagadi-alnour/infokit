"use client";

import type { Locale } from "@infokit/shared/i18n";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import {
  createCourse,
  deleteCourse,
  setCourseActive,
  updateCourse,
} from "~/app/[locale]/dashboard/skills/actions";
import {
  Field,
  Notice,
  TextArea,
  TextInput,
} from "~/components/admin/workspace";

import { actionsColumn, stateColumn } from "./catalogue-columns";
import {
  CatalogueCreateDialog,
  NewRowScopeFields,
  RowEditPopover,
  ScopeFilter,
  StateFilter,
} from "./catalogue-row-controls";
import {
  hasMixedScopes,
  matchesScope,
  matchesState,
  type CatalogueRights,
} from "./catalogue-rows";
import { DataTable } from "./data-table";
import { SelectControl } from "./select-control";
import {
  checkColumn,
  declarationsColumn,
  ownerColumn,
  reachColumn,
  validityColumn,
} from "./skills-columns";
import { CheckboxField, ReachField } from "./skills-fields";
import {
  matchesReach,
  reachText,
  reachValues,
  type CourseTableRow,
  type SkillsLabels,
} from "./skills-rows";

/**
 * Courses — the first screen `operations.training_courses` has ever had. Both
 * scopes live in one table because a reader does not care who runs a training
 * until they have found it; the owner column and the scope filter are what
 * separate InfoKit's from the association's.
 */

function EditCourseButton({
  row,
  locale,
  labels,
}: {
  row: CourseTableRow;
  locale: Locale;
  labels: SkillsLabels;
}) {
  return (
    <RowEditPopover
      action={updateCourse}
      label={labels["skills.courses.edit"]}
      save={labels["catalogue.save"]}
      locale={locale}
      idName="courseId"
      id={row.id}
      organizationId={row.organizationId}
    >
      <Field label={labels["skills.courses.titleFr"]}>
        <TextInput
          name="title"
          defaultValue={row.titleFr}
          required
          minLength={2}
          autoComplete="off"
        />
      </Field>
      {/* A platform course is network-wide by definition, so there is nothing
          to choose; the action forces it either way. */}
      {row.organizationId === null ? null : (
        <ReachField labels={labels} defaultValue={row.visibility} />
      )}
      <Field label={labels["skills.courses.provider"]}>
        <TextInput name="provider" defaultValue={row.provider} />
      </Field>
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
          <Field label={labels["skills.courses.titleEn"]}>
            <TextInput name="titleEn" defaultValue={row.titleEn} />
          </Field>
          <Field label={labels["skills.courses.titleAr"]}>
            <TextInput name="titleAr" defaultValue={row.titleAr} dir="rtl" />
          </Field>
          <Field label={labels["skills.courses.description"]}>
            <TextArea
              name="description"
              rows={2}
              defaultValue={row.description}
            />
          </Field>
          <Field label={labels["skills.courses.url"]}>
            <TextInput name="url" type="url" defaultValue={row.url} />
          </Field>
        </div>
      </details>
    </RowEditPopover>
  );
}

export function SkillsCoursesPanel({
  rows,
  rights,
  locale,
  labels,
}: {
  rows: CourseTableRow[];
  rights: CatalogueRights;
  locale: Locale;
  labels: SkillsLabels;
}) {
  const [scope, setScope] = useState("");
  const [reach, setReach] = useState("");
  const [state, setState] = useState("");

  const mixedScopes = hasMixedScopes(rows);
  const canCreate = rights.canManageGlobal || rights.canManageOrg;

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          matchesScope(scope, row.organizationId) &&
          matchesReach(reach, row.visibility) &&
          matchesState(state, row.active),
      ),
    [reach, rows, scope, state],
  );

  const columns = useMemo<ColumnDef<CourseTableRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.title,
        header: () => labels["skills.courses.titleFr"],
        meta: { label: labels["skills.courses.titleFr"] },
        enableHiding: false,
        cell: ({ row }) => (
          <>
            <span className="font-medium">{row.original.title}</span>
            <p className="text-copy-muted text-xs">{row.original.slug}</p>
          </>
        ),
      },
      {
        id: "provider",
        accessorFn: (row) => row.provider,
        header: () => labels["skills.courses.provider"],
        meta: { label: labels["skills.courses.provider"] },
        cell: ({ row }) => (
          <span className="text-copy-muted text-xs">
            {row.original.provider || "—"}
          </span>
        ),
      },
      // The owner already says platform or association, so there is no scope
      // chip beside it saying the same thing in fewer words.
      ownerColumn<CourseTableRow>(labels),
      reachColumn<CourseTableRow>(labels),
      validityColumn<CourseTableRow>(labels),
      checkColumn<CourseTableRow>(labels),
      declarationsColumn<CourseTableRow>(labels),
      stateColumn<CourseTableRow>({
        labels,
        locale,
        action: setCourseActive,
        idName: "courseId",
        value: (row) => row.active,
      }),
      actionsColumn<CourseTableRow>({
        labels,
        locale,
        action: deleteCourse,
        idName: "courseId",
        edit: (row) => (
          <EditCourseButton row={row} locale={locale} labels={labels} />
        ),
      }),
    ],
    [labels, locale],
  );

  return (
    <div className="grid gap-4">
      <Notice title={labels["skills.courses.title"]}>
        {labels["skills.courses.note"]}
      </Notice>
      {canCreate ? null : (
        <Notice tone="warn" title={labels["skills.courses.title"]}>
          {labels["skills.readonly"]}
        </Notice>
      )}
      <DataTable
        columns={columns}
        data={filtered}
        totalCount={rows.length}
        labels={{
          ...labels.table,
          searchPlaceholder: labels["skills.search.courses"],
        }}
        rowId={(row) => row.id}
        searchValue={(row) =>
          `${row.title} ${row.titleFr} ${row.titleEn} ${row.slug} ${row.provider} ${row.ownerName}`
        }
        initialSorting={[{ id: "name", desc: false }]}
        filters={
          <>
            {mixedScopes ? (
              <ScopeFilter scope={scope} onChange={setScope} labels={labels} />
            ) : null}
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
            <StateFilter state={state} onChange={setState} labels={labels} />
          </>
        }
        createAction={
          canCreate ? (
            <CatalogueCreateDialog
              action={createCourse}
              trigger={labels["skills.courses.new"]}
              title={labels["skills.courses.new"]}
              hint={labels["skills.courses.newHint"]}
              submitLabel={labels["skills.add"]}
              createdMessage={labels["skills.courses.created"]}
              labels={labels}
            >
              <NewRowScopeFields
                rights={rights}
                locale={locale}
                labels={labels}
              />
              <Field label={labels["skills.courses.titleFr"]}>
                <TextInput
                  name="title"
                  required
                  minLength={2}
                  autoComplete="off"
                />
              </Field>
              <Field
                label={labels["skills.courses.slug"]}
                hint={labels["skills.codeHint"]}
              >
                <TextInput name="slug" placeholder="ocp-prevention" required />
              </Field>
              <ReachField labels={labels} />
              <Field label={labels["skills.courses.provider"]}>
                <TextInput name="provider" />
              </Field>
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
                  <Field label={labels["skills.courses.titleEn"]}>
                    <TextInput name="titleEn" />
                  </Field>
                  <Field label={labels["skills.courses.titleAr"]}>
                    <TextInput name="titleAr" dir="rtl" />
                  </Field>
                  <Field label={labels["skills.courses.description"]}>
                    <TextArea name="description" rows={2} />
                  </Field>
                  <Field label={labels["skills.courses.url"]}>
                    <TextInput name="url" type="url" />
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
