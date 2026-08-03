"use client";

import {
  PublicEventList,
  type PublicEventCard,
  type PublicEventListLabels,
} from "~/components/public/public-event-list";

export interface EventPreviewFrameLabels {
  /** Names the panel: what this is a preview of. */
  title: string;
  /** Who will actually be shown this card, given the reach chosen on the form. */
  reach: string;
}

/**
 * The event as a reader will meet it, beside the form that is writing it.
 *
 * It renders the real public card — the same component the agenda serves — so
 * this is a preview rather than an impression of one: a change to how events
 * are shown reaches this panel without anybody remembering to update it. An
 * editor deciding whether a title says enough should not have to save first
 * and go looking.
 *
 * The whole card is inert. Every link in it points at an event that does not
 * exist yet (or at a page the editor is not going to), and a preview that can
 * be tabbed into is a trap between two halves of a form.
 */
export function EventPublicPreview({
  card,
  labels,
  frame,
}: {
  card: PublicEventCard;
  labels: PublicEventListLabels;
  frame: EventPreviewFrameLabels;
}) {
  return (
    <aside className="grid gap-2 lg:sticky lg:top-6">
      <div>
        <h2 className="text-sm font-semibold">{frame.title}</h2>
        <p className="text-copy-muted mt-0.5 text-xs leading-relaxed">
          {frame.reach}
        </p>
      </div>
      {/* `inert` rather than `pointer-events-none`: the links must leave the tab
       * order and the accessibility tree too, not merely stop responding. */}
      <div inert className="min-w-0">
        <PublicEventList events={[card]} labels={labels} />
      </div>
    </aside>
  );
}
