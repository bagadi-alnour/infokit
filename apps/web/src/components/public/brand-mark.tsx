import {
  brandName,
  localeMetadata,
  type PublicLocale,
} from "@infokit/shared/i18n";

import { cn } from "~/lib/utils";

/**
 * The information mark: an "i" enclosed in a disc — the sign people already
 * look for when they need to know something, which is the whole promise here.
 * It stands in for the logo where there is no room to write the name — a
 * collapsed sidebar, an app icon — and the wordmark carries the name on its own
 * everywhere else. Drawn in tokens so it follows the theme, and hidden from
 * assistive tech: wherever it appears, the name is carried as text beside it or
 * by the link around it (docs/DESIGN-SYSTEM.md §5).
 *
 * `size` takes any CSS length: a number for a fixed pixel mark, or an `em`
 * value to let it scale with the type around it.
 */
export function BrandMark({
  size = 32,
  className,
}: {
  size?: number | string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn("shrink-0", className)}
      aria-hidden
      focusable="false"
    >
      <circle cx="16" cy="16" r="16" fill="var(--infokit-accent)" />
      {/* Tittle and stem are drawn rather than typeset, so the mark holds the
       * same proportions at 17px in a wordmark as it does at 32px alone. The
       * "i" sits a hair above centre because the gap under the tittle reads
       * lighter than solid stem. */}
      <circle cx="16" cy="9.4" r="2.35" fill="var(--infokit-accent-contrast)" />
      <rect
        x="13.8"
        y="13.6"
        width="4.4"
        height="10"
        rx="2.2"
        fill="var(--infokit-accent-contrast)"
      />
    </svg>
  );
}

/**
 * The logo: the name, set in the display face as real text. It inherits the
 * type around it, stays crisp at any zoom, and is selectable, searchable and
 * translatable-proof like any other word — nothing here is a picture, so
 * assistive tech reads it as the word it is.
 *
 * Size it with a font-size class through `className`.
 */
export function BrandWordmark({
  locale,
  className,
}: {
  locale: PublicLocale;
  className?: string;
}) {
  return (
    <span
      dir={localeMetadata[locale].direction}
      className={cn(
        "font-display inline-block whitespace-nowrap font-bold tracking-tight",
        className,
      )}
    >
      {brandName(locale)}
    </span>
  );
}
