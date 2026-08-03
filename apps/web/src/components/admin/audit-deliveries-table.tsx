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
import type { DeliveryRow } from "~/server/audit/query";

/**
 * Every delivery attempt as a dense, expandable log line.
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
    <div className="border-line overflow-x-auto border-y">
      <div
        aria-hidden
        className="text-copy-muted bg-subtle grid min-w-[64rem] grid-cols-[1rem_13rem_minmax(22rem,1fr)_18rem_11rem] items-center gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide"
      >
        <span />
        <span>{labels["audit.delivery.column.when"]}</span>
        <span>{labels["audit.delivery.column.template"]}</span>
        <span>{labels["audit.delivery.column.recipient"]}</span>
        <span>{labels["audit.delivery.column.status"]}</span>
      </div>
      <Accordion multiple className="min-w-[64rem]">
        {rows.map((row) => (
          <AccordionItem key={row.id} value={row.id} className="border-line">
            <AccordionTrigger className="hover:bg-subtle aria-expanded:bg-subtle grid min-h-11 cursor-pointer grid-cols-[1rem_13rem_minmax(22rem,1fr)_18rem_11rem] items-center gap-3 rounded-none px-3 py-2 text-start font-normal hover:no-underline [&_[data-slot=accordion-trigger-icon]]:order-first [&_[data-slot=accordion-trigger-icon]]:m-0">
              <span className="whitespace-nowrap tabular-nums">
                <span className="sr-only">
                  {labels["audit.delivery.column.when"]}:{" "}
                </span>
                <time dateTime={row.createdAt.toISOString()}>
                  {dateTime(row.createdAt, locale)}
                </time>
              </span>
              <span className="flex min-w-0 items-baseline gap-2 overflow-hidden">
                <span className="sr-only">
                  {labels["audit.delivery.column.template"]}:{" "}
                </span>
                <span className="shrink-0 font-mono text-xs">
                  {row.template}
                </span>
                <span className="text-copy-muted truncate text-xs">
                  {row.organizationName ?? platformOwnerLabel}
                </span>
              </span>
              <span className="flex min-w-0 items-baseline gap-2 overflow-hidden">
                <span className="sr-only">
                  {labels["audit.delivery.column.recipient"]}:{" "}
                </span>
                <span className="truncate" dir="ltr">
                  {row.recipientRedacted}
                </span>
                <span className="text-copy-muted shrink-0 text-xs">
                  {labels[`audit.channel.${row.channel}`]}
                </span>
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="sr-only">
                  {labels["audit.delivery.column.status"]}:{" "}
                </span>
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
                <span className="text-copy-muted truncate text-xs">
                  {row.provider ?? "—"}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="bg-subtle h-auto px-10 py-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ReadOnlyField
                  label={labels["audit.delivery.detail.sentAt"]}
                  value={
                    row.sentAt === null ? null : dateTime(row.sentAt, locale)
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
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
