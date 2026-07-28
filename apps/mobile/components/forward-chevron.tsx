import { useInfoKitTheme } from "@infokit/ui";
import Feather from "@expo/vector-icons/Feather";

/**
 * "Onward" — pointing the way the reader reads.
 *
 * The one shape that has to be mirrored by hand. The layout direction flips the
 * row this sits in, but a glyph is drawn, not laid out: left unattended a
 * chevron points out of the screen in Arabic, back the way the reader came
 * (docs/DESIGN-SYSTEM.md §2 rule 8).
 */
export function ForwardChevron({
  size = 20,
  tone = "muted",
}: {
  size?: number;
  /** `brand` for a choice that carries the reader forward, `muted` for a row. */
  tone?: "muted" | "brand";
}) {
  const { tokens, direction } = useInfoKitTheme();

  return (
    <Feather
      name={direction === "rtl" ? "chevron-left" : "chevron-right"}
      size={size}
      color={tone === "brand" ? tokens.accentDeep : tokens.textMuted}
    />
  );
}
