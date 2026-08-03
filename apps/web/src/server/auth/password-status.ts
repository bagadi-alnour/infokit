import { and, eq } from "drizzle-orm";

import { db } from "~/server/db";
import { accounts } from "~/server/db/schema";

/**
 * Whether this account has a password at all, and when it last changed.
 *
 * Better Auth keeps the password on the `credential` row of `auth.accounts`
 * rather than on the user, so "has a password" is the existence of that row —
 * not a nullable column on `auth.users`, which is where it used to live.
 *
 * The distinction is not cosmetic. Most accounts on this platform sign in with an
 * emailed link and hold no password, and Better Auth needs a different call for
 * each case: `setPassword` for a first one, `changePassword` — which demands the
 * current password — for a replacement. Asking somebody with no password for
 * their current password is a dead end, so the page asks this first.
 */
export interface PasswordStatus {
  set: boolean;
  updatedAt: Date | null;
}

export async function passwordStatus(userId: string): Promise<PasswordStatus> {
  const [row] = await db
    .select({ password: accounts.password, updatedAt: accounts.updatedAt })
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")),
    )
    .limit(1);
  // The row can outlive the password itself, so the column decides rather than
  // the row's existence.
  const set = Boolean(row?.password);
  return { set, updatedAt: set ? (row?.updatedAt ?? null) : null };
}
