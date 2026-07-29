/**
 * Was this request made by a person, or by their browser guessing?
 *
 * Next fetches a route before anybody has looked at it — hovering a sidebar link
 * is enough, and the page renders in full. Anything a render records about the
 * reader therefore has to be able to tell the two apart, or the trail ends up
 * saying somebody opened a roster they never opened.
 *
 * A prefetch announces itself, in one of four ways depending on who is asking:
 * the App Router sends its own header, and browsers that prefetch on their own
 * send one of the `purpose` family. A real navigation sends none of them.
 */
const PREFETCH_HEADERS = ["purpose", "x-purpose", "x-moz"] as const;

/** The App Router's own marker, present only on router prefetches. */
const ROUTER_PREFETCH_HEADER = "next-router-prefetch";

export function isPrefetchRequest(headers: Headers): boolean {
  if (headers.get(ROUTER_PREFETCH_HEADER) !== null) return true;
  return PREFETCH_HEADERS.some(
    (name) => headers.get(name)?.trim().toLowerCase() === "prefetch",
  );
}
