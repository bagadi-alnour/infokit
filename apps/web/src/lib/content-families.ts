/**
 * The four kinds of content the platform carries (docs/DESIGN-SYSTEM.md §5).
 * Activities are the subject of the platform and keep the accent; the agenda is
 * indigo, articles plum, guides copper — the same four hues the mobile app uses,
 * so a reader who came in through one of them recognises the other.
 *
 * This map lives outside both component sets because both of them draw the same
 * four families: the public pages a reader browses, and the console an editor
 * writes them in. One table, so a section cannot be plum on one surface and
 * neutral on the other.
 */
export type ContentFamily = "activity" | "event" | "article" | "guide";

/**
 * Where a family hue is allowed to appear. Exactly one element per surface
 * carries it: the eyebrow of a section opening, and the one element named per
 * family on a card. A hue is never the only thing saying what something is.
 */
export const familyStyles: Record<
  ContentFamily,
  {
    /** Label and affordance text. */
    text: string;
    /** The eyebrow's dot, and the rule under a section opening. */
    dot: string;
    /** Fill behind family text — a block, a bubble, a whole card. */
    wash: string;
    border: string;
    /** Ring on hover and while a child holds focus. */
    hoverBorder: string;
    /**
     * The same ring for focus only. A keyboard reader has no hover, so the ring
     * is the only thing telling them which card they are on: a card that drops
     * the pointer affordance keeps this one.
     */
    focusBorder: string;
  }
> = {
  activity: {
    text: "text-brand-deep",
    dot: "bg-brand",
    wash: "bg-brand-soft",
    border: "border-brand",
    hoverBorder: "hover:border-brand focus-within:border-brand",
    focusBorder: "focus-within:border-brand",
  },
  event: {
    text: "text-event",
    dot: "bg-event",
    wash: "bg-event-wash",
    border: "border-event",
    hoverBorder: "hover:border-event focus-within:border-event",
    focusBorder: "focus-within:border-event",
  },
  article: {
    text: "text-article",
    dot: "bg-article",
    wash: "bg-article-wash",
    border: "border-article",
    hoverBorder: "hover:border-article focus-within:border-article",
    focusBorder: "focus-within:border-article",
  },
  guide: {
    text: "text-guide",
    dot: "bg-guide",
    wash: "bg-guide-wash",
    border: "border-guide",
    hoverBorder: "hover:border-guide focus-within:border-guide",
    focusBorder: "focus-within:border-guide",
  },
};
