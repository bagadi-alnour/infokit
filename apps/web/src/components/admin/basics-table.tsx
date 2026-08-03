"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Archive, EyeOff, SquarePen, TriangleAlert, Undo2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import {
  archiveBasicInformation,
  restoreBasicInformation,
  unpublishBasicInformationLanguage,
} from "~/app/[locale]/dashboard/basics/actions";
import {
  ARTICLE_STATES,
  articleStateTone,
  type ArticleStateValue,
} from "~/components/admin/content-states";
import {
  DataTable,
  DataTableChips,
  DataTableTitle,
  type DataTableLabels,
} from "~/components/admin/data-table";
import { RowActions, type RowAction } from "~/components/admin/row-actions";
import { Chip } from "~/components/admin/workspace";
import { cn } from "~/lib/utils";

/**
 * One contact row, already formatted by the server. The state it shows folds the
 * workflow together with live publications, and the check date is already a
 * sentence: whether a number is overdue is a question about today, which the
 * browser and the server would answer at different moments.
 */
export type BasicInformationTableRow = {
  id: string;
  href: string;
  /** The label, in the workspace language when there is one. */
  title: string;
  slug: string;
  /** "Revision 3" — which version of the text this row describes. */
  revisionLabel: string;
  /** The digits as printed, or null for a tile that opens no call. */
  dial: string | null;
  /** "Called", "Texted" — never shown without the number it qualifies. */
  reachLabel: string | null;
  /** True on the one contact drawn loudest: the number for danger. */
  emergency: boolean;
  owner: string;
  /** The association whose phone this is, when it is not a public service. */
  answeredBy: string;
  state: ArticleStateValue;
  /** Language codes that are live on the public block right now. */
  publishedLanguages: string[];
  /** "Last checked 4 Mar 2026", "Overdue since …", "Never checked". */
  checkedLabel: string;
  /** Whether that sentence is a warning rather than a statement of fact. */
  checkedOverdue: boolean;
  archived: boolean;
  /** Only once nothing of it is published: a live number stays live. */
  canArchive: boolean;
};

export type BasicsTableLabels = DataTableLabels & {
  contact: string;
  dial: string;
  owner: string;
  answeredBy: string;
  status: string;
  languages: string;
  checked: string;
  emergency: string;
  noDial: string;
  none: string;
  stateLabels: Record<ArticleStateValue, string>;
  languageLabels: Record<string, string>;
  /** Row menu: its own name, then one entry per operation. */
  actions: string;
  open: string;
  /** "Unpublish {language}" — the language is named, never guessed at. */
  unpublish: string;
  unpublishTitle: string;
  unpublishBody: string;
  unpublishConfirm: string;
  unpublished: string;
  archive: string;
  archiveTitle: string;
  archiveBody: string;
  archiveConfirm: string;
  archived: string;
  restore: string;
  restored: string;
  cancel: string;
  actionError: string;
};

/**
 * The essential contacts as a table: what the line is called, the digits, who
 * answers them, where they stand, which languages are live, and when somebody
 * last confirmed the number still rings.
 *
 * Rows arrive in the order readers meet them, and no initial sort is applied:
 * on this surface the sequence is itself advice — the number for danger above a
 * volunteer line — so the list opens showing the block, not a ranking of it.
 * Every operation that does not need an editor inside the record is on the row.
 */
