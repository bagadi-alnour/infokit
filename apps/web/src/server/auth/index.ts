import { headers } from "next/headers";
import { cache } from "react";

import { auth as authServer } from "./server";

/**
 * Two things live behind this module, and the names say which is which:
 *
 * - `authServer` is the Better Auth instance. Anything that *changes* auth
 *   state goes through it — `authServer.api.signInMagicLink(...)`,
 *   `authServer.api.enableTwoFactor(...)`, the route handler at
 *   `/api/auth/[...all]`.
 * - `auth()` reads the signed-in editor, and is what the eighty-odd protected
 *   pages, layouts and server actions in this console already call. Its shape
 *   predates Better Auth and is kept on purpose: the migration off Auth.js
 *   should not have been a rename in every file that asks who is signed in.
 */
export { authServer };

/** The signed-in editor, in the shape the console reads. */
export interface EditorSession {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    /** Whether a second factor is armed — see `secondFactorVerified` below. */
    twoFactorEnabled: boolean;
  };
  session: {
    id: string;
    token: string;
    expiresAt: Date;
  };
  /**
   * Whether **this session** satisfied the second factor.
   *
   * Read from the session row, not from `user.twoFactorEnabled`, and the
   * difference is load-bearing. Better Auth's factor is a sign-in interception,
   * and it intercepts exactly three paths — `/sign-in/email`,
   * `/sign-in/username`, `/sign-in/phone-number`. A magic link is none of them,
   * so "a factor is armed on this account" can be true of a session that was
   * never asked for a code. Gating on the account flag would let mailbox access
   * alone reach everything the factor exists to protect.
   *
   * `false` therefore means one of two different things, and `requireEditor`
   * tells them apart: a factor is armed and this session owes a code (step up),
   * or none is armed at all (enrol, if a role demands it).
   */
  secondFactorVerified: boolean;
}

async function readSession(): Promise<EditorSession | null> {
  const result = await authServer.api.getSession({ headers: await headers() });
  if (!result?.user) return null;
  // Declared through `session.additionalFields`, so it rides along on the
  // session object without being part of Better Auth's own typed surface.
  const verifiedAt = (
    result.session as typeof result.session & {
      secondFactorVerifiedAt?: Date | string | null;
    }
  ).secondFactorVerifiedAt;
  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      image: result.user.image ?? null,
      twoFactorEnabled: Boolean(result.user.twoFactorEnabled),
    },
    session: {
      id: result.session.id,
      token: result.session.token,
      expiresAt: result.session.expiresAt,
    },
    secondFactorVerified: verifiedAt != null,
  };
}

/**
 * A protected route can have several nested layouts and several actions in one
 * request, each of which must ask for itself. React's request cache lets them
 * share one answer instead of re-reading the session table per gate.
 */
export const auth = cache(readSession);
