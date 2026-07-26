import type { StatusRole } from "@infokit/tokens";
import { View } from "react-native";

import { cn } from "../lib/cn";
import { Text } from "./text";

/**
 * The four status roles of docs/DESIGN-SYSTEM.md §6, expressed as utilities.
 * The pairing mirrors `statusRoleTokens` in @infokit/tokens; it is written out
 * rather than computed because Tailwind only sees class names it can read.
 */
const pillClasses: Record<StatusRole, { box: string; label: string }> = {
  open: { box: "bg-ok-soft border-ok", label: "text-ok" },
  closed: { box: "bg-neutral-soft border-neutral", label: "text-neutral" },
  cancelled: { box: "bg-danger-soft border-danger", label: "text-danger" },
  uncertain: { box: "bg-warn-soft border-warn", label: "text-warn" },
};

/**
 * Colour is never the only signal (docs/DESIGN-SYSTEM.md §1): the caller passes
 * the word, and this glyph — a shape, not a hue — repeats the state for anyone
 * who cannot separate the colours.
 */
const glyphs: Record<StatusRole, string> = {
  open: "●",
  closed: "■",
  cancelled: "✕",
  uncertain: "▲",
};

export function StatusPill({
  role,
  label,
  detail,
  className,
}: {
  role: StatusRole;
  label: string;
  detail?: string;
  className?: string;
}) {
  const style = pillClasses[role];

  return (
    <View
      className={cn(
        "rounded-chip flex-row items-center gap-1.5 border px-2.5 py-1.5",
        style.box,
        className,
      )}
      accessibilityLabel={detail ? `${label} — ${detail}` : label}
    >
      <Text className={cn("text-xs", style.label)}>{glyphs[role]}</Text>
      <Text className={cn("text-sm font-semibold", style.label)}>{label}</Text>
      {detail ? (
        <Text variant="muted" className="text-sm">
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/** Neutral chip: the word identifies the service, not a per-category hue. */
export function Chip({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <View
      className={cn(
        "bg-subtle border-line rounded-chip border px-2.5 py-1.5",
        className,
      )}
    >
      <Text className="text-sm font-semibold">{label}</Text>
    </View>
  );
}
