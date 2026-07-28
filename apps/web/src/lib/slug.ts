/**
 * URL slug helpers. `slugify` produces a lowercase, ASCII-ish, hyphen-joined
 * key; `uniqueSlug` appends a short random suffix so generated slugs never
 * collide on the unique column without a read-modify-write loop.
 */
/**
 * The characters a hand-written slug may use — the alphabet `slugify` produces,
 * so a form can reject a slug before the server quietly rewrites it. Empty is
 * allowed: an unset slug is generated from the title.
 */
export const slugPattern = /^[a-z0-9-]*$/;

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function uniqueSlug(input: string, fallback: string): string {
  const base = slugify(input) || fallback;
  const suffix = crypto.randomUUID().slice(0, 8);
  return `${base}-${suffix}`;
}
