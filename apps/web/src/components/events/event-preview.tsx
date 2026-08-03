"use client";

import { CalendarDays, CalendarPlus, Clock, MapPin } from "lucide-react";

import { ContactValue, contactIcon } from "~/components/public/contact-value";
import {
  ActionAnchor,
  Callout,
  Chip,
  MetaRow,
  OnlineChip,
  inlineLinkClass,
} from "~/components/public/primitives";

/**
 * One event, formatted by the server, with the three things a reader may act
 * on: the map link for where, the organisation behind it, and the calendar file
 * for when. Every string is already in the reader's language and the city's
 * clock — this component decides nothing about either.
 */
export interface EventDetailView {
  id: string;
  /** The event's own page: the public one, or its editor in the console. */
  href: string;
  title: string;
  description: string | null;
  dateLabel: string;
  timeLabel: string;
  whereLabel: string | null;
  /** Absent when the place must not be pinned (RISKS.md R5). */
  mapHref: string | null;
  /** Empty for an event that happens online and in no city. */
  cityName: string;
  /** Joinable from anywhere — shown instead of a place, or beside one. */
  isOnline: boolean;
  /** The link people join on, when the organisers have published one. */
  onlineUrl: string | null;
  hostName: string | null;
  /** The host's public page, when it has one. */
  hostHref: string | null;
  contactLabel: string | null;
  contactValue: string | null;
  cancelled: boolean;
  cancellationReason: string | null;
  icsHref: string;
  /** Who may read it — shown in the console, where reach is a distinction. */
  reachLabel: string | null;
}

export interface EventPreviewLabels {
  where: string;
  city: string;
  /** What an online event says instead of a street. */
  online: string;
  host: string;
  platform: string;
  contact: string;
  reach: string;
  cancelled: string;
  cancelledNoReason: string;
  addToCalendar: string;
  openMap: string;
  notAvailable: string;
}

/** Long descriptions belong on the page; a preview shows enough to decide. */
const DESCRIPTION_LIMIT = 220;

function shorten(text: string) {
  if (text.length <= DESCRIPTION_LIMIT) return text;
  const cut = text.slice(0, DESCRIPTION_LIMIT);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 120 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * The details of one event, shown beside whatever links to it. A calendar
 * answers "what is happening that day"; the next question is always "and can I
 * go" — the hour, the place, who to ask — and that answer should not cost a page
 * load to read.
 */
export function EventPreviewCard({
  event,
  labels,
}: {
  event: EventDetailView;
  labels: EventPreviewLabels;
}) {
  /** Empty on an event that is only online: there is no place to name. */
  const where = event.whereLabel ?? event.cityName;
  return (
    <div className="grid gap-3">
      <p className="text-ink text-base font-bold leading-snug tracking-tight">
        {event.title}
      </p>

      <div className="flex flex-wrap gap-1.5">
        <Chip icon={<CalendarDays className="size-4" aria-hidden />}>
          {event.dateLabel}
        </Chip>
        <Chip icon={<Clock className="size-4" aria-hidden />}>
          {event.timeLabel}
        </Chip>
        {/* Joinable from anywhere: said before the place, because for an event
         * that is only online there is no place to say at all. */}
        {event.isOnline ? (
          <OnlineChip label={labels.online} url={event.onlineUrl} />
        ) : null}
        {/* The map opens in its own tab: the reader is mid-decision here, and
         * losing the agenda to check a street is a bad trade. */}
        {where === "" ? null : event.mapHref ? (
          <a
            href={event.mapHref}
            target="_blank"
            rel="noreferrer"
            aria-label={`${labels.openMap} — ${where}`}
            className="rounded-chip focus-visible:outline-brand focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Chip
              icon={<MapPin className="size-4" aria-hidden />}
              className="hover:border-brand hover:text-brand-deep underline decoration-1 underline-offset-2"
            >
              {where}
            </Chip>
          </a>
        ) : (
          <Chip icon={<MapPin className="size-4" aria-hidden />}>{where}</Chip>
        )}
      </div>

      {event.cancelled ? (
        <Callout tone="warning" title={labels.cancelled}>
          {event.cancellationReason ?? labels.cancelledNoReason}
        </Callout>
      ) : null}

      {event.description ? (
        <p className="text-copy-muted text-sm leading-relaxed">
          {shorten(event.description)}
        </p>
      ) : null}

      <dl className="grid gap-1.5">
        <MetaRow label={labels.host}>
          {event.hostName === null ? (
            labels.platform
          ) : event.hostHref ? (
            <a href={event.hostHref} className={inlineLinkClass}>
              {event.hostName}
            </a>
          ) : (
            event.hostName
          )}
        </MetaRow>
        {/* An online event names no city, and "not available" would read as a
         * missing answer rather than as the answer. */}
        {event.cityName || !event.isOnline ? (
          <MetaRow label={labels.city}>
            {event.cityName || labels.notAvailable}
          </MetaRow>
        ) : null}
        {event.contactValue ? (
          <MetaRow
            label={labels.contact}
            icon={contactIcon(event.contactValue)}
          >
            <ContactValue
              label={event.contactLabel}
              value={event.contactValue}
            />
          </MetaRow>
        ) : null}
        {event.reachLabel ? (
          <MetaRow label={labels.reach}>{event.reachLabel}</MetaRow>
        ) : null}
      </dl>

      {/* A download, not a link to a service: the file goes straight to
       * whichever calendar the phone already uses. */}
      <ActionAnchor href={event.icsHref} tone="soft" size="compact">
        <CalendarPlus className="size-5" aria-hidden />
        {labels.addToCalendar}
      </ActionAnchor>
    </div>
  );
}
