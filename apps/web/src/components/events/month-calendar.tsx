"use client";

import type { PublicLocale } from "@infokit/shared/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/components/ui/hover-card";
import { cn } from "~/lib/utils";

import {
  EventPreviewCard,
  type EventDetailView,
  type EventPreviewLabels,
} from "./event-preview";
import {
  EVENT_VISIBILITIES,
  eventReachChipClass,
  type EventVisibilityValue,
} from "./visibility";

/**
 * One event as a calendar chip. The keys are local dates in the city's own
 * timezone and the labels are already formatted there, so a chip never lands
 * on the wrong day because the reader's laptop is set to another zone.
 */
export type EventCalendarItem = {
  id: string;
  href: string;
  title: string;
  hostName: string | null;
  /**
   * Left out on the public agenda: every event there is public, so a reach
   * colour would be three shades of the same fact.
   */
  visibility?: EventVisibilityValue;
  cancelled: boolean;
  allDay: boolean;
  /** `YYYY-MM-DD` of the first and last day the event occupies. */
  startKey: string;
  endKey: string;
  /** Start time in the city's clock, or the all-day label. */
  timeLabel: string;
  /** What hovering the chip shows: the whole event, without leaving the month. */
  detail: EventDetailView;
};

export type EventsCalendarLabels = {
  previousMonth: string;
  nextMonth: string;
  today: string;
  empty: string;
  more: string;
  hostPlatform: string;
  cancelled: string;
  /** Given only where reach is a distinction: the console, not the public site. */
  visibilityLabels?: Record<EventVisibilityValue, string>;
  preview: EventPreviewLabels;
};

/** The chip's own colour when reach is not the thing being shown. */
const PLAIN_CHIP = "border-brand/30 bg-brand-soft text-brand";

