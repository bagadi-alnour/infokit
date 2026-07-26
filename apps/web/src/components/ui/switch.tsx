"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "~/lib/utils";

/**
 * On/off for a setting that applies immediately on save. Base UI renders a
 * hidden input beside it, so a switch inside a plain server-action form posts
 * like a checkbox: "on" when checked, nothing at all when not.
 */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "border-input bg-input/60 data-checked:bg-primary data-checked:border-primary focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/40 focus-visible:ring-3 peer relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="bg-background data-checked:bg-primary-foreground ltr:data-checked:translate-x-[1.125rem] rtl:data-checked:-translate-x-[1.125rem] pointer-events-none block size-4 rounded-full shadow-sm ring-0 transition-transform ltr:translate-x-0.5 rtl:-translate-x-0.5"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
