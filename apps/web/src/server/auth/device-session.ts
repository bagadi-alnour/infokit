import { createHmac, randomBytes, randomInt } from "node:crypto";
import { and, count, eq, gt, gte, isNull } from "drizzle-orm";

import { env } from "~/env";
import { recordAudit } from "~/server/audit";
import { db } from "~/server/db";
import { deviceGrants, sessions } from "~/server/db/schema";
import { hashSessionToken } from "./session-token";

/**
 * How the phone app holds a session.
 *
 * There is one sign-in on this platform — the web one, with its eligibility
 * check, its magic link and its SMS step-up. The app reimplements none of it: it
 * opens that page in the system browser, and the browser hands the finished
 * session over as a one-time grant (`auth.device_grants`). The app trades the
 * grant for a row in the same revocable `auth.sessions` table the site uses, so
 * signing a device out and signing a browser out are the same operation, and an
 * administrator revoking a session revokes the phone too.
 */

const grantLifetimeMs = 2 * 60 * 1000;
const grantsPerHour = 10;
/** The same eight hours the browser session gets — one policy, not two. */
const deviceSessionLifetimeMs = 8 * 60 * 60 * 1000;

/** Stored representation of the handed-over code — never the code itself. */
function codeHash(code: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(code).digest("hex");
}

/**
 * A grant code the browser can put in front of the reader. Digits in groups,
 * because on a phone this is sometimes read off one screen and typed into
 * another when the app link does not fire.
 */
