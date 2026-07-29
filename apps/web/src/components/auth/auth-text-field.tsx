"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";

import { ActionButton } from "~/components/public/primitives";
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
  visibilityLabels,
  className,
  type,
  ...inputProps
}: ComponentProps<"input"> & {
  id: string;
  label: string;
  description?: string;
  labelAction?: ReactNode;
  visibilityLabels?: {
    show: string;
    hide: string;
  };
}) {
  const [visible, setVisible] = useState(false);
  const descriptionId = description ? `${id}-description` : undefined;
  const canReveal = type === "password" && visibilityLabels !== undefined;
  const inputType = canReveal && visible ? "text" : type;
  const visibilityLabel = visible
    ? visibilityLabels?.hide
    : visibilityLabels?.show;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-ink text-[0.95rem] font-semibold">
          {label}
        </label>
        {labelAction}
      </div>
      <div className={cn(canReveal && "relative")}>
        <input
          id={id}
          type={inputType}
          aria-describedby={descriptionId}
          className={cn(
            "border-line-strong bg-surface text-ink placeholder:text-copy-muted rounded-control focus-visible:outline-brand aria-[invalid=true]:border-danger min-h-12 w-full border px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2",
            canReveal && "pe-12",
            className,
          )}
          {...inputProps}
        />
        {canReveal ? (
          <ActionButton
            type="button"
            tone="quiet"
            size="compact"
            className="absolute inset-y-0 end-0 min-h-12 w-12 px-0"
            aria-label={visibilityLabel}
            aria-pressed={visible}
            title={visibilityLabel}
            onClick={() => {
              setVisible((current) => !current);
            }}
          >
            {visible ? (
              <EyeOff className="size-5" aria-hidden />
            ) : (
              <Eye className="size-5" aria-hidden />
            )}
          </ActionButton>
        ) : null}
      </div>
      {description ? (
        <p id={descriptionId} className="text-copy-muted text-sm leading-snug">
          {description}
        </p>
      ) : null}
    </div>
  );
}
