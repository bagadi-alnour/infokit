import type { PublicTransitLink } from "@infokit/shared/public-content";
import {
  Bike,
  Bus,
  BusFront,
  Route,
  Ship,
  TrainFront,
  TrainFrontTunnel,
  TramFront,
  type LucideIcon,
} from "lucide-react";

import { SurfaceCard } from "~/components/public/primitives";
import { cn } from "~/lib/utils";

/**
 * A glyph per mode, so a reader who cannot read the word still sees which of
 * these is a train and which is a bus. The key is the stored one, never the
 * translated label: a catalogue in Pashto must not change which icon is drawn.
 *
 * `other` gets a plain route line — the mode nobody named is still a way in, and
 * a question mark would read as doubt about the journey itself.
 */
const modeIcons: Record<PublicTransitLink["mode"], LucideIcon> = {
  bus: Bus,
  tram: TramFront,
  metro: TrainFrontTunnel,
  train: TrainFront,
  coach: BusFront,
  ferry: Ship,
  bike: Bike,
  other: Route,
};

/**
 * The ways in, one per line.
 *
 * The mode and its line lead in the strong weight because that is what a reader
 * matches against the front of a bus; the stop follows, in the network's own
 * spelling, so it can be read out to a driver; the walk is last and quiet — it
 * decides nothing, it only sets an expectation.
 *
 * Nothing here is computed: the words arrive already translated and the minutes
 * already in the reader's digits (`presentTransitLinks`), so this draws them.
 */
export function TransitLinkList({
  links,
  className,
}: {
  links: readonly PublicTransitLink[];
  className?: string;
}) {
  if (links.length === 0) return null;
  return (
    <ul className={cn("m-0 flex list-none flex-col gap-2 p-0", className)}>
      {links.map((link, index) => {
        const Icon = modeIcons[link.mode];
        return (
          <li
            // Two identical rows are the same journey written twice, and the
            // editor may keep them; the position is what tells them apart.
            key={`${String(index)}-${link.mode}-${link.line ?? ""}-${link.stopName ?? ""}`}
            className="flex items-start gap-2"
          >
            {/* The glyph is the accent, the words are not (§2 rule 4). */}
            <Icon className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="text-ink min-w-0 text-[0.95rem] leading-snug">
              <span className="font-semibold">
                {link.modeLabel}
                {link.line === null ? null : ` ${link.line}`}
              </span>
              {link.stopName === null ? null : <> · {link.stopName}</>}
              {link.walkLabel === null ? null : (
                <span className="text-copy-muted"> · {link.walkLabel}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The same list in a card of its own, for the surfaces that stack cards down a
 * column rather than rows inside one.
 *
 * It sits under the map on the activity page and not inside it: the map card
 * draws nothing at all when a place is approved for an area only, and a bus line
 * is publishable when an address is not — that is exactly the reader who needs
 * this most.
 */
export function TransitLinkCard({
  links,
  heading,
}: {
  links: readonly PublicTransitLink[];
  heading: string;
}) {
  if (links.length === 0) return null;
  return (
    <SurfaceCard as="section" className="flex flex-col gap-2 p-5">
      <h2 className="text-copy-muted text-xs font-bold uppercase tracking-[0.08em]">
        {heading}
      </h2>
      <TransitLinkList links={links} />
    </SurfaceCard>
  );
}
