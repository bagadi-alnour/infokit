/**
 * The slug out of a site-relative link. Payloads carry web paths
 * (`/fr/actualites/le-titre`); the app's own routes are keyed by slug, and the
 * last segment is that slug on every public path.
 *
 * It lives here rather than next to the cards because the link rows need it too,
 * and a card must not have to import a card to follow a link.
 */
export function hrefSlug(href: string): string {
  const segments = href.split("?")[0]?.split("/").filter(Boolean) ?? [];
  return segments[segments.length - 1] ?? "";
}
