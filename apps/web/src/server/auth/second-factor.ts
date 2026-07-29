import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { Locale } from "@infokit/shared/i18n";
import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  sql,
} from "drizzle-orm";

import { env } from "~/env";
import { recordAudit } from "~/server/audit";
import { db } from "~/server/db";
import {
  secondFactorChallenges,
  sessions,
  userSecondFactors,
  users,
} from "~/server/db/schema";
import { sendSmsCode } from "./aws";
import { currentSessionTokenHash } from "./session-token";

/**
 * A step-up that failed for a nameable reason, so the audit row can say which
 * one. Thrown rather than returned because both cases must roll the transaction
 * back: a challenge marked consumed by a step that then failed would burn the
 * code the person is still holding.
 */
class SecondFactorFailure extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "SecondFactorFailure";
  }
}

const challengeLifetimeMs = 10 * 60 * 1000;
const resendDelayMs = 60 * 1000;
const hourlySendLimit = 5;
const maximumAttempts = 5;

function codeHash(challengeId: string, code: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`${challengeId}:${code}`)
    .digest("hex");
}

export type SendChallengeResult =
  "sent" | "cooldown" | "rate_limited" | "unavailable";

/** The number this account receives codes on, and whether it is proven yet. */
export interface SecondFactorNumber {
  phone: string;
  verified: boolean;
}

