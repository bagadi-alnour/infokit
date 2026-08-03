import { desc, eq } from "drizzle-orm";

import { db } from "~/server/db";
import { sessions } from "~/server/db/schema";

/**
 * The devices holding a session for one account.
 *
 * Read straight from the table rather than through `authServer.api.listSessions`,
 * for one reason: `second_factor_verified_at` is ours, and it is the column that
 * makes this list worth showing. A session that never passed the factor is
 * exactly the one somebody would want to end — under Better Auth a magic-link
 * sign-in produces precisely that (see `~/server/auth/index`), so "signed in" and
 * "fully verified" are different states and the list says which is which.
 *
 * The token is never selected. Nothing on a page needs it, and a rendered session
 * token is a session anybody reading over a shoulder can use.
 */
export interface DeviceSession {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  secondFactorVerified: boolean;
  /** True for the session making this request. */
  current: boolean;
}

export async function listDeviceSessions(
  userId: string,
  currentSessionId: string,
): Promise<DeviceSession[]> {
  const rows = await db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      secondFactorVerifiedAt: sessions.secondFactorVerifiedAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt));

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    secondFactorVerified: row.secondFactorVerifiedAt !== null,
    current: row.id === currentSessionId,
  }));
}

/**
 * A device, in as few words as will still identify it to its owner.
 *
 * Deliberately coarse. A full user-agent string is unreadable and says more about
 * the browser build than the person needs; "Chrome on macOS" is enough to answer
 * the only question this list exists for — is one of these not me.
 */
export function describeDevice(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const platform = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : userAgent.includes("Android")
      ? "Android"
      : /Macintosh|Mac OS X/.test(userAgent)
        ? "macOS"
        : userAgent.includes("Windows")
          ? "Windows"
          : userAgent.includes("Linux")
            ? "Linux"
            : null;
  // Order matters: Edge and Chrome both claim Chrome, Chrome claims Safari.
  const browser = /Expo|InfoKit/i.test(userAgent)
    ? "InfoKit app"
    : userAgent.includes("Edg/")
      ? "Edge"
      : userAgent.includes("OPR/")
        ? "Opera"
        : userAgent.includes("Firefox/")
          ? "Firefox"
          : userAgent.includes("Chrome/")
            ? "Chrome"
            : userAgent.includes("Safari/")
              ? "Safari"
              : null;
  if (browser && platform) return `${browser} · ${platform}`;
  return browser ?? platform;
}