const VISIBLE_PER_CELL = 3;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function keyOf(date: Date) {
  return `${String(date.getUTCFullYear())}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Calendar arithmetic happens in UTC: these are calendar days, not instants. */
function parseMonth(month: string) {
  const [year, index] = month.split("-").map(Number);
  return { year: year ?? 1970, index: (index ?? 1) - 1 };
}

function shiftMonth(month: string, by: number) {
  const { year, index } = parseMonth(month);
  const shifted = new Date(Date.UTC(year, index + by, 1));
  return `${String(shifted.getUTCFullYear())}-${pad(shifted.getUTCMonth() + 1)}`;
}

/**
 * The weeks of one month, Monday first — six rows at most, and only as many as
 * the month actually needs so a short month does not leave an empty band.
 */
function weeksOf(month: string) {
  const { year, index } = parseMonth(month);
  const first = new Date(Date.UTC(year, index, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  const cells = Math.ceil((lead + days) / 7) * 7;
  const weeks: { key: string; inMonth: boolean; dayNumber: number }[][] = [];
  for (let cell = 0; cell < cells; cell += 1) {
    const date = new Date(Date.UTC(year, index, 1 + cell - lead));
    if (cell % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1]?.push({
      key: keyOf(date),
      inMonth: date.getUTCMonth() === index,
      dayNumber: date.getUTCDate(),
    });
  }
  return weeks;
}

/**
 * The agenda as a month. A multi-day event appears on every day it occupies,
 * because the question a calendar answers is "what is happening that day" and
 * an event that started on Monday is still the answer on Wednesday.
 */
export function EventsCalendar({
  items,
  initialMonth,
  todayKey,
  locale,
  labels,
}: {
  items: EventCalendarItem[];
  /** `YYYY-MM` the calendar opens on — the city's current month. */
  initialMonth: string;
  /** `YYYY-MM-DD` of today in the city's timezone. */
  todayKey: string;
  locale: PublicLocale;
  labels: EventsCalendarLabels;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [expanded, setExpanded] = useState<string | null>(null);

  const weekdayNames = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: "UTC",
    });
    // 2024-01-01 was a Monday, which is where our weeks start.
    return Array.from({ length: 7 }, (_, day) =>
      format.format(new Date(Date.UTC(2024, 0, 1 + day))),
    );
  }, [locale]);

  const monthLabel = useMemo(() => {
    const { year, index } = parseMonth(month);
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, index, 1)));
  }, [locale, month]);

  const byDay = useMemo(() => {
    const map = new Map<string, EventCalendarItem[]>();
    for (const item of items) {
      // Walk the occupied days rather than only the start: the same chip is
      // the answer on each of them.
      const start = new Date(`${item.startKey}T00:00:00Z`);
      const end = new Date(`${item.endKey}T00:00:00Z`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        continue;
      }
      for (
        let cursor = start;
        cursor.getTime() <= end.getTime();
        cursor = new Date(cursor.getTime() + 86_400_000)
      ) {
        const key = keyOf(cursor);
        const list = map.get(key) ?? [];
        list.push(item);
        map.set(key, list);
      }
    }
    return map;
  }, [items]);

  const weeks = useMemo(() => weeksOf(month), [month]);

  return (
    <section aria-label={monthLabel} className="grid gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold capitalize">{monthLabel}</h2>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={labels.previousMonth}
            onClick={() => {
              setMonth((current) => shiftMonth(current, -1));
            }}
          >
            <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setMonth(initialMonth);
            }}
          >
            {labels.today}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={labels.nextMonth}
            onClick={() => {
              setMonth((current) => shiftMonth(current, 1));
            }}
          >
            <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
          </Button>
        </div>
      </header>

      <div className="border-line rounded-card overflow-hidden border">
        <div className="border-line bg-subtle text-copy-muted grid grid-cols-7 border-b text-[11px] font-semibold uppercase tracking-wide">
          {weekdayNames.map((name) => (
            <div key={name} className="px-2 py-1.5 text-center">
              {name}
            </div>
          ))}
        </div>
        <div className="divide-line divide-y">
          {weeks.map((week) => (
            <div
              key={week[0]?.key}
              className="divide-line grid grid-cols-7 divide-x"
            >
              {week.map((cell) => {
                const dayEvents = byDay.get(cell.key) ?? [];
                const isToday = cell.key === todayKey;
                const showAll = expanded === cell.key;
                const shown = showAll
                  ? dayEvents
                  : dayEvents.slice(0, VISIBLE_PER_CELL);
                return (
                  <div
                    key={cell.key}
                    className={cn(
                      "min-h-24 p-1.5 align-top sm:min-h-28",
                      cell.inMonth ? "" : "bg-subtle/50",
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full text-xs",
                          isToday
                            ? "bg-brand text-brand-ink font-semibold"
                            : cell.inMonth
                              ? "text-ink font-medium"
                              : "text-copy-muted",
                        )}
                      >
                        {cell.dayNumber}
                      </span>
                    </div>
                    <ul className="grid gap-1">
                      {shown.map((item) => (
                        <li key={`${cell.key}-${item.id}`}>
                          {/* Hovering asks "what is this"; clicking asks "take
                           * me there". The chip answers the first without
                           * leaving the month and stays an ordinary link for
                           * the second — which is also all a touch screen,
                           * where nothing hovers, ever needs. */}
                          <HoverCard>
                            <HoverCardTrigger
                              render={<Link href={item.href} />}
                              delay={350}
                              className={cn(
                                "hover:ring-brand/40 block rounded-md border px-1.5 py-1 text-start text-[11px] leading-tight hover:ring-1",
                                item.visibility
                                  ? eventReachChipClass[item.visibility]
                                  : PLAIN_CHIP,
                              )}
                            >
                              <span className="font-semibold">
                                {item.timeLabel}
                              </span>
                              <span
                                className={cn(
                                  "ms-1",
                                  item.cancelled && "line-through",
                                )}
                              >
                                {item.title}
                              </span>
                            </HoverCardTrigger>
                            <HoverCardContent>
                              <EventPreviewCard
                                event={item.detail}
                                labels={labels.preview}
                              />
                            </HoverCardContent>
                          </HoverCard>
                        </li>
                      ))}
                    </ul>
                    {dayEvents.length > VISIBLE_PER_CELL && !showAll ? (
                      <button
                        type="button"
                        className="text-copy-muted hover:text-ink mt-1 text-[11px] font-medium underline"
                        onClick={() => {
                          setExpanded(cell.key);
                        }}
                      >
                        {labels.more.replace(
                          "{count}",
                          String(dayEvents.length - VISIBLE_PER_CELL),
                        )}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* The legend only earns its space where the colours mean something. */}
      {labels.visibilityLabels ? (
        <div className="text-copy-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          {EVENT_VISIBILITIES.map((tier) => (
            <span key={tier} className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2.5 rounded-full border",
                  eventReachChipClass[tier],
                )}
                aria-hidden
              />
              {labels.visibilityLabels?.[tier]}
            </span>
          ))}
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="text-copy-muted text-sm">{labels.empty}</p>
      ) : null}
    </section>
  );
}
