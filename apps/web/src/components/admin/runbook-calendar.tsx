"use client";

import { arSA, enGB, fr } from "date-fns/locale";
import { Circle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ComponentProps, useTransition } from "react";

import { TextGradient } from "~/components/text-gradient";
import { Calendar, CalendarDayButton } from "~/components/ui/calendar";
import { cn } from "~/lib/utils";

export type CalendarEventState =
  "scheduled" | "confirmed" | "attention" | "cancelled";

const dotTone: Record<CalendarEventState, string> = {
  scheduled: "text-brand",
  confirmed: "text-ok",
  attention: "text-warn",
  cancelled: "text-danger",
};

const calendarLocales = { ar: arSA, en: enGB, fr } as const;

function fromIso(value: string) {
  return new Date(`${value}T12:00:00`);
}

function toIso(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${String(year)}-${month}-${day}`;
}

function EventDayButton({
  eventDates,
  ...props
}: ComponentProps<typeof CalendarDayButton> & {
  eventDates: Record<string, CalendarEventState[]>;
}) {
  const states = eventDates[toIso(props.day.date)] ?? [];
  return (
    <CalendarDayButton {...props}>
      {props.children}
      {states.length > 0 ? (
        <span
          aria-hidden
          className="flex h-1 items-center justify-center gap-0.5"
        >
          {states.slice(0, 3).map((state, index) => (
            <Circle
              key={`${state}-${String(index)}`}
              className={cn("size-1.5", dotTone[state])}
              fill="currentColor"
              strokeWidth={0}
            />
          ))}
        </span>
      ) : null}
    </CalendarDayButton>
  );
}

export function RunbookCalendar({
  selectedDate,
  month,
  eventDates,
  selectedDateLabel,
  selectedCount,
  labels,
  localeCode,
  weekStartsOn,
}: {
  selectedDate: string;
  month: string;
  eventDates: Record<string, CalendarEventState[]>;
  selectedDateLabel: string;
  selectedCount: number;
  /**
   * The account's own answer, from `core.user_settings`. Not a constant: this
   * column was already being saved by the preferences form and read by nothing,
   * so a person who set Sunday was told it had been saved and then shown a
   * Monday calendar for the rest of the year.
   */
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  labels: {
    activities: string;
    scheduled: string;
    confirmed: string;
    attention: string;
    loading: string;
  };
  localeCode: keyof typeof calendarLocales;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const replaceParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) next.set(key, value);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  return (
    <section aria-label={selectedDateLabel} aria-busy={isPending}>
      <Calendar
        mode="single"
        weekStartsOn={weekStartsOn}
        locale={calendarLocales[localeCode]}
        selected={fromIso(selectedDate)}
        month={fromIso(`${month}-01`)}
        onSelect={(date) => {
          if (!date) return;
          const iso = toIso(date);
          replaceParams({ date: iso, month: iso.slice(0, 7) });
        }}
        onMonthChange={(date) => {
          replaceParams({ month: toIso(date).slice(0, 7) });
        }}
        showOutsideDays={false}
        className="w-full p-0 [--cell-size:--spacing(8)]"
        classNames={{
          root: "w-full",
          month_grid: "w-full border-collapse",
          month_caption: "justify-start px-0",
          caption_label: "text-base font-semibold",
          day: "h-(--cell-size) w-full",
        }}
        components={{
          DayButton: (props) => (
            <EventDayButton {...props} eventDates={eventDates} />
          ),
        }}
      />
      <div className="border-line mt-3 border-t pt-3">
        <div className="min-h-5 text-sm font-semibold">
          {isPending ? (
            <TextGradient role="status" aria-live="polite">
              {labels.loading}
            </TextGradient>
          ) : (
            <p>
              {selectedDateLabel}
              <span className="text-copy-muted font-normal">
                {" "}
                · {selectedCount} {labels.activities}
              </span>
            </p>
          )}
        </div>
        <div className="text-copy-muted mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          <span className="inline-flex items-center gap-1">
            <Circle className="text-brand size-1.5" fill="currentColor" />
            {labels.scheduled}
          </span>
          <span className="inline-flex items-center gap-1">
            <Circle className="text-ok size-1.5" fill="currentColor" />
            {labels.confirmed}
          </span>
          <span className="inline-flex items-center gap-1">
            <Circle className="text-warn size-1.5" fill="currentColor" />
            {labels.attention}
          </span>
        </div>
      </div>
    </section>
  );
}
