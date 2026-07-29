"use client";

import type { Locale } from "@infokit/shared/i18n";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  decideSkillRecord,
  decideTrainingRecord,
} from "~/app/[locale]/dashboard/skills/actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { Button, EmptyState, Notice } from "~/components/admin/workspace";

import { isRedirectError } from "./catalogue-row-controls";
import { DataTable } from "./data-table";
import { SelectControl } from "./select-control";
import {
  declarationKindText,
  personKindText,
  type SkillsLabels,
  type VerifyTableRow,
} from "./skills-rows";

/**
 * The confirmation queue: declarations whose catalogue row asked for someone to
 * vouch for them. What is recorded is a person's judgement, not a document —
 * there is no licence number and nothing to upload — so the decision is two
 * buttons and no form.
 */

function DecideButtons({
  row,
  organizationId,
  locale,
  labels,
}: {
  row: VerifyTableRow;
  organizationId: string;
  locale: Locale;
  labels: SkillsLabels;
}) {
  const [pending, startTransition] = useTransition();
  const showActionError = useActionErrorToast();

  const decide = (decision: "accept" | "reject") => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("locale", locale);
      formData.set("organizationId", organizationId);
      formData.set("recordId", row.id);
      formData.set("decision", decision);
      const action =
        row.kind === "course" ? decideTrainingRecord : decideSkillRecord;
      try {
        await action(formData);
        toast.success(
          decision === "accept"
            ? labels["skills.verify.accepted"]
            : labels["skills.verify.rejected"],
        );
      } catch (error) {
        if (!isRedirectError(error)) {
          showActionError(error, labels["catalogue.actionError"]);
        }
      }
    });
  };

  return (
    <span className="inline-flex items-center justify-end gap-2">
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          decide("accept");
        }}
      >
        {labels["skills.verify.accept"]}
      </Button>
      <Button
        variant="ghost"
        type="button"
        disabled={pending}
        onClick={() => {
          decide("reject");
        }}
      >
        {labels["skills.verify.reject"]}
      </Button>
    </span>
  );
}

export function SkillsVerifyPanel({
  rows,
  organizationId,
  canDecide,
  locale,
  labels,
}: {
  rows: VerifyTableRow[];
  /** Null when no association is in scope — nobody to decide on whose behalf. */
  organizationId: string | null;
  canDecide: boolean;
  locale: Locale;
  labels: SkillsLabels;
}) {
  const [kind, setKind] = useState("");

  const filtered = useMemo(
    () => rows.filter((row) => kind === "" || row.kind === kind),
    [kind, rows],
  );

  const columns = useMemo<ColumnDef<VerifyTableRow>[]>(() => {
    const list: ColumnDef<VerifyTableRow>[] = [
      {
        id: "person",
        accessorFn: (row) => row.personName,
        header: () => labels["skills.verify.person"],
        meta: { label: labels["skills.verify.person"] },
        enableHiding: false,
        cell: ({ row }) => (
          <>
            <span className="font-medium">{row.original.personName}</span>
            <p className="text-copy-muted text-xs">
              {personKindText(labels, row.original.personKind)}
            </p>
          </>
        ),
      },
      {
        id: "item",
        accessorFn: (row) => row.item,
        header: () => labels["skills.verify.item"],
        meta: { label: labels["skills.verify.item"] },
        cell: ({ row }) => (
          <>
            <span>{row.original.item}</span>
            <p className="text-copy-muted text-xs">
              {declarationKindText(labels, row.original.kind)}
            </p>
          </>
        ),
      },
      {
        id: "declaredOn",
        accessorFn: (row) => row.declaredOn,
        header: () => labels["skills.verify.declaredOn"],
        meta: { label: labels["skills.verify.declaredOn"] },
        // The date arrives already written for the reader, so sorting it would
        // sort the words: the queue comes oldest first from the query instead.
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-copy-muted text-xs">
            {row.original.declaredOn}
          </span>
        ),
      },
    ];
    // Without the right to decide, the queue is still worth reading — the
    // read-only notice above says why there is nothing to press.
    if (canDecide && organizationId) {
      list.push({
        id: "actions",
        header: () => labels["catalogue.column.actions"],
        meta: { label: labels["catalogue.column.actions"], align: "end" },
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <DecideButtons
            row={row.original}
            organizationId={organizationId}
            locale={locale}
            labels={labels}
          />
        ),
      });
    }
    return list;
  }, [canDecide, labels, locale, organizationId]);

  return (
    <div className="grid gap-4">
      <Notice title={labels["skills.verify.title"]}>
        {labels["skills.verify.note"]}
      </Notice>
      {canDecide && organizationId ? null : (
        <Notice tone="warn" title={labels["skills.verify.title"]}>
          {labels["skills.verify.readonly"]}
        </Notice>
      )}
      {rows.length === 0 ? (
        <EmptyState>{labels["skills.verify.empty"]}</EmptyState>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          totalCount={rows.length}
          labels={{
            ...labels.table,
            searchPlaceholder: labels["skills.search.verify"],
          }}
          rowId={(row) => row.id}
          searchValue={(row) => `${row.personName} ${row.item}`}
          filters={
            <SelectControl
              label={labels["skills.verify.item"]}
              value={kind}
              onValueChange={setKind}
              options={[
                { value: "", label: labels["skills.filter.anyKind"] },
                { value: "skill", label: declarationKindText(labels, "skill") },
                {
                  value: "course",
                  label: declarationKindText(labels, "course"),
                },
              ]}
              className="w-44"
            />
          }
        />
      )}
    </div>
  );
}
