import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireRouteLocale } from "~/i18n/route-locale";
import { recordAudit } from "~/server/audit";
import { db } from "~/server/db";
import { translationAssignments } from "~/server/db/schema";
import {
  createTranslationAssignmentSessionValue,
  translationAssignmentCookie,
} from "~/server/translation-assignment-session";

/**
 * A refused link. The token is never written down — it is a bearer secret, and a
 * trail holding live ones would be a second way in — so the row says which gate
 * refused and leaves the request context (address, browser, time) to say who was
 * knocking. No actor is named either: a token that opens nothing proves nothing
 * about who presented it, so the row reads as an attempt by nobody in particular.
 */
async function recordRefusal(errorCode: string) {
  await recordAudit({
    action: "translation.assignment.link_refused",
    subjectType: "translation_assignment",
    outcome: "denied",
    severity: "warning",
    errorCode,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; token: string }> },
) {
  const { locale: rawLocale, token } = await params;
  const locale = requireRouteLocale(rawLocale);
  const failure = new URL(`/${locale}/translate/unavailable`, request.url);
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
    await recordRefusal("malformed_token");
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
      organizationId: translationAssignments.organizationId,
    });
  // A well-formed token that opens nothing is the interesting case: the link was
  // used once already, was revoked, has expired, or was never issued at all.
  if (!assignment) {
    await recordRefusal("token_unusable");
    return NextResponse.redirect(failure);
  }
  await recordAudit({
    action: "translation.assignment.link_opened",
    subjectType: "translation_assignment",
    subjectId: assignment.id,
    organizationId: assignment.organizationId,
    actorType: "translator",
  });

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
