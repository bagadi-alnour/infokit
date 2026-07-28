import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `text-eyebrow` is one of our own font sizes (see tailwind-preset.cjs).
 * tailwind-merge reads any `text-*` value it does not recognise as a colour, so
 * left unregistered it treats the size as a colour and drops the colour set
 * beside it — which left every eyebrow with no colour at all, and so black on
 * the dark canvas. Sizes added here must match the preset's `fontSize` keys.
 */
const merge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["eyebrow"] }] } },
});

/** Merge class lists so a caller's utility always wins over a variant's. */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
