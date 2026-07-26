import type { ComponentProps, ReactNode } from "react";

import { cn } from "~/lib/utils";

/**
 * Sign-in text field: visible label, optional action beside it (for example
 * "forgot password"), optional description below. 48px target and a 2px focus
 * ring, like every other public control (docs/DESIGN-SYSTEM.md §5).
 */
export function AuthTextField({
  id,
  label,
  description,
  labelAction,
  className,
  ...inputProps
}: ComponentProps<"input"> & {
  id: string;
  label: string;
  description?: string;
  labelAction?: ReactNode;
}) {
  const descriptionId = description ? `${id}-description` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-ink text-[0.95rem] font-semibold">
          {label}
        </label>
        {labelAction}
      </div>
      <input
        id={id}
        aria-describedby={descriptionId}
        className={cn(
          "border-line-strong bg-surface text-ink placeholder:text-copy-muted rounded-control focus-visible:outline-brand aria-[invalid=true]:border-danger min-h-12 w-full border px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2",
          className,
        )}
        {...inputProps}
      />
      {description ? (
        <p id={descriptionId} className="text-copy-muted text-sm leading-snug">
          {description}
        </p>
      ) : null}
    </div>
  );
}
