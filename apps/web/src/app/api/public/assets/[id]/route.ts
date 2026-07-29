import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAssetReadUrl } from "~/server/assets/s3";
import { sanitizedImageRendition } from "~/server/assets/scan";
import { db } from "~/server/db";
import { assets } from "~/server/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = z
    .string()
    .uuid()
    .safeParse((await params).id);
  if (!parsed.success) return new NextResponse(null, { status: 404 });

  const [asset] = await db
    .select({
      id: assets.id,
      storageKey: assets.storageKey,
      mimeType: assets.mimeType,
    })
    .from(assets)
    .where(
      and(
        eq(assets.id, parsed.data),
        eq(assets.kind, "image"),
        eq(assets.visibility, "public"),
        eq(assets.scanState, "clean"),
        eq(assets.rightsConfirmed, true),
        isNull(assets.archivedAt),
      ),
    )
    .limit(1);
  if (!asset) return new NextResponse(null, { status: 404 });

  /**
   * The rendition the safety pass produced, in preference to the uploaded file:
   * a visitor is then only ever served bytes this server encoded (NFR-012,
   * docs/DATABASE-SCHEMA.md §9). An asset cleared before renditions existed has
   * none, and falls back to its original rather than disappearing.
   */
  const served = (await sanitizedImageRendition(asset.id)) ?? asset;

  try {
    const signedUrl = await createAssetReadUrl(served.storageKey, {
      contentType: served.mimeType,
    });
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
