"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Eye, ExternalLink, EyeOff, SquarePen, Trash2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import {
  deleteActivity,
  unpublishActivityLanguage,
} from "~/app/[locale]/dashboard/activities/actions";
import {
  ACTIVITY_STATES,
  activityStateTone,
  type ActivityStateValue,
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
 * One activity row, already formatted by the server: the state is derived from
 * publications the browser never sees, and the date is written in the editor's
 * locale rather than the machine's.
 */
export type ActivityTableRow = {
  id: string;
  href: string;
  title: string;
  /** The city this applies to, or that it applies everywhere. */
  scopeLabel: string;
  /** The area team that answers for it, when the activity belongs to a city. */
  teamName: string | null;
  owner: string;
  /** The person who entered it, when the record still names one. */
  createdBy: string | null;
  state: ActivityStateValue;
  /** Language codes that are live on the public site right now. */
  publishedLanguages: string[];
  /** The weekdays it opens, already named and in the week's order. */
  openDays: string[];
  /** ISO instant — the sort reads this; the label is what a person reads. */
  updatedAtIso: string;
  updatedLabel: string;
  reviewDue: boolean;
  /** The public page, when this activity has one to open. */
  publicHref: string | null;
  /**
   * Whether this editor answers for the activity. Decided on the server, from
   * who entered it: everyone can read the whole list, and the person who wrote a
   * record is the one who changes it.
   */
  canEdit: boolean;
  /** Only once nothing of it is published, and only for whoever may edit it. */
  canDelete: boolean;
};

export type ActivitiesTableLabels = DataTableLabels & {
  activity: string;
  owner: string;
  createdBy: string;
  status: string;
  languages: string;
  openDays: string;
  updated: string;
  cityTeam: string;
  reviewDue: string;
  none: string;
  stateLabels: Record<ActivityStateValue, string>;
  languageLabels: Record<string, string>;
  /** Every weekday named, Monday first — the order the day filter is read in. */
  dayLabels: string[];
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
  remove: string;
  removeTitle: string;
  removeBody: string;
  removeConfirm: string;
  removed: string;
  cancel: string;
  unpublished: string;
  actionError: string;
};

/**
 * The activity list as a table: what it is, who answers for it, where it stands,
 * which languages are live, and when it last moved. Every column filters by the
 * values it actually holds — several at once — because an editor arrives looking
 * for a subset, not for the whole catalogue.
 */
export function ActivitiesTable({
  rows,
  locale,
  labels,
  createAction,
}: {
  rows: ActivityTableRow[];
  locale: string;
  labels: ActivitiesTableLabels;
  createAction?: ReactNode;
}) {
  // Only the languages some activity is actually published in: a menu offering
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

  // Days keep the week's order rather than the alphabet's or the rows' — Monday
  // before Tuesday is the only order a list of days can be read in.
  const dayOptions = useMemo(() => {
    const open = new Set(rows.flatMap((row) => row.openDays));
    return labels.dayLabels
      .filter((day) => open.has(day))
      .map((day) => ({ value: day, label: day }));
  }, [rows, labels]);

  const columns = useMemo<ColumnDef<ActivityTableRow>[]>(
    () => [
      {
        id: "activity",
        accessorFn: (row) => row.title,
        header: () => labels.activity,
        // No filter here: every name is its own value, so a menu of them would
        // be a menu of the rows — that is what the search box is for.
        meta: { label: labels.activity },
        enableHiding: false,
        cell: ({ row }) => (
          <DataTableTitle
            href={row.original.href}
            title={row.original.title}
            sub={`${row.original.scopeLabel}${
              row.original.teamName
                ? ` · ${labels.cityTeam}: ${row.original.teamName}`
                : ""
            }`}
            note={
              row.original.reviewDue ? (
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                  <Chip tone="warn">{labels.reviewDue}</Chip>
                </p>
              ) : null
            }
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
        // Filterable, because "everything I entered" is the question this column
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
            options: ACTIVITY_STATES.map((value) => ({
              value,
              label: labels.stateLabels[value],
            })),
          },
        },
        cell: ({ row }) => (
          <Chip tone={activityStateTone[row.original.state]}>
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
        id: "openDays",
        accessorFn: (row) => row.openDays.join(" "),
        header: () => labels.openDays,
        meta: { label: labels.openDays, filter: { options: dayOptions } },
        // A row holds a set of days, so "open on Saturday" is a question about
        // membership rather than about the cell's text.
        filterFn: (row, _columnId, filterValue) => {
          const wanted = filterValue as string[] | undefined;
          if (!wanted || wanted.length === 0) return true;
          return wanted.some((day) => row.original.openDays.includes(day));
        },
        cell: ({ row }) => (
          <DataTableChips items={row.original.openDays} empty={labels.none} />
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
    [labels, languageOptions, dayOptions],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      labels={labels}
      rowId={(row) => row.id}
      rowHref={(row) => row.href}
      searchValue={(row) =>
        `${row.title} ${row.owner} ${row.createdBy ?? ""} ${row.scopeLabel} ${row.teamName ?? ""}`
      }
      // The list is a work queue: whatever moved last is what someone is on.
      initialSorting={[{ id: "updated", desc: true }]}
      createAction={createAction}
      rowActions={{
        label: labels.actions,
        render: (row) => (
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
              // Taking a language down is per-language, because that is what
              // publication is: the record does not go anywhere.
              ...(row.canEdit && row.publishedLanguages.length > 0
                ? [{ kind: "separator" as const, key: "publication" }]
                : []),
              ...(row.canEdit
                ? row.publishedLanguages.map((code): RowAction => {
                    const language = labels.languageLabels[code] ?? code;
                    return {
                      kind: "command",
                      key: `unpublish-${code}`,
                      label: labels.unpublish.replace("{language}", language),
                      icon: EyeOff,
                      action: unpublishActivityLanguage,
                      fields: {
                        locale,
                        activityId: row.id,
                        languageCode: code,
                      },
                      success: labels.unpublished,
                      error: labels.actionError,
                      destructive: true,
                      confirm: {
                        title: labels.unpublishTitle.replace(
                          "{language}",
                          language,
                        ),
                        body: labels.unpublishBody.replace(
                          "{language}",
                          language,
                        ),
                        confirm: labels.unpublishConfirm,
                        cancel: labels.cancel,
                      },
                    };
                  })
                : []),
              // Deleting is offered only once nothing of it is published: what
              // the public was told stays true until someone takes it down, so
              // the way out of the list runs through the unpublish entries above.
              ...(row.canDelete
                ? [
                    { kind: "separator" as const, key: "removal" },
                    {
                      kind: "command" as const,
                      key: "delete",
                      label: labels.remove,
                      icon: Trash2,
                      action: deleteActivity,
                      fields: { locale, activityId: row.id },
                      success: labels.removed,
                      error: labels.actionError,
                      destructive: true,
                      confirm: {
                        title: labels.removeTitle,
                        body: labels.removeBody,
                        confirm: labels.removeConfirm,
                        cancel: labels.cancel,
                      },
                    },
                  ]
                : []),
            ]}
          />
        ),
      }}
    />
  );
}
