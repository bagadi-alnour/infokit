"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  Archive,
  ExternalLink,
  Eye,
  EyeOff,
  Send,
  Sparkles,
  SquarePen,
  Undo2,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";

import {
  archiveArticle,
  restoreArticle,
  submitArticleForReview,
  unpublishArticleLanguage,
} from "~/app/[locale]/dashboard/articles/actions";
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

/**
 * One article row, already formatted by the server: the state it shows folds the
 * workflow together with live publications, which is a question only the
 * database can answer.
 */
export type ArticleTableRow = {
  id: string;
  href: string;
  title: string;
  slug: string;
  /** "Revision 3" — which version of the text this list is describing. */
  revisionLabel: string;
  featured: boolean;
  owner: string;
  /** Who wrote its first revision, when that account still exists. */
  createdBy: string | null;
  state: ArticleStateValue;
  /** Language codes that are live on the public site right now. */
  publishedLanguages: string[];
  /** ISO instant — the sort reads this; the label is what a person reads. */
  updatedAtIso: string;
  updatedLabel: string;
  /** Whether this entry can still be submitted for review. */
  draft: boolean;
  archived: boolean;
  /** The public page, when this article has one to open. */
  publicHref: string | null;
  /**
   * Whether this editor answers for the article. Decided on the server, from who
   * wrote it: everyone can read the whole list, and the person who wrote a
   * record is the one who changes it.
   */
  canEdit: boolean;
  /** Only once nothing of it is published, and only for whoever may edit it. */
  canArchive: boolean;
};

export type ArticlesTableLabels = DataTableLabels & {
  article: string;
  owner: string;
  createdBy: string;
  status: string;
  languages: string;
  updated: string;
  featured: string;
  none: string;
  stateLabels: Record<ArticleStateValue, string>;
  languageLabels: Record<string, string>;
  /** Row menu: its own name, then one entry per operation. */
  actions: string;
  open: string;
  /** What the same link is called for someone who may only read the record. */
  view: string;
  viewPublic: string;
  /** "Unpublish {language}" — the language is named, never guessed at. */
  unpublish: string;
  unpublishTitle: string;
  unpublishBody: string;
  unpublishConfirm: string;
  unpublished: string;
  submit: string;
  submitted: string;
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
 * The article list as a table: what it is, who owns it, where it stands in the
 * workflow, which languages are live, and when it last moved. The operations
 * that do not need the editor to be inside the record — submit, archive,
 * restore — are on the row itself.
 */
export function ArticlesTable({
  rows,
  locale,
  labels,
  createAction,
}: {
  rows: ArticleTableRow[];
  locale: string;
  labels: ArticlesTableLabels;
  /** "New article", when this editor may write one — it sits in the toolbar. */
  createAction?: ReactNode;
}) {
  // Only the languages some article is actually published in: a menu offering
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

  const columns = useMemo<ColumnDef<ArticleTableRow>[]>(
    () => [
      {
        id: "article",
        accessorFn: (row) => row.title,
        header: () => labels.article,
        // No filter here: every title is its own value, so a menu of them would
        // be a menu of the rows — that is what the search box is for.
        meta: { label: labels.article },
        enableHiding: false,
        cell: ({ row }) => (
          <DataTableTitle
            href={row.original.href}
            title={row.original.title}
            marker={
              row.original.featured ? (
                <Sparkles
                  className="text-brand size-3.5 shrink-0"
                  aria-label={labels.featured}
                />
              ) : null
            }
            sub={`/${row.original.slug} · ${row.original.revisionLabel}`}
          />
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
        id: "createdBy",
        // Filterable, because "everything I wrote" is the question this column
        // is asked; the dash is a value too — nobody is recorded.
        accessorFn: (row) => row.createdBy ?? labels.none,
        header: () => labels.createdBy,
        meta: { label: labels.createdBy, filter: {} },
        cell: ({ row }) => (
          <span className="text-copy-muted text-sm">
            {row.original.createdBy ?? labels.none}
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
        // A row holds a set of languages, so "published in Arabic" is a
        // question about membership rather than about the cell's text.
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
        id: "updated",
        accessorFn: (row) => row.updatedAtIso,
        header: () => labels.updated,
        meta: { label: labels.updated },
        cell: ({ row }) => (
          <time
            dateTime={row.original.updatedAtIso}
            className="text-copy-muted text-sm tabular-nums"
          >
            {row.original.updatedLabel}
          </time>
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
        `${row.title} ${row.slug} ${row.owner} ${row.createdBy ?? ""}`
      }
      // The list is a work queue: whatever moved last is what someone is on.
      initialSorting={[{ id: "updated", desc: true }]}
      createAction={createAction}
      rowActions={{
        label: labels.actions,
        render: (row) => {
          // Taking a language down is per-language, because that is what
          // publication is: the record does not go anywhere.
          const publication: RowAction[] = row.publishedLanguages.map(
            (code): RowAction => {
              const language = labels.languageLabels[code] ?? code;
              return {
                kind: "command",
                key: `unpublish-${code}`,
                label: labels.unpublish.replace("{language}", language),
                icon: EyeOff,
                action: unpublishArticleLanguage,
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

          const workflow: RowAction[] = row.archived
            ? [
                {
                  kind: "command",
                  key: "restore",
                  label: labels.restore,
                  icon: Undo2,
                  action: restoreArticle,
                  fields: { locale, entryId: row.id },
                  success: labels.restored,
                  error: labels.actionError,
                },
              ]
            : [
                ...(row.draft
                  ? [
                      {
                        kind: "command" as const,
                        key: "submit",
                        label: labels.submit,
                        icon: Send,
                        action: submitArticleForReview,
                        fields: { locale, entryId: row.id },
                        success: labels.submitted,
                        error: labels.actionError,
                      },
                    ]
                  : []),
                // Archiving is offered only once nothing of it is published:
                // what the public was told stays true until someone takes it
                // down, so the way out of the list runs through the unpublish
                // entries above.
                ...(row.canArchive
                  ? [
                      {
                        kind: "command" as const,
                        key: "archive",
                        label: labels.archive,
                        icon: Archive,
                        action: archiveArticle,
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
                  : []),
              ];
          const operations = row.canEdit ? [...publication, ...workflow] : [];

          return (
            <RowActions
              label={labels.actions}
              actions={[
                // The same page either way; what changes is what an editor is
                // being invited to do with it.
                {
                  kind: "link",
                  key: "open",
                  label: row.canEdit ? labels.open : labels.view,
                  icon: row.canEdit ? SquarePen : Eye,
                  href: row.href,
                },
                ...(row.publicHref
                  ? [
                      {
                        kind: "link" as const,
                        key: "public",
                        label: labels.viewPublic,
                        icon: ExternalLink,
                        href: row.publicHref,
                        newTab: true,
                      },
                    ]
                  : []),
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
