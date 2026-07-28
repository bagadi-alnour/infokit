import { CalendarDays, CalendarPlus, Clock, MapPin } from "lucide-react";
import Link from "next/link";

import { ContactValue, contactIcon } from "~/components/public/contact-value";
import {
  ActionAnchor,
  ActionLink,
  Callout,
  Chip,
  MetaRow,
  SurfaceCard,
  inlineLinkClass,
} from "~/components/public/primitives";

/** One public event, already formatted in its city's clock by the server. */
export interface PublicEventCard {
  id: string;
  href: string;
  title: string;
  description: string | null;
  dateLabel: string;
  timeLabel: string;
  whereLabel: string | null;
  /** A map for the location — absent when the place must not be pinned. */
  mapHref: string | null;
  cityName: string;
  hostName: string | null;
  /** The host's public page, when it has one. */
  hostHref: string | null;
  contactLabel: string | null;
  contactValue: string | null;
  cancelled: boolean;
  cancellationReason: string | null;
  /** The calendar file, so the date lands in the reader's own agenda. */
  icsHref: string;
  /** The event's poster, when the organisers attached one. */
  coverImage: { url: string; alt: string; decorative: boolean } | null;
}

export interface PublicEventListLabels {
  empty: string;
  details: string;
  host: string;
  platform: string;
  contact: string;
  cancelled: string;
  cancelledNoReason: string;
  addToCalendar: string;
  openMap: string;
}

/**
 * The public agenda as a list. Each card answers the four questions someone
 * decides on before leaving the house — what, when, where, who — and a
 * cancellation is stated on the card rather than removing the event, so nobody
 * travels to something that is not happening.
 */
export function PublicEventList({
  events,
  labels,
}: {
  events: readonly PublicEventCard[];
  labels: PublicEventListLabels;
}) {
  if (events.length === 0) {
    return (
      <SurfaceCard className="p-6">
        <p className="text-copy-muted text-lg">{labels.empty}</p>
      </SurfaceCard>
    );
  }

  return (
    <ol className="grid gap-4">
      {events.map((event) => (
        <SurfaceCard as="li" key={event.id} className="grid gap-4 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Small and beside the text, not above it: the poster helps someone
             * recognise the event they were told about, and the date is still
             * the first thing the eye lands on. */}
            {event.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed remote media, no known intrinsic size
              <img
                src={event.coverImage.url}
                alt={event.coverImage.decorative ? "" : event.coverImage.alt}
                aria-hidden={event.coverImage.decorative || undefined}
                className="bg-subtle rounded-control hidden size-28 shrink-0 object-cover sm:block"
                loading="lazy"
              />
            ) : null}
            <div className="grid min-w-0 flex-1 gap-3">
              <h2 className="text-ink text-xl font-bold tracking-tight">
                <Link href={event.href} className={inlineLinkClass}>
                  {event.title}
                </Link>
              </h2>
              <div className="flex flex-wrap gap-2">
                {/* An event is a date first, so the date gets the one washed
                 * block on the card, in the family hue of the agenda
                 * (docs/DESIGN-SYSTEM.md §5) — and it is also the control that
                 * keeps it: one tap and it is in the reader's own calendar,
                 * hour and timezone included. */}
                <a
                  href={event.icsHref}
                  aria-label={`${labels.addToCalendar} — ${event.dateLabel} ${event.timeLabel}`}
                  className="rounded-control focus-visible:outline-brand bg-event-wash text-event hover:shadow-ring inline-flex items-center gap-2 px-3 py-1.5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <CalendarDays className="size-4 shrink-0" aria-hidden />
                  <span className="underline decoration-1 underline-offset-2">
                    {event.dateLabel}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Clock className="size-4 shrink-0" aria-hidden />
                    {event.timeLabel}
                  </span>
                </a>
                {event.mapHref ? (
                  <a
                    href={event.mapHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${labels.openMap} — ${event.whereLabel ?? event.cityName}`}
                    className="rounded-chip focus-visible:outline-brand focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <Chip
                      icon={<MapPin className="size-4" aria-hidden />}
                      className="hover:border-brand hover:text-brand-deep underline decoration-1 underline-offset-2"
                    >
                      {event.whereLabel ?? event.cityName}
                    </Chip>
                  </a>
                ) : (
                  <Chip icon={<MapPin className="size-4" aria-hidden />}>
                    {event.whereLabel ?? event.cityName}
                  </Chip>
                )}
              </div>
              {event.description ? (
                <p className="text-copy-muted text-[1.0625rem] leading-relaxed">
                  {event.description}
                </p>
              ) : null}
              <dl className="grid gap-1.5">
                <MetaRow label={labels.host}>
                  {event.hostName === null ? (
                    labels.platform
                  ) : event.hostHref ? (
                    <Link href={event.hostHref} className={inlineLinkClass}>
                      {event.hostName}
                    </Link>
                  ) : (
                    event.hostName
                  )}
                </MetaRow>
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
              </dl>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionAnchor href={event.icsHref} tone="soft" size="compact">
                <CalendarPlus className="size-5" aria-hidden />
                {labels.addToCalendar}
              </ActionAnchor>
              <ActionLink
                href={event.href}
                tone="outline"
                size="compact"
                className="text-event hover:text-event"
              >
                {labels.details}
              </ActionLink>
            </div>
          </div>
          {event.cancelled ? (
            <Callout tone="warning" title={labels.cancelled}>
              {event.cancellationReason ?? labels.cancelledNoReason}
            </Callout>
          ) : null}
        </SurfaceCard>
      ))}
    </ol>
  );
}
