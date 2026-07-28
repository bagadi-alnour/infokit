"use client";

import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Columns3,
  ListFilter,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

import { SelectControl } from "./select-control";

export type DataTableLabels = {
  search: string;
  searchPlaceholder: string;
  columns: string;
  clear: string;
  /**
   * "Filter by {column}" — the header filter's accessible name. Left out, the
   * column's own name has to do the job on its own.
   */
  filterBy?: string;
  noMatch: string;
  rowsPerPage: string;
  /** "{shown} of {total}" — both placeholders are replaced. */
  results: string;
  /** "Page {page} of {pages}" — both placeholders are replaced. */
  page: string;
  previous: string;
  next: string;
};

/**
 * Column extras the table itself needs: the human name used by the column
 * menu (a header rendered as a sort button is not a usable label there) and
 * the numeric alignment.
 */
export type DataTableColumnMeta = {
  label: string;
  align?: "start" | "end";
  /**
   * Turns the header into a filter: a menu of values, any number of which can
   * be ticked at once. `options` fixes the list and its wording — for a column
   * whose cells are chips or dates, the raw value is not what to offer — and
   * left out, the list is whatever values the column actually holds.
   */
  filter?: {
    options?: readonly { value: string; label: string }[];
  };
};

/**
 * The cell that names the record. A title is the longest thing in a row and the
 * reason a table drifts wider than its screen, pushing the columns that qualify
 * it — who owns it, what state it is in — off the edge. So it is capped and cut
 * with an ellipsis: the whole of it stays on the pointer, and the record it
 * opens is one click away.
 */
export function DataTableTitle({
  href,
  title,
  marker,
  sub,
  note,
}: {
  href: string;
  title: string;
  /** A glyph qualifying the title itself, kept beside it as the text is cut. */
  marker?: ReactNode;
  /**
   * The second line: what it belongs to, which revision, where it is. Text
   * rather than markup, because it is cut the same way and has to be readable
   * from the pointer once it is.
   */
  sub?: string;
  /** Chips under it, for a state the row has to carry into the list. */
  note?: ReactNode;
}) {
  return (
    <div className="grid max-w-48 gap-0.5 lg:max-w-64">
      <span className="flex min-w-0 items-center gap-1.5">
        <Link
          href={href}
          title={title}
          className="truncate font-medium hover:underline"
        >
          {title}
        </Link>
        {marker}
      </span>
      {sub ? (
        <p className="text-copy-muted truncate text-xs" title={sub}>
          {sub}
        </p>
      ) : null}
      {note}
    </div>
  );
}

/**
 * A set of values one row carries: the languages it is live in, the days it is
 * open. Past the first few the set stops being read and starts being a column
 * wide enough to push the rest of the row off the table, so what is left over is
 * counted instead — and the count carries the names it is standing in for.
 */
export function DataTableChips({
  items,
  empty,
  limit = 3,
}: {
  items: readonly string[];
  /** What an empty set reads as — punctuation, not a sentence. */
  empty: string;
  limit?: number;
}) {
  if (items.length === 0) {
    return <span className="text-copy-muted text-sm">{empty}</span>;
  }
  const rest = items.slice(limit);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {items.slice(0, limit).map((item) => (
        <span
          key={item}
          className="border-line text-copy-muted rounded border px-1.5 py-0.5 text-[0.7rem] font-medium"
        >
          {item}
        </span>
      ))}
      {rest.length > 0 ? (
        <span
          title={rest.join(", ")}
          className="border-line text-copy-muted rounded border border-dashed px-1.5 py-0.5 text-[0.7rem] font-medium tabular-nums"
        >
          +{rest.length}
        </span>
      ) : null}
    </span>
  );
}

const PAGE_SIZES = [10, 25, 50, 100] as const;

function fill(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  );
}

/**
 * A header filter holds the set of values that were ticked, so "either of these
 * two" is one filter rather than a choice between them. An empty set is no
 * filter at all, which is what clearing it leaves behind.
 */
const someOfFilter: FilterFn<unknown> = (row, columnId, filterValue) => {
  const wanted = filterValue as string[] | undefined;
  if (!wanted || wanted.length === 0) return true;
  return wanted.includes(String(row.getValue(columnId)));
};

/**
 * The filter menu of one column: every value it holds, ticked or not. It sits in
 * the header because that is where the question is asked — "which of these
 * rows" — and narrowing by two audiences at once should not need two controls.
 */
