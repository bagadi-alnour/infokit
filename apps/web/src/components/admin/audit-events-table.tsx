import { formatMessage, type Locale } from "@infokit/shared/i18n";
import type { CatalogMap } from "@infokit/shared/i18n/catalogs";

import {
  Chip,
  EmptyState,
  ReadOnlyField,
  type ChipTone,
} from "~/components/admin/workspace";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { formatAuditValue, readAuditChanges } from "~/lib/audit-diff";
import type { AuditEventRow } from "~/server/audit/query";

/**
 * The audited actions as a dense log stream, one clickable line per event.
 *
 * The closed line answers when / what / who / outcome without wrapping. The
 * accordion keeps request provenance, personal data and field-level changes
 * behind an intentional click, while still allowing several events to remain
 * open for comparison.
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
    <div className="border-line overflow-x-auto border-y">
      <div
        aria-hidden
        className="text-copy-muted bg-subtle grid min-w-[64rem] grid-cols-[1rem_13rem_minmax(24rem,1fr)_16rem_9rem] items-center gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide"
      >
        <span />
        <span>{labels["audit.column.when"]}</span>
        <span>{labels["audit.column.action"]}</span>
        <span>{labels["audit.column.actor"]}</span>
        <span>{labels["audit.column.outcome"]}</span>
      </div>
      <Accordion multiple className="min-w-[64rem]">
        {rows.map((row) => {
          const changes = readAuditChanges(row.changes);
          const metadata = metadataEntries(row.metadata);
          return (
            <AccordionItem key={row.id} value={row.id} className="border-line">
              <AccordionTrigger className="hover:bg-subtle aria-expanded:bg-subtle grid min-h-11 cursor-pointer grid-cols-[1rem_13rem_minmax(24rem,1fr)_16rem_9rem] items-center gap-3 rounded-none px-3 py-2 text-start font-normal hover:no-underline [&_[data-slot=accordion-trigger-icon]]:order-first [&_[data-slot=accordion-trigger-icon]]:m-0">
                <span className="whitespace-nowrap tabular-nums">
                  <span className="sr-only">
                    {labels["audit.column.when"]}:{" "}
                  </span>
                  <time dateTime={row.occurredAt.toISOString()}>
                    {dateTime(row.occurredAt, locale)}
                  </time>
                </span>
                <span className="flex min-w-0 items-baseline gap-2 overflow-hidden">
                  <span className="sr-only">
                    {labels["audit.column.action"]}:{" "}
                  </span>
                  <span className="shrink-0 font-mono text-xs">
                    {row.action}
                  </span>
                  <span className="text-copy-muted truncate">
                    {row.subjectLabel ?? row.subjectType ?? "—"}
                  </span>
                  <span className="text-copy-muted shrink-0 text-xs">
                    {row.organizationName ?? platformOwnerLabel}
                  </span>
                </span>
                <span className="truncate font-medium">
                  <span className="sr-only">
                    {labels["audit.column.actor"]}:{" "}
                  </span>
                  <span className="block truncate">
                    {row.actorLabel ?? actorFallback(row, labels)}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="sr-only">
                    {labels["audit.column.outcome"]}:{" "}
                  </span>
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
              </AccordionTrigger>
              <AccordionContent className="bg-subtle h-auto px-10 py-4">
                <div className="grid gap-5">
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
                          {Object.entries(changes).map(([field, change]) => (
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
                          ))}
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
                            : formatMessage(labels["audit.detail.durationMs"], {
                                count: String(row.durationMs),
                              })
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
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
