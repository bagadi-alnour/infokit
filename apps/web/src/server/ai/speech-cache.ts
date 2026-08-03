import "server-only";

import { createHash } from "node:crypto";

import type { PublicLocale } from "@infokit/shared/i18n";

import { env } from "~/env";
import {
  generatePublicSpeech,
  speechRenditionFingerprint,
} from "~/server/ai/speech";
import { readAssetObjectIfPresent, writeAssetObject } from "~/server/assets/s3";

/**
 * Bump when a change should orphan every stored rendition rather than reuse it.
 * Voice, speed, model and instruction wording travel in the fingerprint below,
 * so this is only for changes those do not describe — a different chunking rule,
 * say, which alters the audio without altering any of the recorded inputs.
 */
const CACHE_VERSION = "v1";

const CACHE_PREFIX = "derived/public-speech";

/** One rendition of a full page. Well above any single article's audio. */
const MAX_CACHED_SPEECH_BYTES = 40 * 1024 * 1024;

/**
 * A content address for one spoken rendition.
 *
 * SHA-256 over every input that changes the audio, deliberately *not* the
 * `publicSpeechVersion` fingerprint the URL carries. That one is a 32-bit FNV
 * hash, which is fine for a CDN key — a collision there costs a cache miss —
 * but this key decides which bytes a reader is served, so a collision would
 * play one article's audio under another's headline. The cost of the stronger
 * hash is a few microseconds per request.
 */
export function publicSpeechCacheKey(input: {
  text: string;
  contentLocale: PublicLocale;
  interfaceLocale: PublicLocale;
}): string {
  const digest = createHash("sha256")
    .update(
      [
        CACHE_VERSION,
        speechRenditionFingerprint(input.contentLocale, input.interfaceLocale),
        env.AI_SPEECH_MODEL,
        input.text,
      ].join("\u0000"),
      "utf8",
    )
    .digest("hex");
  return `${CACHE_PREFIX}/${CACHE_VERSION}/${digest}.mp3`;
}

/**
 * Renditions being generated right now, so that N concurrent readers of the
 * same cold page make one provider call between them instead of N. Per
 * instance, which is the honest scope: it collapses the burst a newly
 * published page attracts, not a spend race across a whole deployment.
 */
const inFlight = new Map<string, Promise<Buffer>>();

/**
 * `generatePublicSpeech`, with the paid call skipped when the same audio has
 * been produced before.
 *
 * The route already funnels every reader of one text onto a single canonical
 * URL so the CDN can hold the answer. That works until the CDN does not have
 * it — a cold edge, an evicted entry, a first visitor, or someone deliberately
 * arriving before the cache is warm — and behind that gap sits an anonymous
 * route calling a metered provider. This makes the floor content-shaped rather
 * than traffic-shaped: the provider is paid once per distinct published text,
 * however many times it is asked for.
 */
export async function cachedPublicSpeech(
  text: string,
  contentLocale: PublicLocale,
  interfaceLocale: PublicLocale,
): Promise<Buffer> {
  // Storage is optional in development. Without a bucket there is nowhere to
  // remember the answer, so the route keeps working and simply pays each time.
  if (!env.AWS_S3_ASSET_BUCKET) {
    return generatePublicSpeech(text, contentLocale, interfaceLocale);
  }

  const storageKey = publicSpeechCacheKey({
    text,
    contentLocale,
    interfaceLocale,
  });

  const stored = await readAssetObjectIfPresent(
    storageKey,
    MAX_CACHED_SPEECH_BYTES,
  );
  if (stored) return stored;

  const existing = inFlight.get(storageKey);
  if (existing) return existing;

  const pending = (async () => {
    const audio = await generatePublicSpeech(
      text,
      contentLocale,
      interfaceLocale,
    );
    try {
      await writeAssetObject({
        storageKey,
        mimeType: "audio/mpeg",
        body: audio,
      });
    } catch (error) {
      // The reader has working audio in hand; only the saving failed. Refusing
      // to serve it would turn a cache outage into an outage of the feature.
      console.error("public speech cache write failed", { storageKey, error });
    }
    return audio;
  })();

  inFlight.set(storageKey, pending);
  try {
    return await pending;
  } finally {
    inFlight.delete(storageKey);
  }
}
