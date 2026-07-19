import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { Locale } from "@calais/shared/i18n";
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
import { db } from "~/server/db";
import {
  auditEvents,
  secondFactorChallenges,
  sessions,
} from "~/server/db/schema";
import { sendSmsCode } from "./aws";
import { editorRecipient } from "./editors";
import { currentSessionTokenHash } from "./session-token";

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

export async function createSecondFactorChallenge({
  userId,
  email,
  locale,
}: {
  userId: string;
  email: string;
  locale: Locale;
}): Promise<SendChallengeResult> {
  const recipient = editorRecipient(email);
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
    return "cooldown";
  }
  if ((sends[0]?.value ?? 0) >= hourlySendLimit) return "rate_limited";

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
    await sendSmsCode({ phone: recipient.phone, code, locale });
    await db
      .update(secondFactorChallenges)
      .set({ deliveryState: "sent", sentAt: new Date() })
      .where(eq(secondFactorChallenges.id, id));
    return "sent";
  } catch {
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
    await db
      .update(secondFactorChallenges)
      .set({ attempts: sql`${secondFactorChallenges.attempts} + 1` })
      .where(
        and(
          eq(secondFactorChallenges.id, challenge.id),
          isNull(secondFactorChallenges.consumedAt),
        ),
      );
    return false;
  }

  return db
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
      if (!consumed) throw new Error("The challenge was already consumed");

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
      if (!verifiedSession)
        throw new Error("The authentication session expired");

      await tx.insert(auditEvents).values({
        actorUserId: userId,
        action: "auth.second_factor.verified",
        subjectType: "auth.session",
      });

      return true;
    })
    .catch(() => false);
}
