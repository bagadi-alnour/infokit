import { formatMessage, type Locale } from "@infokit/shared/i18n";
import type { CatalogMap } from "@infokit/shared/i18n/catalogs";
import { Fragment } from "react";

import {
  Chip,
  EmptyState,
  ReadOnlyField,
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TD,
  TH,
  type ChipTone,
} from "~/components/admin/workspace";
import { formatAuditValue, readAuditChanges } from "~/lib/audit-diff";
import type { AuditEventRow } from "~/server/audit/query";

/**
 * The audited actions, one row each, with everything else behind a disclosure.
 *
 * Six columns answer the question the page is opened with — who did what, when,
 * to which record, and did it work — and the rest of the row (the route, the
 * address, the browser, the field-by-field diff) opens underneath on request.
 * That split is deliberate: an IP address and a browser signature are personal
 * data, and a page that prints them in a column has shown them to everybody who
 * walked past the screen, whether or not anybody needed them.
 *
 * A plain `<details>` element does the disclosing, so the whole table is server
 * rendered and works before — and without — JavaScript.
 */

export type AuditEventsLabels = CatalogMap["dashboard-audit"];

/** The console reads instants on the wall clock of the city it administers. */
const CONSOLE_TIMEZONE = "Europe/Paris";

const outcomeTone: Record<AuditEventRow["outcome"], ChipTone> = {
  success: "ok",
  // A save that did not land is a problem to look into; an attempt that was
  // refused is a person doing something they may not, and it reads louder.
  failure: "warn",
  denied: "danger",
};

function dateTime(value: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: CONSOLE_TIMEZONE,
  }).format(value);
}

/**
 * `metadata` is `jsonb`, so it arrives as `unknown`. It is written as a flat
 * record of primitives (`AuditMetadata`), and anything else is dropped rather
 * than rendered: this column is the one place a caller could have put a shape
 * nobody planned for, and a detail panel is not where to find that out.
 */
function metadataEntries(value: unknown): [string, string][] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }
  const entries: [string, string][] = [];
  for (const [key, entry] of Object.entries(value)) {
    if (entry === null || entry === undefined) continue;
    if (
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean"
    ) {
      entries.push([key, String(entry)]);
    }
  }
  return entries;
}

/** What the actor column says when the event carries no name for them. */
function actorFallback(row: AuditEventRow, labels: AuditEventsLabels): string {
  switch (row.actorType) {
    case "system":
      return labels["audit.actor.system"];
    case "provider":
      return labels["audit.actor.provider"];
    case "support":
      return labels["audit.actor.support"];
    case "translator":
      return labels["audit.actor.translator"];
    default:
      return row.actorUserId
        ? labels["audit.actor.user"]
        : labels["audit.actor.unknown"];
  }
}

