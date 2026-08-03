import { and, eq, gt } from "drizzle-orm";

import { db } from "~/server/db";
import { verificationTokens } from "~/server/db/schema";

/**
 * Better Auth stores a password-reset token as a row in its verification table
 * under the identifier `reset-password:<token>`, and offers no endpoint for
 * "would this token work?" — the only way to find out through the library is to
 * spend it.
 *
 * That is one question worth asking anyway, so the row is read directly. The
 * cost is a documented dependency on Better Auth's identifier format: the
 * alternative is a reset page that accepts a new password twice over, thinks
 * about it, and only then admits the link died three days ago.
 *
 * Nothing is consumed here and no session is granted. A `true` means the form
 * is worth showing; `resetPassword` still re-checks and is the only thing that
 * can actually change a password.
 */
export async function isResetTokenValid(token: string): Promise<boolean> {
  if (!token) return false;
  const [row] = await db
    .select({ id: verificationTokens.id })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, `reset-password:${token}`),
        gt(verificationTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row !== undefined;
}
