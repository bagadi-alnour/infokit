"use client";

import { formatMessage } from "@infokit/shared/i18n";
import {
  Bell,
  CalendarOff,
  CircleCheckBig,
  CircleHelp,
  Clock3,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

/** Why a record is waiting on an editor — the freshness mechanic, verbatim. */
export type AttentionKind =
  "never" | "overdue" | "uncertain" | "noSchedule" | "dueSoon";

export interface AttentionItem {
  id: string;
  label: string;
  kind: AttentionKind;
  href: string;
}

const kindIcon = {
  never: TriangleAlert,
  overdue: TriangleAlert,
  uncertain: CircleHelp,
  noSchedule: CalendarOff,
  dueSoon: Clock3,
} as const;

const kindTone: Record<AttentionKind, string> = {
  never: "text-warn",
  overdue: "text-warn",
  uncertain: "text-warn",
  noSchedule: "text-copy-muted",
  dueSoon: "text-copy-muted",
};

/**
 * The attention queue as a bell: what needs confirming, reachable from every
 * console page instead of only from the runbook.
 */
export function AdminNotifications({
  items,
  total,
  reviewAllHref,
  labels,
}: {
  items: readonly AttentionItem[];
  total: number;
  reviewAllHref: string;
  labels: {
    open: string;
    title: string;
    empty: string;
    reviewAll: string;
    more: string;
    reasons: Record<AttentionKind, string>;
  };
}) {
  const [open, setOpen] = useState(false);
  const hidden = Math.max(total - items.length, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              total > 0 ? `${labels.open} (${String(total)})` : labels.open
            }
            title={labels.open}
          />
        }
      >
        <Bell aria-hidden />
        {total > 0 ? (
          <span className="bg-warn text-canvas absolute -top-0.5 end-0 min-w-4 rounded-full px-1 text-[10px] font-bold leading-4">
            {total > 9 ? "9+" : total}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <div className="border-line flex items-center gap-2 border-b px-3 py-2.5">
          <span className="text-sm font-semibold">{labels.title}</span>
          {total > 0 ? (
            <span className="bg-warn-soft text-warn ms-auto rounded-full px-2 py-0.5 text-xs font-semibold">
              {total}
            </span>
          ) : null}
        </div>
        {items.length > 0 ? (
          <ul className="max-h-80 overflow-y-auto p-1">
            {items.map((item) => {
              const Glyph = kindIcon[item.kind];
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="hover:bg-brand-soft focus-visible:ring-brand/50 flex items-start gap-2.5 rounded-md p-2 outline-none focus-visible:ring-2"
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    <Glyph
                      className={`mt-0.5 size-4 shrink-0 ${kindTone[item.kind]}`}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {item.label}
                      </span>
                      <span className="text-copy-muted block text-xs">
                        {labels.reasons[item.kind]}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-copy-muted flex items-center gap-2 px-3 py-4 text-sm">
            <CircleCheckBig className="text-ok size-4 shrink-0" aria-hidden />
            {labels.empty}
          </p>
        )}
        <div className="border-line border-t p-1">
          <Link
            href={reviewAllHref}
            className="hover:bg-brand-soft focus-visible:ring-brand/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium outline-none focus-visible:ring-2"
            onClick={() => {
              setOpen(false);
            }}
          >
            {labels.reviewAll}
            {hidden > 0 ? (
              <span className="text-copy-muted ms-auto text-xs font-normal">
                {formatMessage(labels.more, { count: String(hidden) })}
              </span>
            ) : null}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
