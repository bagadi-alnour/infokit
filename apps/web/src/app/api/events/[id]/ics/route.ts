import { isPublicLocale, type PublicLocale } from "@infokit/shared/i18n";
import { NextResponse } from "next/server";
import { z } from "zod";

import { eventToIcs, icsFileName } from "~/lib/ics";
import { recordRestrictedRead } from "~/server/audit/reads";
import { readerUserId } from "~/server/auth/request-reader";
import {
  coordinationViewer,
  findCoordinationEvent,
  findPublicCoordinationEvent,
  type CoordinationEventRecord,
} from "~/server/content/coordination-events";
import {
  eventWhereLabel,
  listCityViews,
  FALLBACK_TIME_ZONE,
} from "~/server/content/event-presentation";

/**
 * One event as a calendar file, so "when" is not something the reader has to
 * copy by hand — a missed date is a missed meal or a missed appointment.
 *
 * The visibility tiers are enforced here exactly as the agenda enforces them:
 * the public read model answers first, and only if it does not is the caller's
 * own session consulted — a browser cookie or a phone's device session, since
 * "add to calendar" has to work from the app too. An id from the `organization`
 * tier therefore returns 404 to everyone outside that organisation, download
 * link or not.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = z
    .string()
    .uuid()
    .safeParse((await params).id);
  if (!parsed.success) return notFound();
  const eventId = parsed.data;

  const requested = new URL(request.url).searchParams.get("locale");
  const locale: PublicLocale = isPublicLocale(requested) ? requested : "fr";

  let found: CoordinationEventRecord | null = await findPublicCoordinationEvent(
    {
      eventId,
      locale,
    },
  );
  if (!found) {
    const userId = await readerUserId(request);
    if (!userId) return notFound();
    const viewer = await coordinationViewer(userId);
    found = await findCoordinationEvent({ eventId, viewer, locale });
    /**
     * The refusal is recorded, the download is not. An account that identified
     * itself and then asked for an event its memberships do not open is worth a
     * row; the file it would have received carries no personal data, and calendar
     * software re-fetches what it already has, so recording the successful
     * downloads would be a stream of rows about the same one click.
     */
    if (!found) {
      await recordRestrictedRead({
        action: "event.calendar_read_refused",
        subjectType: "coordination_event",
        subjectId: eventId,
        actorUserId: userId,
        outcome: "denied",
        errorCode: "event_not_readable",
      });
      return notFound();
    }
  }
  const event = found;

  const cities = await listCityViews(locale);
  const city = cities.find((candidate) => candidate.id === event.cityId);
  const origin = new URL(request.url).origin;
  const body = eventToIcs({
    uid: `${event.id}@infokit`,
    title: event.title,
    description:
      event.status === "cancelled" ? cancelledText(event) : event.description,
    location:
      [eventWhereLabel(event), city?.name].filter(Boolean).join(", ") || null,
    hostName: event.hostName,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    timeZone: city?.timezone ?? FALLBACK_TIME_ZONE,
    cancelled: event.status === "cancelled",
    // Only a public event has a page a calendar entry may link to.
    url:
      event.visibility === "public"
        ? `${origin}/${locale}/events/${event.id}`
        : null,
    stamp: new Date(),
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFileName(event.title)}"`,
      // An agenda changes; a cached file would keep saying the old hour.
      "Cache-Control": "private, no-store",
    },
  });
}

/** A cancellation belongs in the calendar entry, not only in our own list. */
function cancelledText(event: CoordinationEventRecord) {
  return (
    [event.cancellationReason, event.description]
      .filter(Boolean)
      .join("\n\n") || null
  );
}

function notFound() {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}
