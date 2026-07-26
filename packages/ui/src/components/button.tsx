import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { Pressable } from "react-native";

import { cn } from "../lib/cn";
import { TextClassContext } from "./text";

const buttonVariants = cva(
  // 48px minimum, always — this is a public surface (docs/DESIGN-SYSTEM.md §4).
  "min-h-touch rounded-control flex-row items-center justify-center gap-2 px-5",
  {
    variants: {
      tone: {
        solid: "bg-brand active:bg-brand-hover",
        outline: "border-line-strong bg-surface border active:bg-subtle",
        quiet: "active:bg-subtle bg-transparent",
      },
      block: { true: "w-full", false: "self-start" },
    },
    defaultVariants: { tone: "solid", block: true },
  },
);

const labelVariants = cva("text-base font-semibold", {
  variants: {
    tone: {
      solid: "text-brand-ink",
      outline: "text-ink",
      quiet: "text-brand-deep",
    },
  },
  defaultVariants: { tone: "solid" },
});

export type ButtonProps = ComponentProps<typeof Pressable> &
  VariantProps<typeof buttonVariants>;

/**
 * The label colour is published through `TextClassContext`, so `<Text>`
 * children inherit it and callers never pick a colour themselves.
 */
export function Button({ className, tone, block, ...props }: ButtonProps) {
  return (
    <TextClassContext.Provider value={labelVariants({ tone })}>
      <Pressable
        accessibilityRole="button"
        className={cn(
          buttonVariants({ tone, block }),
          props.disabled ? "opacity-50" : null,
          className,
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}
