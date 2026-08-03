import { and, eq, isNull } from "drizzle-orm";

import { recordAudit } from "~/server/audit";
import { db } from "~/server/db";
import { twoFactors, userSecondFactors } from "~/server/db/schema";

/**
 * The SMS channel of the second factor: *where* a code goes.
 *
 * Better Auth owns everything else about the factor — minting the code, storing
 * only its digest, expiring it, counting failures and locking the account out.
 * What it has no opinion about is the destination, so that stays here, and this
 * module is deliberately the whole of it: no challenge table, no attempt
 * counter, no timing-safe comparison. Those existed before because nothing else
 * implemented them; keeping them now would mean two implementations of
 * single-use, one of which nothing exercises.
 *
 * The number lives in the database rather than in deployment configuration
 * because everybody who reaches the console arrives by invitation: an allowlist
 * keyed by email would mean editing the environment for every person invited,
 * and an account whose role makes the second factor mandatory would be unable
 * to finish its first sign-in.
 */

/** The number this account receives codes on, and whether it is proven yet. */
export interface SecondFactorNumber {
  phone: string;
  verified: boolean;
}

/**
 * Where a code would go for this account, or null while nobody has said. Read
 * on the send path by `otpOptions.sendOTP` in `./server`.
 */
export async function secondFactorNumber(
  userId: string,
): Promise<SecondFactorNumber | null> {
  const [row] = await db
    .select({
      phone: userSecondFactors.phone,
      verifiedAt: userSecondFactors.verifiedAt,
    })
    .from(userSecondFactors)
    .where(eq(userSecondFactors.userId, userId))
    .limit(1);
  return row ? { phone: row.phone, verified: row.verifiedAt !== null } : null;
}

/**
 * Which factors this account can actually answer with, for a step-up.
 *
 * At sign-in Better Auth reports this itself, in `twoFactorMethods`. A step-up
 * has no sign-in response to read — the session already exists — so the same
 * question is asked of the tables, on the same terms Better Auth uses: an
 * authenticator counts once its secret is `verified`, and SMS counts whenever a
 * number is on file.
 */
export async function availableSecondFactors(
  userId: string,
): Promise<{ totp: boolean; otp: boolean }> {
  const [[factor], number] = await Promise.all([
    db
      .select({ verified: twoFactors.verified })
      .from(twoFactors)
      .where(eq(twoFactors.userId, userId))
      .limit(1),
    secondFactorNumber(userId),
  ]);
  return { totp: factor?.verified === true, otp: number !== null };
}

/**
 * Enough of a number to recognise, not enough to reconstruct: the interface
 * confirms where a code went without printing a line anybody can read over a
 * shoulder.
 */
export function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)} ••• ••• ${phone.slice(-2)}`;
}

/**
 * Record the number an account claims, unproven. Enrolling replaces whatever
 * was there and clears the proof, so a mistyped number is corrected by
 * enrolling again — the next code goes to the new number and nothing else
 * changes until it is confirmed.
 *
 * Callers must already hold a session for `userId`; possession of the line is
 * proven by a code coming back, never here.
 */
export async function enrolSecondFactorNumber({
  userId,
  phone,
}: {
  userId: string;
  phone: string;
}) {
  const now = new Date();
  await db
    .insert(userSecondFactors)
    .values({ userId, phone, verifiedAt: null, updatedAt: now })
    .onConflictDoUpdate({
      target: userSecondFactors.userId,
      set: { phone, verifiedAt: null, updatedAt: now },
    });
  await recordAudit({
    action: "account.second_factor.number_enrolled",
    subjectType: "auth.user_second_factors",
    subjectId: userId,
    actorUserId: userId,
    // Masked, so "which number did they enrol on Tuesday" is answerable
    // without the trail becoming a second copy of everybody's phone number.
    metadata: { number: maskPhone(phone) },
  });
}

/**
 * Mark the enrolled number proven, having seen a code sent to it come back.
 *
 * Called by the enrolment action once Better Auth has accepted the code: the
 * library confirms the *code*, and only the caller knows that code travelled by
 * SMS rather than from an authenticator app, so it is the caller that can turn
 * acceptance into proof of the line. An already-proven number is left alone,
 * which is what keeps this idempotent across a re-verification.
 */
export async function markSecondFactorNumberVerified(
  userId: string,
): Promise<void> {
  const now = new Date();
  const [proven] = await db
    .update(userSecondFactors)
    .set({ verifiedAt: now, updatedAt: now })
    .where(
      and(
        eq(userSecondFactors.userId, userId),
        isNull(userSecondFactors.verifiedAt),
      ),
    )
    .returning({ userId: userSecondFactors.userId });
  if (!proven) return;
  await recordAudit({
    action: "account.second_factor.number_verified",
    subjectType: "auth.user_second_factors",
    subjectId: userId,
    actorUserId: userId,
  });
}
