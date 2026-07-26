import { cn } from "~/lib/utils";

/**
 * A verified place: a pin with a check inside. Drawn in tokens so it follows
 * the theme, and hidden from assistive tech — the wordmark next to it carries
 * the name (docs/DESIGN-SYSTEM.md §5).
 */
export function BrandMark({
  size = 32,
  className,
}: {
  size?: number;
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
      <rect width="32" height="32" rx="10" fill="var(--infokit-accent)" />
      <path
        d="M16 6.5c-3.7 0-6.8 3-6.8 6.7 0 4.8 5.5 10.4 6.4 11.3.2.2.6.2.8 0 .9-.9 6.4-6.5 6.4-11.3 0-3.7-3.1-6.7-6.8-6.7Z"
        fill="var(--infokit-accent-contrast)"
      />
      <path
        d="m12.7 13.3 2.3 2.3 4.3-4.3"
        fill="none"
        stroke="var(--infokit-accent)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
