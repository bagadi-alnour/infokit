import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
} from "~/components/reui/timeline";
import { ScrollArea } from "~/components/ui/scroll-area";

/** One thing that happened to a record, already resolved to words and a name. */
export interface HistoryEntry {
  key: string;
  label: string;
  at: Date;
  /** Who did it, or null for something the platform did on its own. */
  by: string | null;
}

/**
 * The times in this trail are wall-clock times in the city the record is about,
 * not the reader's. An editor asking "was that before or after the number
 * changed?" is comparing against a working day in Calais, and two entries a
 * minute apart must not sort differently because somebody opened the console
 * from another timezone. Seconds are shown because revisions land close
 * together and "which of these two was last" is the whole question.
 */
function historyDateTime(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Paris",
  }).format(value);
}

/**
 * What happened to a record, newest first.
 *
 * One component for every workspace that keeps a revision trail, because the
 * trail means the same thing on each of them: the same shape of entry, the same
 * ordering, the same words for "by whom". It had been copied between the article
 * and basic-information pages down to the pixel offsets of the dots, which is
 * two places to fix anything and two places for them to drift apart.
 *
 * Callers pass entries already sorted and already localised — the queries that
 * build them differ per record type, and this only decides how they read.
 */
export function HistoryTimeline({
  entries,
  locale,
  labels,
}: {
  entries: readonly HistoryEntry[];
  locale: string;
  labels: {
    /** Names the scroll region for anyone not looking at it. */
    ariaLabel: string;
    empty: string;
    /** Carries a `{name}` placeholder. */
    by: string;
  };
}) {
  if (entries.length === 0) {
    return <p className="text-copy-muted text-sm">{labels.empty}</p>;
  }

  return (
    <ScrollArea className="h-56 pe-3" aria-label={labels.ariaLabel}>
      {/* `defaultValue={0}` leaves every step short of "completed": these are
       * things that already happened, not a progress tracker, so nothing here
       * is ahead of anything else. The dot and the rule take the workspace's
       * own tokens rather than the registry's `primary`. */}
      <Timeline defaultValue={0} className="gap-2.5">
        {entries.map((entry, index) => (
          <TimelineItem
            key={entry.key}
            step={index + 1}
            className="group-data-[orientation=vertical]/timeline:not-last:pb-3"
          >
            <TimelineHeader className="flex items-center gap-2.5">
              <TimelineSeparator className="bg-line" />
              <TimelineIndicator className="bg-brand size-2 border-none" />
              <TimelineDate
                dateTime={entry.at.toISOString()}
                className="text-copy-muted mb-0 text-[10px] font-semibold uppercase tabular-nums"
              >
                {historyDateTime(entry.at, locale)}
              </TimelineDate>
            </TimelineHeader>
            <TimelineContent className="text-copy text-sm font-medium">
              {entry.label}
              {entry.by ? (
                <span className="text-copy-muted block text-xs font-normal">
                  {labels.by.replace("{name}", entry.by)}
                </span>
              ) : null}
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </ScrollArea>
  );
}
