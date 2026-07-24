import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, count, desc, eq, gt, gte, isNull } from "drizzle-orm";

import { env } from "~/env";
import { db } from "~/server/db";
import { passwordResetTokens, users } from "~/server/db/schema";
import { hashPassword } from "./password";
import { auditEvents } from "~/server/db/schema";

const tokenLifetimeMs = 60 * 60 * 1000; // one hour
const resendDelayMs = 60 * 1000;
const hourlyIssueLimit = 5;

/** Stored representation of the emailed secret — never the secret itself. */
function tokenHash(token: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(token).digest("hex");
}

export type IssueResetResult =
  | { status: "issued"; token: string }
  | { status: "cooldown" }
  | { status: "rate_limited" }
  | { status: "unknown" };

/**
 * Issue a single-use reset token for an email address. Returns the raw token
 * (to be emailed) only on success. Callers must preserve anti-enumeration:
 * treat every result the same way in the UI and only send mail on "issued".
 */
export async function issuePasswordResetToken(
  email: string,
): Promise<IssueResetResult> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) return { status: "unknown" };

  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const [latest, issued] = await Promise.all([
    db
      .select({ createdAt: passwordResetTokens.createdAt })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id))
      .orderBy(desc(passwordResetTokens.createdAt))
      .limit(1),
    db
      .select({ value: count() })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          gte(passwordResetTokens.createdAt, hourAgo),
        ),
      ),
  ]);

  const newest = latest[0];
  if (newest && now.getTime() - newest.createdAt.getTime() < resendDelayMs) {
    return { status: "cooldown" };
  }
  if ((issued[0]?.value ?? 0) >= hourlyIssueLimit) {
    return { status: "rate_limited" };
  }

  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: tokenHash(token),
    expiresAt: new Date(now.getTime() + tokenLifetimeMs),
  });
  return { status: "issued", token };
}

/**
 * Consume a reset token and set the new password in one transaction. Returns
 * true only when a live, unused token matched and the password was updated.
 */
export async function resetPasswordWithToken({
  token,
  newPassword,
}: {
  token: string;
  newPassword: string;
}): Promise<boolean> {
  const now = new Date();
  const [record] = await db
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      tokenHash: passwordResetTokens.tokenHash,
    })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ),
    )
    .limit(1);
  if (!record) return false;

  // Constant-time confirmation the stored hash matches the presented token.
  const expected = Buffer.from(record.tokenHash, "hex");
  const received = Buffer.from(tokenHash(token), "hex");
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return false;
  }

  const passwordHash = await hashPassword(newPassword);
  return db
    .transaction(async (tx) => {
      const [consumed] = await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordResetTokens.id, record.id),
            isNull(passwordResetTokens.usedAt),
          ),
        )
        .returning({ id: passwordResetTokens.id });
      if (!consumed) throw new Error("The reset token was already used");

      await tx
        .update(users)
        .set({ passwordHash, passwordUpdatedAt: now })
        .where(eq(users.id, record.userId));

      await tx.insert(auditEvents).values({
        actorUserId: record.userId,
        action: "auth.password.reset",
        subjectType: "auth.user",
        subjectId: record.userId,
      });

      return true;
    })
    .catch(() => false);
}

/** True when a reset token is live and unused — used to gate the reset page. */
export async function isResetTokenValid(token: string): Promise<boolean> {
  const now = new Date();
  const [record] = await db
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ),
    )
    .limit(1);
  return Boolean(record);
}
