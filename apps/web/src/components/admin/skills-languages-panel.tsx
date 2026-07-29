"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { Chip, Notice } from "~/components/admin/workspace";

import { DataTable } from "./data-table";
import { SelectControl } from "./select-control";
import {
  publishedText,
  type LanguageTableRow,
  type SkillsLabels,
} from "./skills-rows";

/**
 * Languages, read-only. The list is the platform's, and this tab exists to
 * settle one confusion: a language somebody speaks is not the same thing as a
 * language the site is published in. Both are here, and the "Content" column is
 * the difference.
 */
export function SkillsLanguagesPanel({
  rows,
  labels,
}: {
  rows: LanguageTableRow[];
  labels: SkillsLabels;
}) {
  const [published, setPublished] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) => published === "" || String(row.published) === published,
      ),
    [published, rows],
  );

  const columns = useMemo<ColumnDef<LanguageTableRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.name,
        header: () => labels["skills.languages.name"],
        meta: { label: labels["skills.languages.name"] },
        enableHiding: false,
        cell: ({ row }) => (
          <>
            <span className="font-medium">{row.original.name}</span>
            <p className="text-copy-muted text-xs">
              {row.original.secondaryName}
            </p>
          </>
        ),
      },
      {
        id: "code",
        accessorFn: (row) => row.code,
        header: () => labels["skills.languages.code"],
        meta: { label: labels["skills.languages.code"] },
        cell: ({ row }) => (
          <span className="text-copy-muted font-mono text-xs">
            {row.original.code}
          </span>
        ),
      },
      {
        id: "published",
        accessorFn: (row) => (row.published ? 0 : 1),
        header: () => labels["skills.languages.published"],
        meta: { label: labels["skills.languages.published"] },
        cell: ({ row }) => (
          <Chip tone={row.original.published ? "ok" : "neutral"}>
            {publishedText(labels, row.original.published)}
          </Chip>
        ),
      },
      {
        id: "speakers",
        accessorFn: (row) => row.speakerCount,
        header: () => labels["skills.languages.speakers"],
        meta: { label: labels["skills.languages.speakers"], align: "end" },
      },
    ],
    [labels],
  );

  return (
    <div className="grid gap-4">
      <Notice title={labels["skills.languages.title"]}>
        {labels["skills.languages.note"]}
      </Notice>
      <DataTable
        columns={columns}
        data={filtered}
        totalCount={rows.length}
        labels={{
          ...labels.table,
          searchPlaceholder: labels["skills.search.languages"],
        }}
        rowId={(row) => row.code}
        searchValue={(row) => `${row.name} ${row.secondaryName} ${row.code}`}
        initialSorting={[{ id: "published", desc: false }]}
        filters={
          <SelectControl
            label={labels["skills.languages.published"]}
            value={published}
            onValueChange={setPublished}
            options={[
              { value: "", label: labels["skills.languages.filter.any"] },
              { value: "true", label: publishedText(labels, true) },
              { value: "false", label: publishedText(labels, false) },
            ]}
            className="w-44"
          />
        }
      />
    </div>
  );
}
