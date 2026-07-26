/**
 * How far an agenda event reaches. The console picks it, the public site only
 * ever sees the last one — one vocabulary, so a label or a colour can never
 * drift between the two surfaces.
 */
export type EventVisibilityValue =
  "organization" | "inter_organization" | "public";

export const EVENT_VISIBILITIES: readonly EventVisibilityValue[] = [
  "organization",
  "inter_organization",
  "public",
];

/** Chip colours, in the order the tiers widen. */
export const eventReachChipClass: Record<EventVisibilityValue, string> = {
  organization: "border-line bg-subtle text-ink",
  inter_organization: "border-brand/30 bg-brand-soft text-brand",
  public: "border-ok/30 bg-ok-soft text-ok",
};
