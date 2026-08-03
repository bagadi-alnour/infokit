import type { PublicActivitySummary } from "@infokit/shared/public-content";

/** An activity the server gave exact coordinates for. */
export interface PlacedActivity extends PublicActivitySummary {
  latitude: number;
  longitude: number;
}

/**
 * The contract both builds of the map keep — the native one and the web
 * stand-in — so the screen above them never learns which it is talking to.
 */
export interface ActivityMapProps {
  activities: PlacedActivity[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** The state word for a pin's callout, from the payload's own labels. */
  statusWord: (activity: PlacedActivity) => string;
  viewLabels: {
    group: string;
    muted: string;
    hybrid: string;
  };
  /** Shown in place of the map where there is no map to show. */
  hint?: string;
}
