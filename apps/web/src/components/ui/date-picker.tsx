"use client";

import { ar, enUS, fr } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

const calendarLocales = { fr, en: enUS, ar } as const;

function parseDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function serializeDate(value: Date | undefined): string {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${String(year)}-${month}-${day}`;
}

/**
 * The workspace date field: a popover calendar over a hidden `YYYY-MM-DD`
 * input, so a form posts a date the way a `<input type="date">` would.
 *
 * Uncontrolled by default — most forms only need the value at submit. Pass
 * `value` when something else owns it (React Hook Form, a linked end date), and
 * the field follows that value, including a reset back to empty.
 */
export function DatePicker({
  id,
  name,
  form,
  locale,
  value: controlledValue,
  defaultValue,
  placeholder,
  clearLabel,
  onValueChange,
  required = false,
  disabled = false,
  fromYear = 2000,
  toYear = new Date().getFullYear() + 10,
}: {
  id?: string;
  name: string;
  /** Associate the posted value with a form elsewhere on the page. */
  form?: string;
  locale: "fr" | "en" | "ar";
  value?: string;
  defaultValue?: string | null;
  placeholder: string;
  clearLabel: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  fromYear?: number;
  toYear?: number;
}) {
  const [open, setOpen] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState<Date | undefined>(
    () => parseDate(defaultValue),
  );
  const value =
    controlledValue === undefined
      ? uncontrolledValue
      : parseDate(controlledValue);
  const formatted = value
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(value)
    : null;

  function setValue(nextValue: Date | undefined) {
    if (controlledValue === undefined) setUncontrolledValue(nextValue);
    onValueChange?.(serializeDate(nextValue));
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="hidden"
        name={name}
        form={form}
        value={serializeDate(value)}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className={cn(
                "min-h-10 flex-1 justify-start px-3 text-start font-normal",
                !value && "text-muted-foreground",
              )}
              aria-required={required}
              disabled={disabled}
            />
          }
        >
          <CalendarIcon aria-hidden />
          <span className="truncate">{formatted ?? placeholder}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(nextValue) => {
              setValue(nextValue);
              if (nextValue) setOpen(false);
            }}
            locale={calendarLocales[locale]}
            captionLayout="dropdown"
            startMonth={new Date(fromYear, 0)}
            endMonth={new Date(toYear, 11)}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {value && !required ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            setValue(undefined);
          }}
        >
          <X aria-hidden />
          <span className="sr-only">{clearLabel}</span>
        </Button>
      ) : null}
    </div>
  );
}
