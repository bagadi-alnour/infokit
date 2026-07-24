import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireRouteLocale } from "~/i18n/route-locale";
import { db } from "~/server/db";
import { translationAssignments } from "~/server/db/schema";
import {
  createTranslationAssignmentSessionValue,
  translationAssignmentCookie,
} from "~/server/translation-assignment-session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; token: string }> },
) {
  const { locale: rawLocale, token } = await params;
  const locale = requireRouteLocale(rawLocale);
  const failure = new URL(`/${locale}/translate/unavailable`, request.url);
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
    return NextResponse.redirect(failure);
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [assignment] = await db
    .update(translationAssignments)
    .set({ tokenConsumedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(translationAssignments.tokenHash, tokenHash),
        isNull(translationAssignments.tokenConsumedAt),
        isNull(translationAssignments.revokedAt),
        gt(translationAssignments.expiresAt, new Date()),
      ),
    )
    .returning({
      id: translationAssignments.id,
      expiresAt: translationAssignments.expiresAt,
    });
  if (!assignment) return NextResponse.redirect(failure);

  const response = NextResponse.redirect(
    new URL(`/${locale}/translate/assignment`, request.url),
  );
  response.cookies.set(
    translationAssignmentCookie,
    createTranslationAssignmentSessionValue(
      assignment.id,
      assignment.expiresAt,
    ),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: `/${locale}/translate`,
      expires: assignment.expiresAt,
    },
  );
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
