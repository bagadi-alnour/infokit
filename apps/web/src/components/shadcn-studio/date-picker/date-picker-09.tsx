"use client";

import { Clock8Icon } from "lucide-react";
import type { ComponentProps } from "react";

import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

type TimePickerProps = Omit<ComponentProps<typeof Input>, "type">;

/**
 * Shadcn Studio Date Picker 09, adapted as a controlled Calais time field.
 * Labels remain outside the control so Field can own errors and descriptions.
 */
export function TimePicker({
  className,
  step = 60,
  ...props
}: TimePickerProps) {
  return (
    <div className="relative">
      <span className="text-muted-foreground pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
        <Clock8Icon className="size-4" aria-hidden />
      </span>
      <Input
        {...props}
        type="time"
        step={step}
        className={cn(
          "bg-background peer appearance-none ps-9 tabular-nums [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
          className,
        )}
      />
    </div>
  );
}

export default TimePicker;
