import { isPublicLocale } from "@infokit/shared/i18n";
import { z } from "zod";

import { publicSpeechVersion } from "~/lib/public-speech";
import { cachedPublicSpeech } from "~/server/ai/speech-cache";
import { publicSpeechContent } from "~/server/content/public-speech-content";

export const runtime = "nodejs";

const requestSchema = z
  .object({
    kind: z.enum(["article", "event", "about"]),
    id: z.string().trim().min(1).max(240).optional(),
    locale: z.string().refine(isPublicLocale),
  })
  .superRefine((value, context) => {
    if (value.kind !== "about" && !value.id) {
      context.addIssue({
        code: "custom",
        path: ["id"],
        message: "A published record is required",
      });
    }
  });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = requestSchema.safeParse({
    kind: url.searchParams.get("kind"),
    id: url.searchParams.get("id") ?? undefined,
    locale: url.searchParams.get("locale"),
  });
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_request" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const content = await publicSpeechContent(parsed.data);
  if (!content) {
    return Response.json(
      { error: "not_found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  /**
   * Only one URL per published text reaches the paid provider. Unknown query
   * parameters and stale/made-up versions redirect to this authoritative key,
   * so changing a harmless query string cannot bypass the shared audio cache.
   */
  const canonical = new URL(url.pathname, url.origin);
  canonical.searchParams.set("kind", parsed.data.kind);
  canonical.searchParams.set("locale", parsed.data.locale);
  if (parsed.data.id) canonical.searchParams.set("id", parsed.data.id);
  canonical.searchParams.set("version", publicSpeechVersion(content.text));
  if (url.search !== canonical.search) {
    return new Response(null, {
      status: 307,
      headers: {
        "Cache-Control": "no-store",
        Location: canonical.toString(),
      },
    });
  }

  try {
    const audio = await cachedPublicSpeech(
      content.text,
      content.contentLocale,
      parsed.data.locale,
    );
    const body = new ArrayBuffer(audio.byteLength);
    new Uint8Array(body).set(audio);
    return new Response(body, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control":
          "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
        "Content-Disposition": 'inline; filename="infokit-listen.mp3"',
        "Content-Length": String(audio.byteLength),
        "Content-Type": "audio/mpeg",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "speech_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