/**
 * Where a code would go for this account, or null while nobody has said.
 * Deployment configuration has no say: every account, the first superadmin
 * included, enrols its own number.
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
 * proven by `verifySecondFactorCode`, never here.
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

export async function createSecondFactorChallenge({
  userId,
  email,
  locale,
}: {
  userId: string;
  email: string;
  locale: Locale;
}): Promise<SendChallengeResult> {
  // A challenge may only be created for the account represented by the current
  // session. Check both stable id and normalized email before reading a phone
  // number, writing a challenge, or invoking SNS.
  const normalizedEmail = email.trim().toLowerCase();
  const [account] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        sql`lower(btrim(${users.email})) = ${normalizedEmail}`,
      ),
    )
    .limit(1);
  if (!account) return "unavailable";

  const recipient = await secondFactorNumber(userId);
  const sessionToken = await currentSessionTokenHash();
  if (!recipient || !sessionToken) return "unavailable";

  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const activeStates = ["pending", "sent"] as const;
  const [latest, sends] = await Promise.all([
    db
      .select({ createdAt: secondFactorChallenges.createdAt })
      .from(secondFactorChallenges)
      .where(
        and(
          eq(secondFactorChallenges.userId, userId),
          inArray(secondFactorChallenges.deliveryState, activeStates),
        ),
      )
      .orderBy(desc(secondFactorChallenges.createdAt))
      .limit(1),
    db
      .select({ value: count() })
      .from(secondFactorChallenges)
      .where(
        and(
          eq(secondFactorChallenges.userId, userId),
          gte(secondFactorChallenges.createdAt, hourAgo),
          inArray(secondFactorChallenges.deliveryState, activeStates),
        ),
      ),
  ]);

  const newest = latest[0];
  if (newest && now.getTime() - newest.createdAt.getTime() < resendDelayMs) {
    // A second press of the same button, not an event.
    return "cooldown";
  }
  if ((sends[0]?.value ?? 0) >= hourlySendLimit) {
    // Five codes in an hour is somebody who cannot receive them or somebody
    // using an account to send texts; either way an administrator should see it.
    await recordAudit({
      action: "auth.second_factor.rate_limited",
      subjectType: "auth.session",
      subjectId: userId,
      actorUserId: userId,
      outcome: "denied",
      severity: "warning",
      errorCode: "hourly_send_limit",
      metadata: { limit: hourlySendLimit },
    });
    return "rate_limited";
  }

  const id = crypto.randomUUID();
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await db.insert(secondFactorChallenges).values({
    id,
    userId,
    sessionToken,
    codeHash: codeHash(id, code),
    locale,
    expiresAt: new Date(now.getTime() + challengeLifetimeMs),
  });

  try {
    await sendSmsCode({ phone: recipient.phone, code, locale, userId });
    await db
      .update(secondFactorChallenges)
      .set({ deliveryState: "sent", sentAt: new Date() })
      .where(eq(secondFactorChallenges.id, id));
    return "sent";
  } catch (error) {
    // The editor only ever sees a generic "unavailable", so without this the
    // cause (bad credentials, unverified region, throttling) is invisible.
    console.error("[auth] second-factor SMS delivery failed", error);
    await db
      .update(secondFactorChallenges)
      .set({ deliveryState: "failed", failedAt: new Date() })
      .where(eq(secondFactorChallenges.id, id));
    return "unavailable";
  }
}

export async function verifySecondFactorCode({
  userId,
  code,
}: {
  userId: string;
  code: string;
}): Promise<boolean> {
  const sessionToken = await currentSessionTokenHash();
  if (!sessionToken) return false;

  const now = new Date();
  const [challenge] = await db
    .select({
      id: secondFactorChallenges.id,
      codeHash: secondFactorChallenges.codeHash,
    })
    .from(secondFactorChallenges)
    .where(
      and(
        eq(secondFactorChallenges.userId, userId),
        eq(secondFactorChallenges.sessionToken, sessionToken),
        eq(secondFactorChallenges.deliveryState, "sent"),
        isNotNull(secondFactorChallenges.sentAt),
        isNull(secondFactorChallenges.consumedAt),
        gt(secondFactorChallenges.expiresAt, now),
        lt(secondFactorChallenges.attempts, maximumAttempts),
      ),
    )
    .orderBy(desc(secondFactorChallenges.createdAt))
    .limit(1);
  if (!challenge) return false;

  const expected = Buffer.from(challenge.codeHash, "hex");
  const received = Buffer.from(codeHash(challenge.id, code), "hex");
  if (!timingSafeEqual(expected, received)) {
    const [attempted] = await db
      .update(secondFactorChallenges)
      .set({ attempts: sql`${secondFactorChallenges.attempts} + 1` })
      .where(
        and(
          eq(secondFactorChallenges.id, challenge.id),
          isNull(secondFactorChallenges.consumedAt),
        ),
      )
      .returning({ attempts: secondFactorChallenges.attempts });
    // A wrong code is the event the security view exists for: one is a typo,
    // five on one account in a minute is somebody working through a keyspace.
    // The attempt number goes in, the code itself never does.
    await recordAudit({
      action: "auth.second_factor.failed",
      subjectType: "auth.session",
      subjectId: userId,
      actorUserId: userId,
      outcome: "denied",
      severity: "warning",
      errorCode: "invalid_code",
      metadata: {
        attempt: attempted?.attempts ?? null,
        remaining: attempted ? maximumAttempts - attempted.attempts : null,
      },
    });
    return false;
  }

  return (
    db
      .transaction(async (tx) => {
        const [consumed] = await tx
          .update(secondFactorChallenges)
          .set({ consumedAt: now })
          .where(
            and(
              eq(secondFactorChallenges.id, challenge.id),
              isNull(secondFactorChallenges.consumedAt),
            ),
          )
          .returning({ id: secondFactorChallenges.id });
        if (!consumed) throw new SecondFactorFailure("challenge_consumed");

        const [verifiedSession] = await tx
          .update(sessions)
          .set({ secondFactorVerifiedAt: now })
          .where(
            and(
              eq(sessions.sessionToken, sessionToken),
              eq(sessions.userId, userId),
            ),
          )
          .returning({ token: sessions.sessionToken });
        if (!verifiedSession) throw new SecondFactorFailure("session_expired");

        // The same code that proves the session proves the number it was sent
        // to, so an enrolment finishes here rather than in a second flow.
        const [proven] = await tx
          .update(userSecondFactors)
          .set({ verifiedAt: now, updatedAt: now })
          .where(
            and(
              eq(userSecondFactors.userId, userId),
              isNull(userSecondFactors.verifiedAt),
            ),
          )
          .returning({ userId: userSecondFactors.userId });

        return { proven: proven !== undefined };
      })
      // Recorded after the commit, never inside it: the trail must not be able to
      // roll back a step-up the person actually passed.
      .then(async ({ proven }) => {
        await recordAudit({
          action: "auth.second_factor.verified",
          subjectType: "auth.session",
          subjectId: userId,
          actorUserId: userId,
        });
        if (proven) {
          await recordAudit({
            action: "account.second_factor.number_verified",
            subjectType: "auth.user_second_factors",
            subjectId: userId,
            actorUserId: userId,
          });
        }
        return true;
      })
      .catch(async (error: unknown) => {
        // A correct code that still did not apply: replayed after consumption, or
        // sent up on a session that expired underneath it. Both are worth seeing.
        await recordAudit({
          action: "auth.second_factor.failed",
          subjectType: "auth.session",
          subjectId: userId,
          actorUserId: userId,
          outcome: "failure",
          severity: "warning",
          errorCode:
            error instanceof SecondFactorFailure ? error.code : "unknown_error",
        });
        return false;
      })
  );
}
