/**
 * URL slug helpers. `slugify` produces a lowercase, ASCII-ish, hyphen-joined
 * key; `uniqueSlug` appends a short random suffix so generated slugs never
 * collide on the unique column without a read-modify-write loop.
 */
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