export function AuditEventsTable({
  rows,
  locale,
  labels,
  platformOwnerLabel,
}: {
  rows: readonly AuditEventRow[];
  locale: Locale;
  labels: AuditEventsLabels;
  /** What an event owned by no organisation is called. */
  platformOwnerLabel: string;
}) {
  if (rows.length === 0) {
    return <EmptyState>{labels["audit.empty"]}</EmptyState>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TH>{labels["audit.column.when"]}</TH>
          <TH>{labels["audit.column.actor"]}</TH>
          <TH>{labels["audit.column.action"]}</TH>
          <TH>{labels["audit.column.subject"]}</TH>
          <TH>{labels["audit.column.outcome"]}</TH>
          <TH>{labels["audit.column.where"]}</TH>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const changes = readAuditChanges(row.changes);
          const metadata = metadataEntries(row.metadata);
          // The summary line carries whichever of these the row has: a refusal
          // says why, a failure says which error, and everything else says only
          // that there is more to read.
          const summary =
            row.reason ?? row.errorCode ?? labels["audit.detail.show"];
          return (
            <Fragment key={row.id}>
              <TableRow className="border-b-0">
                <TD className="whitespace-nowrap align-top">
                  <time dateTime={row.occurredAt.toISOString()}>
                    {dateTime(row.occurredAt, locale)}
                  </time>
                </TD>
                <TD className="align-top">
                  <span className="block max-w-48 truncate font-medium">
                    {row.actorLabel ?? actorFallback(row, labels)}
                  </span>
                  {row.actorLabel !== null && row.actorType !== "user" ? (
                    <span className="text-copy-muted block text-xs">
                      {actorFallback(row, labels)}
                    </span>
                  ) : null}
                </TD>
                <TD className="align-top">
                  <span className="font-mono text-xs">{row.action}</span>
                </TD>
                <TD className="align-top">
                  <span className="block max-w-56 truncate">
                    {row.subjectLabel ?? row.subjectType ?? "—"}
                  </span>
                  <span className="text-copy-muted block text-xs">
                    {row.organizationName ?? platformOwnerLabel}
                  </span>
                </TD>
                <TD className="align-top">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Chip tone={outcomeTone[row.outcome]}>
                      {labels[`audit.outcome.${row.outcome}`]}
                    </Chip>
                    {/* `info` is the default and says nothing; the loudest
                     * severity is the one worth a second colour. */}
                    {row.severity === "critical" ? (
                      <Chip tone="danger">
                        {labels["audit.severity.critical"]}
                      </Chip>
                    ) : null}
                  </span>
                </TD>
                <TD className="text-copy-muted align-top">
                  <span className="block max-w-56 truncate font-mono text-xs">
                    {row.route ?? "—"}
                  </span>
                  {row.method ? (
                    <span className="block text-xs">{row.method}</span>
                  ) : null}
                </TD>
              </TableRow>
              <TableRow>
                <TD colSpan={6} className="pt-0">
                  <details className="group">
                    <summary className="text-copy-muted hover:text-ink inline-flex cursor-pointer items-center gap-1.5 text-xs marker:content-none [&::-webkit-details-marker]:hidden">
                      <span aria-hidden className="group-open:hidden">
                        ▸
                      </span>
                      <span aria-hidden className="hidden group-open:inline">
                        ▾
                      </span>
                      <span className="max-w-3xl truncate">{summary}</span>
                    </summary>
                    <div className="border-line mt-3 grid gap-4 border-s ps-4">
                      <section>
                        <h3 className="text-copy-muted text-xs font-semibold uppercase tracking-wide">
                          {labels["audit.detail.changes"]}
                        </h3>
                        {changes ? (
                          <>
                            <p className="text-copy-muted mt-1 text-xs">
                              {labels["audit.detail.changesHint"]}
                            </p>
                            <ul className="mt-2 grid gap-1.5">
                              {Object.entries(changes).map(
                                ([field, change]) => (
                                  <li
                                    key={field}
                                    className="grid gap-0.5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-3"
                                  >
                                    <span className="text-copy-muted break-all font-mono text-xs">
                                      {field}
                                    </span>
                                    <span className="text-sm">
                                      <span className="text-copy-muted break-words">
                                        <span className="sr-only">
                                          {labels["audit.detail.before"]}:{" "}
                                        </span>
                                        {formatAuditValue(change.from)}
                                      </span>
                                      <span aria-hidden className="mx-1.5">
                                        →
                                      </span>
                                      <span className="break-words font-medium">
                                        <span className="sr-only">
                                          {labels["audit.detail.after"]}:{" "}
                                        </span>
                                        {formatAuditValue(change.to)}
                                      </span>
                                    </span>
                                  </li>
                                ),
                              )}
                            </ul>
                          </>
                        ) : (
                          <p className="text-copy-muted mt-1 text-sm">
                            {labels["audit.detail.noChanges"]}
                          </p>
                        )}
                      </section>

                      <section>
                        <h3 className="text-copy-muted text-xs font-semibold uppercase tracking-wide">
                          {labels["audit.detail.request"]}
                        </h3>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <ReadOnlyField
                            label={labels["audit.detail.ip"]}
                            value={row.ipAddress}
                          />
                          <ReadOnlyField
                            label={labels["audit.detail.method"]}
                            value={row.method}
                          />
                          <ReadOnlyField
                            label={labels["audit.detail.duration"]}
                            value={
                              row.durationMs === null
                                ? null
                                : formatMessage(
                                    labels["audit.detail.durationMs"],
                                    { count: String(row.durationMs) },
                                  )
                            }
                          />
                          <ReadOnlyField
                            label={labels["audit.detail.severity"]}
                            value={labels[`audit.severity.${row.severity}`]}
                          />
                          <ReadOnlyField
                            label={labels["audit.detail.route"]}
                            value={row.route}
                          />
                          <ReadOnlyField
                            label={labels["audit.detail.requestId"]}
                            value={row.requestId}
                          />
                          <ReadOnlyField
                            label={labels["audit.detail.actorId"]}
                            value={row.actorUserId}
                          />
                          <ReadOnlyField
                            label={labels["audit.detail.subjectId"]}
                            value={row.subjectId}
                          />
                          <div className="sm:col-span-2 lg:col-span-4">
                            <ReadOnlyField
                              label={labels["audit.detail.agent"]}
                              value={row.userAgent}
                            />
                          </div>
                        </div>
                      </section>

                      {row.reason !== null ||
                      row.errorCode !== null ||
                      metadata.length > 0 ? (
                        <section className="grid gap-3 sm:grid-cols-2">
                          {row.reason ? (
                            <ReadOnlyField
                              label={labels["audit.detail.reason"]}
                              value={row.reason}
                            />
                          ) : null}
                          {row.errorCode ? (
                            <ReadOnlyField
                              label={labels["audit.detail.errorCode"]}
                              value={row.errorCode}
                            />
                          ) : null}
                          {metadata.length > 0 ? (
                            <div className="sm:col-span-2">
                              <p className="text-copy-muted text-xs font-semibold uppercase tracking-wide">
                                {labels["audit.detail.metadata"]}
                              </p>
                              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                                {metadata.map(([key, entry]) => (
                                  <li key={key} className="text-sm">
                                    <span className="text-copy-muted font-mono text-xs">
                                      {key}
                                    </span>{" "}
                                    <span className="break-all">{entry}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </section>
                      ) : null}

                      <ReadOnlyField
                        label={labels["audit.detail.eventId"]}
                        value={row.id}
                      />
                    </div>
                  </details>
                </TD>
              </TableRow>
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
