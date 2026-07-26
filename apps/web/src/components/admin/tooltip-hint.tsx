"use client";

import type { ReactElement } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

/**
 * The name of an icon-only control, shown on hover and on keyboard focus.
 *
 * Console rows are dense — a pencil, a bin, a cross — and the browser's own
 * `title` tooltip is unstyled, slow, invisible to keyboard users, and never in
 * the reading direction of an Arabic screen. This puts the same word in the
 * workspace's own tooltip instead. The control keeps its `aria-label`: this is
 * for people who can see the glyph but not guess it.
 *
 * `child` must be a single element that accepts DOM props — every base-ui
 * trigger does, so a Popover, DropdownMenu, or AlertDialog trigger can be
 * passed straight in.
 */
export function TooltipHint({
  label,
  side = "top",
  children,
}: {
  label: string;
  /** Logical sides (`inline-start`/`inline-end`) follow the writing direction. */
  side?: "top" | "bottom" | "inline-start" | "inline-end";
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
