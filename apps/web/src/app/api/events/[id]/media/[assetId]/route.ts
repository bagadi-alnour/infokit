import { NextResponse } from "next/server";
import { z } from "zod";

import { createAssetReadUrl } from "~/server/assets/s3";
import { auth } from "~/server/auth";
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
 * does not is the caller's own session consulted (the same order as the
 * calendar file route). A flyer belonging to an `organization`-tier event is
 * therefore a 404 to everyone outside that organisation, link in hand or not.
 *
 * Storage stays private throughout: what is returned is a redirect to a
 * short-lived signed URL, never a permanent one that could be forwarded.
 */
export async function GET(
  _request: Request,
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
    const session = await auth();
    if (!session?.user) return notFound();
    const viewer = await coordinationViewer(session.user.id);
    readable = await findCoordinationEvent({ eventId, viewer, locale });
  }
  if (!readable) return notFound();

  // Rights confirmation and a clean safety scan are checked here, so an
  // unscanned upload is invisible even to the event's own readers.
  const file = await eventMediaFile({ eventId, assetId });
  if (!file) return notFound();

  try {
    const signedUrl = await createAssetReadUrl(
      file.storageKey,
      // An image is meant to be seen in the page; a flyer is meant to be kept.
      file.isDocument ? file.fileName : undefined,
    );
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
