"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import {
  LanguageStatusChip,
  type LanguageChipStatus,
} from "~/components/admin/language-status-chip";
import { cn } from "~/lib/utils";

/**
 * One language per row, opened to be worked on.
 *
 * Every screen that authors the same text in several languages shows the same
 * list — an article, an activity, an event, a basic-information tile — and they
 * were each drawing their own: one as tabs, one as a flush stack of rules. A
 * reader who learns the shape on one screen should not have to learn it again on
 * the next, so the shape lives here and each screen supplies only what it knows:
 * the status of a language, the notes beside it, and what opens underneath.
 *
 * It is composed like any accordion — `LanguageAccordion` around one
 * `LanguageAccordionItem` per language — rather than configured through a list
 * of row objects, because what goes inside a row differs completely from screen
 * to screen and a prop for each would be a second component in disguise.
 */
export function LanguageAccordion({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
}: {
  /** Controlled: which languages are open. */
  value?: string[];
  /** Uncontrolled: which start open. */
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Accordion
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => {
        onValueChange?.(next as string[]);
      }}
      /* Each language is its own card rather than a rule between two rows: a
       * row carries a chip, a name, a status and up to two workflow notes, and
       * eleven of those stacked flush read as one block of text with no way
       * in. */
      className={cn("gap-2", className)}
    >
      {children}
    </Accordion>
  );
}

export function LanguageAccordionItem({
  code,
  name,
  status,
  statusLabel,
  busy = false,
  notes,
  note,
  actions,
  keepMounted = false,
  className,
  children,
}: {
  /** The language code; also the accordion value that opens this row. */
  code: string;
  /** The language's name in the interface language. */
  name: string;
  status: LanguageChipStatus;
  /** What the status means, in words, beside the chip. */
  statusLabel?: string;
  /** Something is being asked of this language right now. */
  busy?: boolean;
  /** Short markers on the row itself: live, scheduled, with a reviewer. */
  notes?: React.ReactNode;
  /** A sentence at the top of the open panel — who verified it, and when. */
  note?: React.ReactNode;
  /** This language's own controls, top-right of its open panel. */
  actions?: React.ReactNode;
  /**
   * Keep the closed panel's fields in the document. For a screen whose post is
   * built from the DOM — the event editor reads `new FormData(form)` — a
   * collapsed language must still travel, or closing a row would delete the
   * translation inside it.
   */
  keepMounted?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem
      value={code}
      className={cn("border-line bg-surface rounded-xl border px-3", className)}
    >
      {/* `hover:no-underline` is here to displace the shared trigger's
       * `hover:underline` in the class merge: a row is a chip, a name, a status
       * and up to two notes, and underlining all of them at once — the chip's
       * letters included — reads as damage rather than as a link. The whole card
       * is the hit area, which is affordance enough. */}
      <AccordionTrigger className="gap-x-2 gap-y-1 py-3 hover:no-underline">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <LanguageStatusChip status={status} code={code} busy={busy} />
          <span className="min-w-0 truncate">{name}</span>
          {statusLabel ? (
            <span className="text-copy-muted truncate text-xs font-normal">
              {statusLabel}
            </span>
          ) : null}
          {notes}
        </span>
      </AccordionTrigger>
      {/* `h-auto` overrides the panel's measured height: base-ui measures once,
       * at open, and an editor grows as it is typed into — the fixed height
       * would cut the text off. */}
      <AccordionContent className="h-auto pb-3" keepMounted={keepMounted}>
        <div className="grid gap-3">
          {note || actions ? (
            <div className="flex items-start justify-between gap-2">
              <p className="text-copy-muted min-w-0 text-xs">{note}</p>
              {actions}
            </div>
          ) : null}
          {children}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
