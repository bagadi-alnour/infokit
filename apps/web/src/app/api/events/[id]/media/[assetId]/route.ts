import { NextResponse } from "next/server";
import { z } from "zod";

import { createAssetReadUrl } from "~/server/assets/s3";
import { recordRestrictedRead } from "~/server/audit/reads";
import { readerUserId } from "~/server/auth/request-reader";
import {
  coordinationViewer,
  findCoordinationEvent,
  findPublicCoordinationEvent,
} from "~/server/content/coordination-events";
import { eventMediaFile } from "~/server/content/event-media";

const params = z.object({ id: z.string().uuid(), assetId: z.string().uuid() });

/**
 * One event's cover image or flyer.
 *
 * The file is not public because it was uploaded; it is readable because the
 * event is. So the event is resolved first, through exactly the tiers the
 * agenda uses — the public read model answers for a visitor, and only when it
 * does not is the caller's own session consulted — a browser cookie or a
 * phone's device session (the same order, and the same reader, as the calendar
 * file route). A flyer belonging to an `organization`-tier event is
 * therefore a 404 to everyone outside that organisation, link in hand or not.
 *
 * Storage stays private throughout: what is returned is a redirect to a
 * short-lived signed URL, never a permanent one that could be forwarded.
 */
export async function GET(
  request: Request,
  { params: raw }: { params: Promise<{ id: string; assetId: string }> },
) {
  const parsed = params.safeParse(await raw);
  if (!parsed.success) return notFound();
  const { id: eventId, assetId } = parsed.data;

  // Only the tiers matter here, and those do not vary by language; the read
  // models take a locale to resolve titles this route never reads.
  const locale = "fr";
  let readable = await findPublicCoordinationEvent({ eventId, locale });
  if (!readable) {
    const userId = await readerUserId(request);
    if (!userId) return notFound();
    const viewer = await coordinationViewer(userId);
    readable = await findCoordinationEvent({ eventId, viewer, locale });
    /**
     * A 404 to somebody who identified themselves first. Anonymous ones are the
     * internet and are not recorded; this one is an account that is already
     * inside asking for a file belonging to an event its memberships do not
     * open — a stale link at best, an enumerated id at worst, and either way the
     * kind of thing that only reads as a pattern once the attempts are written
     * down.
     */
    if (!readable) {
      await recordRestrictedRead({
        action: "asset.read_refused",
        subjectType: "asset",
        subjectId: assetId,
        actorUserId: userId,
        outcome: "denied",
        errorCode: "event_not_readable",
        metadata: { eventId },
      });
      return notFound();
    }
  }

  // Rights confirmation and a clean safety scan are checked here, so an
  // unscanned upload is invisible even to the event's own readers.
  const file = await eventMediaFile({ eventId, assetId });
  if (!file) return notFound();

  try {
    const signedUrl = await createAssetReadUrl(file.storageKey, {
      contentType: file.mimeType,
      // An image is meant to be seen in the page; a flyer is meant to be kept.
      fileName: file.isDocument ? file.fileName : undefined,
    });
    /**
     * Documents are recorded, images are not. A flyer is fetched deliberately
     * and kept afterwards, so "who took a copy of this" is a real question; a
     * cover image is fetched by every browser that renders the page it sits on,
     * and a row for each would drown the trail in requests nobody made on
     * purpose. The event's own visibility tier rides along, because a document
     * from an `organization`-tier event leaving the platform is not the same
     * event as one from a public agenda listing.
     */
    if (file.isDocument) {
      await recordRestrictedRead({
        action: "asset.document_read",
        subjectType: "asset",
        subjectId: assetId,
        subjectLabel: file.fileName,
        organizationId: readable.hostOrganizationId,
        metadata: { eventId, visibility: readable.visibility },
      });
    }
    return NextResponse.redirect(signedUrl, {
      status: 307,
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new NextResponse(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

function notFound() {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}
