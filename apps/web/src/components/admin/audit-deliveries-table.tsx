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
import type { DeliveryRow } from "~/server/audit/query";

/**
 * Every email and text the platform handed to a provider, with what happened.
 *
 * Recipients appear masked (`ba***@example.org`, `+33 6 ** ** ** 12`) because
 * that is the only form stored: the full address lives in this table as a keyed
 * hash, which the filter can match but nobody can read back. So an editor can
 * confirm *that* a code went to the right person, and cannot harvest a list of
 * addresses from the page.
 */

export type AuditDeliveriesLabels = CatalogMap["dashboard-audit"];

const CONSOLE_TIMEZONE = "Europe/Paris";

const statusTone: Record<DeliveryRow["status"], ChipTone> = {
  queued: "neutral",
  sent: "ok",
  failed: "danger",
  // Not a fault: a deliberate non-send, which the hint on the chip explains.
  skipped: "neutral",
};

function dateTime(value: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: CONSOLE_TIMEZONE,
  }).format(value);
}

export function AuditDeliveriesTable({
  rows,
  locale,
  labels,
  platformOwnerLabel,
}: {
  rows: readonly DeliveryRow[];
  locale: Locale;
  labels: AuditDeliveriesLabels;
  /** What a message sent on the platform's own behalf is called. */
  platformOwnerLabel: string;
}) {
  if (rows.length === 0) {
    return <EmptyState>{labels["audit.delivery.empty"]}</EmptyState>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TH>{labels["audit.delivery.column.when"]}</TH>
          <TH>{labels["audit.delivery.column.channel"]}</TH>
          <TH>{labels["audit.delivery.column.template"]}</TH>
          <TH>{labels["audit.delivery.column.recipient"]}</TH>
          <TH>{labels["audit.delivery.column.status"]}</TH>
          <TH>{labels["audit.delivery.column.provider"]}</TH>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          // A failure explains itself in the summary line; anything else says
          // only that there is more underneath.
          const summary = row.errorMessage ?? labels["audit.detail.show"];
          return (
            <Fragment key={row.id}>
              <TableRow className="border-b-0">
                <TD className="whitespace-nowrap align-top">
                  <time dateTime={row.createdAt.toISOString()}>
                    {dateTime(row.createdAt, locale)}
                  </time>
                </TD>
                <TD className="align-top">
                  {labels[`audit.channel.${row.channel}`]}
                </TD>
                <TD className="align-top">
                  <span className="block max-w-56 truncate font-mono text-xs">
                    {row.template}
                  </span>
                  <span className="text-copy-muted block text-xs">
                    {row.organizationName ?? platformOwnerLabel}
                  </span>
                </TD>
                <TD className="align-top">
                  <span className="block max-w-48 truncate" dir="ltr">
                    {row.recipientRedacted}
                  </span>
                </TD>
                <TD className="align-top">
                  <Chip
                    tone={statusTone[row.status]}
                    title={
                      row.status === "skipped"
                        ? labels["audit.status.skippedHint"]
                        : undefined
                    }
                  >
                    {labels[`audit.status.${row.status}`]}
                  </Chip>
                </TD>
                <TD className="text-copy-muted align-top">
                  <span className="block max-w-40 truncate text-xs">
                    {row.provider ?? "—"}
                  </span>
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
                    <div className="border-line mt-3 grid gap-3 border-s ps-4 sm:grid-cols-2 lg:grid-cols-4">
                      <ReadOnlyField
                        label={labels["audit.delivery.detail.sentAt"]}
                        value={
                          row.sentAt === null
                            ? null
                            : dateTime(row.sentAt, locale)
                        }
                      />
                      <ReadOnlyField
                        label={labels["audit.delivery.detail.attempt"]}
                        value={row.attempt}
                      />
                      <ReadOnlyField
                        label={labels["audit.delivery.detail.locale"]}
                        value={row.locale}
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
                        label={labels["audit.delivery.detail.messageId"]}
                        value={row.providerMessageId}
                      />
                      <ReadOnlyField
                        label={labels["audit.detail.requestId"]}
                        value={row.requestId}
                      />
                      <ReadOnlyField
                        label={labels["audit.delivery.detail.cause"]}
                        value={row.causeAction}
                      />
                      <ReadOnlyField
                        label={labels["audit.detail.errorCode"]}
                        value={row.errorCode}
                      />
                      {row.errorMessage !== null ? (
                        <div className="sm:col-span-2 lg:col-span-4">
                          <ReadOnlyField
                            label={labels["audit.delivery.detail.error"]}
                            value={row.errorMessage}
                          />
                        </div>
                      ) : null}
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
