import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { cache } from "react";

import { REQUESTED_PATH_HEADER } from "~/lib/requested-path";

/**
 * The "how" half of an audit event: which surface the attempt arrived on, from
 * which address, in which client, under which request.
 *
 * Every field is optional on purpose. This is read from `headers()`, and plenty
 * of legitimate callers have no request at all — the seed script, a unit test, a
 * background job. None of them should fail to write an audit event because they
 * cannot say what browser they were using, so a missing context is a context of
 * nulls rather than a thrown error.
 */
export interface AuditRequestContext {
  route: string | null;
  method: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
}

const EMPTY_CONTEXT: AuditRequestContext = {
  route: null,
  method: null,
  ipAddress: null,
  userAgent: null,
  requestId: null,
};

/**
 * Where the client address may come from, best evidence first.
 *
 * The platform is always reached through one reverse proxy, which is what makes
 * the first entry of `x-forwarded-for` meaningful: the proxy appends the peer it
 * actually saw. Read directly, without a proxy, these headers are attacker
 * input — so what lands in the column is "the address the edge reported", which
 * is what a security review can act on, and nothing stronger is claimed for it.
 */
const CLIENT_IP_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "fly-client-ip",
  "x-vercel-forwarded-for",
] as const;

const REQUEST_ID_HEADERS = [
  "x-request-id",
  "x-amzn-trace-id",
  "x-vercel-id",
] as const;

/** Matches the `varchar` widths in `audit.events`, so nothing is refused. */
const MAX_IP = 45;
const MAX_ROUTE = 255;
const MAX_USER_AGENT = 400;
const MAX_REQUEST_ID = 100;

function trim(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (cleaned === "") return null;
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

/**
 * Exported for the one other column that stores an address the edge reported:
 * `auth.trusted_devices.ip_address`, shown so somebody can recognise the device
 * they are about to revoke. The parsing is fiddly enough — forwarded chains,
 * bracketed IPv6, ports — that a second copy would be a second set of bugs.
 */
export function clientAddress(bag: Headers): string | null {
  for (const name of CLIENT_IP_HEADERS) {
    const raw = bag.get(name);
    if (!raw) continue;
    // A forwarded chain is `client, proxy1, proxy2`; the client is the first.
    const first = raw.split(",")[0]?.trim();
    if (!first) continue;
    // `[::1]:52134` and `192.0.2.4:52134` both name a port the log has no use
    // for. An IPv6 address without brackets keeps its colons.
    const withoutPort = first.startsWith("[")
      ? (first.slice(1).split("]")[0] ?? first)
      : first.split(":").length === 2
        ? (first.split(":")[0] ?? first)
        : first;
    const address = trim(withoutPort, MAX_IP);
    if (address) return address;
  }
  return null;
}

/**
 * The pathname the attempt was aimed at, never its query string — a query
 * string is where identifiers, search terms and return paths end up, and a
 * security log that copies them becomes a second place they leak from.
 */
function attemptedRoute(bag: Headers): string | null {
  const requested = bag.get(REQUESTED_PATH_HEADER);
  if (requested) return trim(requested.split("?")[0], MAX_ROUTE);
  // Outside the middleware's matcher — a sign-in form, a public page — the
  // referer is the only thing that names the page the action was dispatched
  // from. Parsed, not concatenated, so a malformed value yields nothing.
  const referer = bag.get("referer");
  if (!referer) return null;
  try {
    return trim(new URL(referer).pathname, MAX_ROUTE);
  } catch {
    return null;
  }
}

/**
 * `headers()` carries no verb, so this reads the one signal that distinguishes
 * the two cases that matter: a server action always POSTs and always arrives
 * with `next-action`, and everything else is a render.
 */
function inferredMethod(bag: Headers): string {
  return bag.has("next-action") ? "POST" : "GET";
}

/**
 * A generated id, memoised per request, so several events written while
 * handling one action share one identifier and can be read back as one story.
 */
const generatedRequestId = cache(() => randomUUID());

/**
 * Read once per request: `cache` makes the header parsing free for the second
 * and third event, which matters because a single action can easily write three.
 */
export const auditRequestContext = cache(
  async (): Promise<AuditRequestContext> => {
    let bag: Headers;
    try {
      bag = await headers();
    } catch {
      // No request in scope: a script, a test, a job. Not an error.
      return EMPTY_CONTEXT;
    }
    const inbound = REQUEST_ID_HEADERS.map((name) => bag.get(name)).find(
      (value) => value !== null && value.trim() !== "",
    );
    return {
      route: attemptedRoute(bag),
      method: inferredMethod(bag),
      ipAddress: clientAddress(bag),
      userAgent: trim(bag.get("user-agent"), MAX_USER_AGENT),
      requestId: trim(inbound ?? generatedRequestId(), MAX_REQUEST_ID),
    };
  },
);
