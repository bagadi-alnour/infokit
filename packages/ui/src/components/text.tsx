import { Slot } from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import { createContext, useContext, type ComponentProps } from "react";
import { Text as RNText } from "react-native";

import { cn } from "../lib/cn";
import { useInfoKitTheme } from "../theme";

/**
 * Lets a container set the text style for everything inside it — a button sets
 * its label colour once instead of every caller repeating it. Same contract as
 * React Native Reusables' `TextClassContext`.
 */
export const TextClassContext = createContext<string | undefined>(undefined);

const textVariants = cva("text-ink font-body", {
  variants: {
    variant: {
      /** Body copy. Never below 16px (docs/DESIGN-SYSTEM.md §1). */
      body: "text-base leading-6",
      /** Screen title. */
      title: "font-display text-2xl font-bold leading-8",
      /** Section heading. */
      heading: "font-display text-lg font-bold leading-7",
      /** Labels and metadata — secondary, never body text. */
      muted: "text-copy-muted text-sm leading-5",
      /** Small caps kicker above a title. */
      eyebrow: "text-copy-muted text-eyebrow font-semibold uppercase",
    },
  },
  defaultVariants: { variant: "body" },
});

export type TextProps = ComponentProps<typeof RNText> &
  VariantProps<typeof textVariants> & { asChild?: boolean };

export function Text({ className, variant, asChild, ...props }: TextProps) {
  const contextClass = useContext(TextClassContext);
  const { direction } = useInfoKitTheme();
  // `asChild` hands our styling to the caller's own element (a router link,
  // say) instead of wrapping it in a second text node.
  const Component = asChild ? Slot<typeof RNText> : RNText;
  return (
    <Component
      // Every line starts at the same edge, whatever script it is in: an
      // activity called "Secours Catholique" read in Arabic belongs against the
      // right margin with the labels around it, not alone on the left. Left
      // unset, alignment follows each string's own characters, and a card of
      // French names under Arabic labels comes out ragged on both sides. First
      // in the list, so a caller's `text-center` still wins.
      className={cn(
        direction === "rtl" ? "text-right" : "text-left",
        textVariants({ variant }),
        contextClass,
        className,
      )}
      {...props}
    />
  );
}
