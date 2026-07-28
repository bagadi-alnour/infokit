/**
 * How far an agenda event reaches. The console picks it, the public site only
 * ever sees the last one — one vocabulary, so a label or a colour can never
 * drift between the two surfaces.
 */
/** The tiers, in the order they widen — also what both validators accept. */
export const EVENT_VISIBILITIES = [
  "organization",
  "inter_organization",
  "public",
] as const;

export type EventVisibilityValue = (typeof EVENT_VISIBILITIES)[number];

/** Chip colours, in the order the tiers widen. */
export const eventReachChipClass: Record<EventVisibilityValue, string> = {
  organization: "border-line bg-subtle text-ink",
  inter_organization: "border-brand/30 bg-brand-soft text-brand",
  public: "border-ok/30 bg-ok-soft text-ok",
};