function newCode(): string {
  const digits = Array.from({ length: 9 }, () => randomInt(0, 10)).join("");
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * The stored form of a typed code. Someone reading digits off one screen into
 * another types the groups, or not, or with spaces — all of that is the same
 * code, and only the digits are hashed.
 */
function normalizeCode(code: string): string | null {
  const digits = code.replace(/\D/g, "");
  if (digits.length !== 9) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export type IssueGrantResult =
  | { status: "issued"; code: string; expiresAt: Date }
  | { status: "rate_limited" };

/**
 * Mint a grant for a signed-in browser session. Called only from the hand-off
 * page, which has already passed the editor gate.
 */
export async function issueDeviceGrant({
  userId,
  secondFactorVerified,
}: {
  userId: string;
  secondFactorVerified: boolean;
}): Promise<IssueGrantResult> {
  const now = new Date();
  const [issued] = await db
    .select({ value: count() })
    .from(deviceGrants)
    .where(
      and(
        eq(deviceGrants.userId, userId),
        gte(deviceGrants.createdAt, new Date(now.getTime() - 60 * 60 * 1000)),
      ),
    );
  if ((issued?.value ?? 0) >= grantsPerHour) {
    await recordAudit({
      action: "auth.device_grant.rate_limited",
      subjectType: "auth.device_grant",
      subjectId: userId,
      actorUserId: userId,
      outcome: "denied",
      severity: "warning",
      errorCode: "hourly_grant_limit",
      metadata: { limit: grantsPerHour },
    });
    return { status: "rate_limited" };
  }

  const code = newCode();
  const expiresAt = new Date(now.getTime() + grantLifetimeMs);
  await db.insert(deviceGrants).values({
    userId,
    codeHash: codeHash(code),
    secondFactorVerified,
    expiresAt,
  });
  // The issue and the exchange are two events on purpose: a grant minted and
  // never traded is a code that went somewhere, and the code itself is never
  // written down — only that one was handed out, and whether it carries the
  // step-up the phone will inherit.
  await recordAudit({
    action: "auth.device_grant.issued",
    subjectType: "auth.device_grant",
    subjectId: userId,
    actorUserId: userId,
    metadata: { secondFactorVerified },
  });
  return { status: "issued", code, expiresAt };
}

export interface DeviceSession {
  token: string;
  expiresAt: Date;
}

/**
 * Trade a live grant for a device session. Consuming the grant and creating the
 * session happen in one transaction, so a replayed code cannot mint a second
 * session.
 */
export async function exchangeDeviceGrant(
  code: string,
): Promise<DeviceSession | null> {
  const normalized = normalizeCode(code);
  if (!normalized) {
    await recordAudit({
      action: "auth.device_session.exchange_failed",
      subjectType: "auth.device_grant",
      outcome: "denied",
      severity: "warning",
      errorCode: "malformed_code",
      actorType: "system",
    });
    return null;
  }
  const now = new Date();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + deviceSessionLifetimeMs);

  const session = await db.transaction(async (tx) => {
    const [grant] = await tx
      .update(deviceGrants)
      .set({ consumedAt: now })
      .where(
        and(
          eq(deviceGrants.codeHash, codeHash(normalized)),
          isNull(deviceGrants.consumedAt),
          gt(deviceGrants.expiresAt, now),
        ),
      )
      .returning({
        userId: deviceGrants.userId,
        secondFactorVerified: deviceGrants.secondFactorVerified,
      });
    if (!grant) return null;

    await tx.insert(sessions).values({
      sessionToken: hashSessionToken(token),
      userId: grant.userId,
      expires: expiresAt,
      // The step-up was passed in the browser; the device session inherits it
      // rather than asking for a second SMS on the same sign-in.
      secondFactorVerifiedAt: grant.secondFactorVerified ? now : null,
    });
    return { userId: grant.userId, token, expiresAt };
  });

  // Recorded outside the transaction, and both ways: a code that opened a
  // session is a sign-in, and a code that did not is somebody presenting one
  // that was already used, expired, or never issued.
  if (!session) {
    await recordAudit({
      action: "auth.device_session.exchange_failed",
      subjectType: "auth.device_grant",
      outcome: "denied",
      severity: "warning",
      errorCode: "code_unusable",
      actorType: "system",
    });
    return null;
  }
  await recordAudit({
    action: "auth.device_session.created",
    subjectType: "auth.session",
    subjectId: session.userId,
    actorUserId: session.userId,
  });
  return { token: session.token, expiresAt: session.expiresAt };
}

export interface DeviceViewer {
  userId: string;
  secondFactorVerified: boolean;
  expiresAt: Date;
  /** The presented token's hash, so a sign-out can delete exactly this row. */
  sessionTokenHash: string;
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value.trim() || null;
}

/**
 * Who is calling a member endpoint from a device, or null. Nothing here reads
 * cookies: a browser call is a different code path, and mixing the two is how
 * a cross-site request ends up authenticated.
 */
export async function deviceViewer(
  request: Request,
): Promise<DeviceViewer | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const [row] = await db
    .select({
      userId: sessions.userId,
      expires: sessions.expires,
      secondFactorVerifiedAt: sessions.secondFactorVerifiedAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.sessionToken, tokenHash),
        gt(sessions.expires, new Date()),
      ),
    )
    .limit(1);
  /**
   * A token was presented and it opens nothing — revoked, expired, or never
   * ours. The member endpoints answer all three with the same silent 401, which
   * is right for the caller and useless for a review, so the attempt is recorded
   * here: this is the only place that knows a credential was offered at all. A
   * request with no `Authorization` header returns above without a row, because
   * an unauthenticated call to a members-only URL is a crawler.
   *
   * The token never appears, not even hashed against the session table it failed
   * to match — a stolen one is worth nothing here, and the trail is not the
   * place to store the thing that was being guessed.
   */
  if (!row) {
    await recordAudit({
      action: "auth.device_session.rejected",
      subjectType: "auth.session",
      actorType: "system",
      outcome: "denied",
      severity: "warning",
      errorCode: "session_unknown_or_expired",
    });
    return null;
  }
  return {
    userId: row.userId,
    secondFactorVerified: Boolean(row.secondFactorVerifiedAt),
    expiresAt: row.expires,
    sessionTokenHash: tokenHash,
  };
}

/** Signing out on the phone removes the session, not just the stored token. */
export async function revokeDeviceSession(viewer: DeviceViewer): Promise<void> {
  await db
    .delete(sessions)
    .where(eq(sessions.sessionToken, viewer.sessionTokenHash));
  await recordAudit({
    action: "auth.device_session.signed_out",
    subjectType: "auth.session",
    subjectId: viewer.userId,
    actorUserId: viewer.userId,
  });
}