function ColumnFilterMenu<Row>({
  column,
  meta,
  labels,
  onFiltered,
}: {
  column: Column<Row>;
  meta: DataTableColumnMeta;
  labels: DataTableLabels;
  onFiltered: () => void;
}) {
  const active = (column.getFilterValue() as string[] | undefined) ?? [];
  // Recomputed on every render on purpose: the faceted values follow the data,
  // and a memo keyed on the column would keep yesterday's list.
  const options =
    meta.filter?.options ??
    [...column.getFacetedUniqueValues().keys()]
      .filter(
        (value): value is string => typeof value === "string" && value !== "",
      )
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({ value, label: value }));
  const name = labels.filterBy
    ? fill(labels.filterBy, { column: meta.label })
    : meta.label;

  const set = (next: string[]) => {
    column.setFilterValue(next.length === 0 ? undefined : next);
    onFiltered();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={name}
            className={cn(
              "size-6 min-h-0",
              active.length > 0 && "text-brand bg-brand-soft",
            )}
          >
            <ListFilter aria-hidden />
            {active.length > 0 ? (
              <span className="text-[10px] font-semibold tabular-nums">
                {active.length}
              </span>
            ) : null}
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="max-h-72 w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.length === 0 ? (
            <DropdownMenuLabel className="normal-case">
              {labels.noMatch}
            </DropdownMenuLabel>
          ) : (
            options.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={active.includes(option.value)}
                onCheckedChange={(checked) => {
                  set(
                    checked
                      ? [...active, option.value]
                      : active.filter((value) => value !== option.value),
                  );
                }}
                closeOnClick={false}
              >
                <span className="truncate">{option.label}</span>
              </DropdownMenuCheckboxItem>
            ))
          )}
          {active.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  set([]);
                }}
              >
                <X aria-hidden />
                {labels.clear}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The console's record table: search, filters, column visibility, sorting and
 * pagination over a list already delivered by the server. Lists in this
 * workspace are counted in dozens, so filtering client-side keeps every
 * keystroke instant and leaves the server one query per page load.
 *
 * Rows are links when `rowHref` is given: the whole row reacts to a click,
 * while the cell marked as the row's title carries the real anchor so the
 * keyboard and "open in a new tab" keep working (docs/DESIGN-SYSTEM.md §5).
 */