export function BasicsTable({
  rows,
  locale,
  labels,
  createAction,
}: {
  rows: BasicInformationTableRow[];
  locale: string;
  labels: BasicsTableLabels;
  /** "New contact" — it sits in the toolbar, beside the list's own controls. */
  createAction?: ReactNode;
}) {
  // Only the languages some contact is actually published in: a menu offering
  // all eleven would mostly be a list of empty answers.
  const languageOptions = useMemo(
    () =>
      [...new Set(rows.flatMap((row) => row.publishedLanguages))]
        .map((code) => ({
          value: code,
          label: labels.languageLabels[code] ?? code,
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [rows, labels],
  );

  const columns = useMemo<ColumnDef<BasicInformationTableRow>[]>(
    () => [
      {
        id: "contact",
        accessorFn: (row) => row.title,
        header: () => labels.contact,
        // No filter: every label is its own value, so a menu of them would be a
        // menu of the rows — that is what the search box is for.
        meta: { label: labels.contact },
        enableHiding: false,
        cell: ({ row }) => (
          <DataTableTitle
            href={row.original.href}
            title={row.original.title}
            marker={
              row.original.emergency ? (
                <TriangleAlert
                  className="text-danger size-3.5 shrink-0"
                  aria-label={labels.emergency}
                />
              ) : null
            }
            sub={`/${row.original.slug} · ${row.original.revisionLabel}`}
          />
        ),
      },
      {
        id: "dial",
        accessorFn: (row) => row.dial ?? "",
        header: () => labels.dial,
        meta: { label: labels.dial },
        cell: ({ row }) =>
          row.original.dial ? (
            <span className="grid">
              {/* Left-to-right whatever the console's language: a phone number
                  reads in the order it is dialled. */}
              <span dir="ltr" className="text-sm font-medium tabular-nums">
                {row.original.dial}
              </span>
              {row.original.reachLabel ? (
                <span className="text-copy-muted text-xs">
                  {row.original.reachLabel}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="text-copy-muted text-sm">{labels.noDial}</span>
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
        id: "answeredBy",
        // Filterable: "every number this association picks up" is the question
        // this column is asked when one of them reorganises.
        accessorFn: (row) => row.answeredBy,
        header: () => labels.answeredBy,
        meta: { label: labels.answeredBy, filter: {} },
        cell: ({ row }) => (
          <span className="text-copy-muted text-sm">
            {row.original.answeredBy}
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
            options: ARTICLE_STATES.map((value) => ({
              value,
              label: labels.stateLabels[value],
            })),
          },
        },
        cell: ({ row }) => (
          <Chip tone={articleStateTone[row.original.state]}>
            {labels.stateLabels[row.original.state]}
          </Chip>
        ),
      },
      {
        id: "languages",
        accessorFn: (row) => row.publishedLanguages.join(" "),
        header: () => labels.languages,
        meta: { label: labels.languages, filter: { options: languageOptions } },
        // A row holds a set of languages, so "published in Arabic" is a question
        // about membership rather than about the cell's text.
        filterFn: (row, _columnId, filterValue) => {
          const wanted = filterValue as string[] | undefined;
          if (!wanted || wanted.length === 0) return true;
          return wanted.some((code) =>
            row.original.publishedLanguages.includes(code),
          );
        },
        cell: ({ row }) => (
          <DataTableChips
            items={row.original.publishedLanguages.map(
              (code) => labels.languageLabels[code] ?? code,
            )}
            empty={labels.none}
          />
        ),
      },
      {
        id: "checked",
        accessorFn: (row) => row.checkedLabel,
        header: () => labels.checked,
        meta: { label: labels.checked },
        cell: ({ row }) => (
          <span
            className={cn(
              "text-sm",
              row.original.checkedOverdue
                ? "text-warn font-medium"
                : "text-copy-muted",
            )}
          >
            {row.original.checkedLabel}
          </span>
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
        `${row.title} ${row.slug} ${row.dial ?? ""} ${row.owner} ${row.answeredBy}`
      }
      createAction={createAction}
      rowActions={{
        label: labels.actions,
        render: (row) => {
          // Taking a language down is per-language, because that is what
          // publication is: the contact itself does not go anywhere.
          const publication: RowAction[] = row.publishedLanguages.map(
            (code): RowAction => {
              const language = labels.languageLabels[code] ?? code;
              return {
                kind: "command",
                key: `unpublish-${code}`,
                label: labels.unpublish.replace("{language}", language),
                icon: EyeOff,
                action: unpublishBasicInformationLanguage,
                fields: { locale, entryId: row.id, languageCode: code },
                success: labels.unpublished,
                error: labels.actionError,
                destructive: true,
                confirm: {
                  title: labels.unpublishTitle.replace("{language}", language),
                  body: labels.unpublishBody.replace("{language}", language),
                  confirm: labels.unpublishConfirm,
                  cancel: labels.cancel,
                },
              };
            },
          );

          /**
           * There is no "submit for review" here. A contact is cleared one
           * language at a time from inside the record, so the row carries the
           * two decisions that are about the whole thing: take it off the block,
           * or put it back.
           */
          const workflow: RowAction[] = row.archived
            ? [
                {
                  kind: "command",
                  key: "restore",
                  label: labels.restore,
                  icon: Undo2,
                  action: restoreBasicInformation,
                  fields: { locale, entryId: row.id },
                  success: labels.restored,
                  error: labels.actionError,
                },
              ]
            : row.canArchive
              ? [
                  {
                    kind: "command",
                    key: "archive",
                    label: labels.archive,
                    icon: Archive,
                    action: archiveBasicInformation,
                    fields: { locale, entryId: row.id },
                    success: labels.archived,
                    error: labels.actionError,
                    destructive: true,
                    confirm: {
                      title: labels.archiveTitle,
                      body: labels.archiveBody,
                      confirm: labels.archiveConfirm,
                      cancel: labels.cancel,
                    },
                  },
                ]
              : [];
          const operations = [...publication, ...workflow];

          return (
            <RowActions
              label={labels.actions}
              actions={[
                {
                  kind: "link",
                  key: "open",
                  label: labels.open,
                  icon: SquarePen,
                  href: row.href,
                },
                // No public link: these are read inside the home page's urgent
                // block and have no page of their own to open.
                ...(operations.length > 0
                  ? [{ kind: "separator" as const, key: "workflow" }]
                  : []),
                ...operations,
              ]}
            />
          );
        },
      }}
    />
  );
}
