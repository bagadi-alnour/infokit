/**
 * Shared shape for the public read endpoints (`/api/public/*`): the JSON the
 * native app reads. Anonymous, GET-only, published content only — every query
 * behind them goes through the public read model, never authoring tables.
 */
import { resolvePublicLocale, type PublicLocale } from "@infokit/shared/i18n";
import { NextResponse } from "next/server";

/**
 * The reader's language: an explicit `?locale=` wins, otherwise the device's
 * Accept-Language. Unknown tags fall back to French rather than failing, so a
 * client never has to know the supported set to get an answer.
 */
export function requestedPublicLocale(request: Request): PublicLocale {
  const requested = new URL(request.url).searchParams.get("locale");
  if (requested) return resolvePublicLocale(requested);
  const header = request.headers.get("accept-language");
  return resolvePublicLocale(header?.split(",")[0]);
}

/**
 * The month a calendar client asked for, as `YYYY-MM`. Anything else is
 * ignored rather than rejected: a malformed month means "show me the current
 * one", never an error page in place of the agenda.
 */
export function requestedMonth(request: Request): string | undefined {
  const requested = new URL(request.url).searchParams.get("month");
  return requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested)
    ? requested
    : undefined;
}

/**
 * Public payloads are the same for every reader of a language, so a shared
 * cache may hold them briefly — short enough that a schedule correction reaches
 * phones within the minute, since a stale opening time sends someone across
 * town for nothing.
 */
export function publicJson(payload: unknown): NextResponse {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=60, must-revalidate",
      // Read-only published content with no credentials: any origin may read
      // it, which is what lets the Expo web build talk to a dev server.
      "Access-Control-Allow-Origin": "*",
      Vary: "Accept-Language",
    },
  });
}

/**
 * Member payloads belong to one person and one session, so nothing may hold
 * them: no shared cache, no browser cache, no "back" restoring a colleague's
 * agenda. `Vary: Authorization` says out loud what the store directive already
 * enforces.
 */
export function memberJson(payload: unknown, status = 200): NextResponse {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
      Vary: "Authorization, Accept-Language",
    },
  });
}

/** The device session is missing, expired or revoked — sign in again. */
export function memberUnauthorized(): NextResponse {
  return memberJson({ error: "unauthorized" }, 401);
}

export function publicNotFound(): NextResponse {
  return NextResponse.json(
    { error: "not_found" },
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