export function DataTable<Row>({
  columns,
  data,
  labels,
  searchValue,
  initialSorting = [],
  initialColumnVisibility = {},
  initialColumnFilters = [],
  filters,
  rowActions,
  rowHref,
  rowId,
  createAction,
  totalCount,
}: {
  columns: ColumnDef<Row>[];
  data: Row[];
  labels: DataTableLabels;
  /** Text a row is matched against by the search box. */
  searchValue?: (row: Row) => string;
  initialSorting?: SortingState;
  initialColumnVisibility?: VisibilityState;
  /** Header filters a list opens with — the view an editor asked for by default. */
  initialColumnFilters?: ColumnFiltersState;
  /** Rendered between the search box and the column menu. */
  filters?: ReactNode;
  /**
   * What a row can be operated on with, in its own column at the end. Every
   * table puts the menu in the same place, so an editor never hunts for it.
   */
  rowActions?: { label: string; render: (row: Row) => ReactNode };
  rowHref?: (row: Row) => string;
  rowId: (row: Row) => string;
  /**
   * What adds a record to this list, at the end of the toolbar. It belongs to
   * the table rather than the page header: the list is what an editor is looking
   * at when they find the record they wanted is not there. Left out when the
   * person may not create one — the button is the only place that decision shows.
   */
  createAction?: ReactNode;
  /**
   * How many records exist before the caller's own filters ran, so the count
   * under the table stays honest when `data` is already narrowed down.
   */
  totalCount?: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    initialColumnVisibility,
  );
  const [columnFilters, setColumnFilters] =
    useState<ColumnFiltersState>(initialColumnFilters);

  // A column that offers a filter menu is filtered by the set of ticked values,
  // unless it brought a rule of its own — "upcoming" is not a cell's text.
  const filterableColumns = useMemo(
    () =>
      columns.map((column) => {
        const meta = column.meta as DataTableColumnMeta | undefined;
        if (!meta?.filter || column.filterFn) return column;
        return { ...column, filterFn: someOfFilter as FilterFn<Row> };
      }),
    [columns],
  );

  // The actions column is the table's own, not the caller's: one place at the
  // end of every row, never sorted, never hidden, and never a filter — a menu
  // button has no value to offer either of those.
  const tableColumns = useMemo<ColumnDef<Row>[]>(() => {
    if (!rowActions) return filterableColumns;
    return [
      ...filterableColumns,
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        meta: { label: rowActions.label, align: "end" },
        // The column's name is for the screen reader alone: spelled out over a
        // row of menu buttons it is a word that says nothing.
        header: () => <span className="sr-only">{rowActions.label}</span>,
        cell: ({ row }) => rowActions.render(row.original),
      },
    ];
  }, [filterableColumns, rowActions]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, columnVisibility, columnFilters, globalFilter: search },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setSearch,
    getRowId: rowId,
    globalFilterFn: searchValue
      ? (row, _columnId, filterValue: string) =>
          searchValue(row.original)
            .toLocaleLowerCase()
            .includes(filterValue.trim().toLocaleLowerCase())
      : "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const hideableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide());
  const pageCount = Math.max(table.getPageCount(), 1);
  const pageIndex = table.getState().pagination.pageIndex;
  const shown = table.getFilteredRowModel().rows.length;
  const pageSizeOptions = useMemo(
    () =>
      PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) })),
    [],
  );

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-72">
          <Search
            className="text-copy-muted pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            aria-label={labels.search}
            placeholder={labels.searchPlaceholder}
            onChange={(event) => {
              setSearch(event.target.value);
              table.setPageIndex(0);
            }}
            className="min-h-9 w-full ps-8"
          />
        </div>
        {filters}
        {/* Search and filters read left to right; the column menu is a view
         * setting, not part of that sentence, so it sits at the far end with
         * the table's other controls. */}
        <div className="ms-auto flex flex-wrap items-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="min-h-9">
                  <Columns3 className="size-4" aria-hidden />
                  {labels.columns}
                  <ChevronDown className="size-4" aria-hidden />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-52">
              {/* The label belongs to the group it names — base-ui wires the
               * two together, and a label on its own has nothing to
               * describe. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel>{labels.columns}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideableColumns.map((column) => {
                  const meta = column.columnDef.meta as
                    DataTableColumnMeta | undefined;
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(checked) => {
                        column.toggleVisibility(checked);
                      }}
                      closeOnClick={false}
                    >
                      {meta?.label ?? column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {createAction}
        </div>
      </div>

      <div className="border-line rounded-card overflow-hidden border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-subtle">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as
                    DataTableColumnMeta | undefined;
                  const sorted = header.column.getIsSorted();
                  const content = flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  );
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "text-copy-muted h-auto px-3 py-2 text-[11px] font-semibold uppercase tracking-wide",
                        meta?.align === "end" && "text-end",
                      )}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {/* Reversing the row reverses `justify` with it, so `end`
                       * packs the label against the column's near edge and
                       * leaves it hanging to the left of the numbers it names.
                       * `start` is the reversed row's far side — the edge
                       * `text-end` gives the cells, in either direction. */}
                      <span
                        className={cn(
                          "flex items-center gap-0.5",
                          meta?.align === "end" &&
                            "flex-row-reverse justify-start",
                        )}
                      >
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={cn(
                              "hover:text-ink focus-visible:outline-brand inline-flex min-h-8 items-center gap-1 uppercase focus-visible:outline-2 focus-visible:outline-offset-2",
                              meta?.align === "end" && "flex-row-reverse",
                            )}
                          >
                            {content}
                            {sorted === "asc" ? (
                              <ChevronUp className="size-3.5" aria-hidden />
                            ) : sorted === "desc" ? (
                              <ChevronDown className="size-3.5" aria-hidden />
                            ) : (
                              <ChevronsUpDown
                                className="size-3.5 opacity-50"
                                aria-hidden
                              />
                            )}
                          </button>
                        ) : (
                          content
                        )}
                        {meta?.filter ? (
                          <ColumnFilterMenu
                            column={header.column}
                            meta={meta}
                            labels={labels}
                            onFiltered={() => {
                              table.setPageIndex(0);
                            }}
                          />
                        ) : null}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="text-copy-muted py-10 text-center text-sm"
                >
                  {labels.noMatch}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const href = rowHref?.(row.original);
                return (
                  <TableRow
                    key={row.id}
                    className={cn(href && "cursor-pointer")}
                    onClick={
                      href
                        ? (event) => {
                            // A click that already landed on a link, button or
                            // form control means what that control means.
                            if (
                              event.target instanceof HTMLElement &&
                              event.target.closest("a, button, input, label")
                            ) {
                              return;
                            }
                            router.push(href);
                          }
                        : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as
                        DataTableColumnMeta | undefined;
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "px-3 py-2.5",
                            meta?.align === "end" && "text-end tabular-nums",
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-copy-muted flex flex-wrap items-center justify-between gap-3 text-xs">
        <p role="status">
          {fill(labels.results, {
            shown: String(shown),
            total: String(totalCount ?? data.length),
          })}
          {/* One way back to the whole list, whether it was narrowed by the
           * search box or by a header. */}
          {search !== "" || columnFilters.length > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              className="ms-2"
              onClick={() => {
                setSearch("");
                setColumnFilters([]);
              }}
            >
              <X className="size-3.5" aria-hidden />
              {labels.clear}
            </Button>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span>{labels.rowsPerPage}</span>
            <SelectControl
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(next) => {
                table.setPageSize(Number(next));
              }}
              options={pageSizeOptions}
              label={labels.rowsPerPage}
              className="w-20"
            />
          </label>
          <span className="tabular-nums">
            {fill(labels.page, {
              page: String(pageIndex + 1),
              pages: String(pageCount),
            })}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={labels.previous}
              disabled={!table.getCanPreviousPage()}
              onClick={() => {
                table.previousPage();
              }}
            >
              <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={labels.next}
              disabled={!table.getCanNextPage()}
              onClick={() => {
                table.nextPage();
              }}
            >
              <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
