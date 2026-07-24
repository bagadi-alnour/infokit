import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAssetReadUrl } from "~/server/assets/s3";
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
    .select({ storageKey: assets.storageKey })
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

  try {
    const signedUrl = await createAssetReadUrl(asset.storageKey);
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
