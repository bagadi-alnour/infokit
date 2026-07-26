"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

export type SelectControlOption = { value: string; label: string };

/**
 * The workspace dropdown: one shadcn/base-ui Select for every console filter,
 * so the menu is drawn in our own palette and anchored under the trigger
 * instead of over it the way a native `<select>` popup is.
 *
 * This one is for interactive filters; server-rendered forms use its sibling
 * `SelectField` (~/components/ui/select-field), which carries the value in a
 * hidden input so a plain form submit still works.
 */
export function SelectControl({
  id,
  label,
  value,
  onValueChange,
  options,
  className,
  contentClassName,
}: {
  id?: string;
  /** Accessible name — required when no visible label points at the trigger. */
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectControlOption[];
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Select
      items={options as SelectControlOption[]}
      value={value}
      onValueChange={(next) => {
        onValueChange(typeof next === "string" ? next : "");
      }}
    >
      <SelectTrigger
        id={id}
        aria-label={label}
        className={cn("min-h-9 w-full", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" className={contentClassName}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
