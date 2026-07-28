import { LoaderCircle } from "lucide-react";

import { cn } from "~/lib/utils";

/**
 * How one language reads at a glance, in the same badge wherever a language
 * accordion appears: the article and activity editors, the organisation
 * narrative.
 *
 * Which status wins is decided by whoever computes it, and the order is always
 * the same — an unsaved change outranks whatever the database still believes,
 * and staleness outranks a verification that no longer describes the current
 * source.
 */
export type LanguageChipStatus =
  | "source"
  | "empty"
  | "generated"
  | "edited"
  | "stale"
  | "verified"
  | "ai"
  | "review"
  | "rejected"
  | "draft";

const statusTone: Record<LanguageChipStatus, string> = {
  source: "border-brand/40 bg-brand-soft text-brand",
  empty: "border-line text-copy-muted",
  generated: "border-brand/40 bg-brand-soft text-brand",
  edited: "border-warn/40 bg-warn-soft text-warn",
  stale: "border-warn/50 bg-warn-soft text-warn",
  verified: "border-ok/40 bg-ok-soft text-ok",
  ai: "border-brand/30 bg-brand-soft/60 text-brand",
  review: "border-warn/40 bg-warn-soft text-warn",
  rejected: "border-danger/40 bg-danger-soft text-danger",
  draft: "border-line text-copy-muted",
};

/** A glyph carries the state for anyone who cannot separate these hues. */
const statusGlyph: Record<LanguageChipStatus, string> = {
  source: "★",
  empty: "○",
  generated: "◐",
  edited: "●",
  stale: "!",
  verified: "✓",
  ai: "◐",
  review: "◑",
  rejected: "✕",
  draft: "◌",
};

export function LanguageStatusChip({
  status,
  code,
  /** Something is being asked of this language right now. */
  busy = false,
}: {
  status: LanguageChipStatus;
  code: string;
  busy?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        statusTone[status],
      )}
    >
      {busy ? (
        <LoaderCircle className="size-3 animate-spin" aria-hidden />
      ) : (
        <span aria-hidden>{statusGlyph[status]}</span>
      )}
      {/* The ISO code stays legible in every interface language, where 11
       * endonyms would not fit. */}
      <span>{code.toUpperCase()}</span>
    </span>
  );
}
