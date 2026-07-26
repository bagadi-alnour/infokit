"use client";

import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

export interface ChoiceOption {
  value: string;
  label: string;
  /** Set when the option is written in its own language (language pickers). */
  lang?: string;
}

/**
 * The public site's dropdown: the same shadcn `Select` the console uses
 * (~/components/ui/select), with reading-room sizing — 48px rows and a slightly
 * larger type size for one-handed use on a phone.
 *
 * A native `<select>` would be the sturdier control, but browsers draw its menu
 * as an OS popup *over* the field, in the OS palette rather than ours. This one
 * always opens directly under the field it belongs to and answers to the
 * keyboard (docs/DESIGN-SYSTEM.md §5).
 */
export function ChoiceSelect({
  id,
  label,
  labelledBy,
  value,
  onValueChange,
  options,
  icon,
  className,
  triggerClassName,
}: {
  id?: string;
  /** Accessible name; omit when `labelledBy` points at a visible label. */
  label?: string;
  labelledBy?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly ChoiceOption[];
  icon?: ReactNode;
  className?: string;
  triggerClassName?: string;
}) {
  return (
    <Select
      items={options as { value: string; label: string }[]}
      value={value}
      onValueChange={(next) => {
        // The library allows a null value (nothing chosen); our lists always
        // carry an explicit "all"/default option, so an empty string is the
        // right fallback rather than an unset filter.
        onValueChange(typeof next === "string" ? next : "");
      }}
      // The public pages scroll long lists behind the control; locking the page
      // for a four-item menu would be heavier than the choice it guards.
      modal={false}
    >
      <SelectTrigger
        id={id}
        aria-label={label}
        aria-labelledby={labelledBy}
        className={cn(
          "min-h-12 w-full cursor-pointer px-3 text-[0.95rem] font-medium",
          className,
          triggerClassName,
        )}
      >
        {icon ? (
          <span
            className="text-copy-muted flex shrink-0 items-center"
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
        <SelectValue className="min-w-0 flex-1 truncate" />
      </SelectTrigger>
      <SelectContent align="start" className="p-1.5">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="min-h-12 cursor-pointer px-3 text-[0.95rem] font-medium"
          >
            <span className="min-w-0 flex-1" lang={option.lang}>
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
