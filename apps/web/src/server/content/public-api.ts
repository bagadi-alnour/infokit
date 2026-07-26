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
