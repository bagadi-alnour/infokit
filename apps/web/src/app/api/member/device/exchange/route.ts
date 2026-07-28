import { z } from "zod";

import { exchangeDeviceGrant } from "~/server/auth/device-session";
import { memberJson } from "~/server/content/public-api";

const body = z.object({
  /** As shown by the hand-off page: nine digits, grouped or not. */
  code: z.string().trim().min(9).max(16),
});

/**
 * The last step of signing in on a phone: trade the one-time code the browser
 * showed for a session token. The code is single-use and lives two minutes, so
 * this endpoint needs no rate limit of its own beyond the one on minting.
 */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return memberJson({ error: "invalid_code" }, 400);
  const session = await exchangeDeviceGrant(parsed.data.code);
  // Used, expired and never-existed are one answer: a code is guessable enough
  // that saying which would help someone try again.
  if (!session) return memberJson({ error: "invalid_code" }, 400);
  return memberJson({
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
  });
}
