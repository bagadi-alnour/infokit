import type { PublicLocale } from "@infokit/shared/i18n";

export type PublicSpeechKind = "article" | "event" | "about";

/** A short content fingerprint for the route's authoritative CDN cache key. */
export function publicSpeechVersion(content: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function publicSpeechHref({
  kind,
  id,
  locale,
}: {
  kind: PublicSpeechKind;
  id?: string;
  locale: PublicLocale;
}): string {
  const query = new URLSearchParams({
    kind,
    locale,
  });
  if (id) query.set("id", id);
  return `/api/public/speech?${query.toString()}`;
}
