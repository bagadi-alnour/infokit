import {
  createHmac,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import { and, count, eq, gte } from "drizzle-orm";

import { env } from "~/env";
import { recordAudit } from "~/server/audit";
import { db } from "~/server/db";
import { passwordSignInAttempts, users } from "~/server/db/schema";

const keyLength = 64;
const scryptCost = 32_768;
const scryptBlockSize = 8;
const scryptParallelization = 1;
const scryptMaxMemory = 64 * 1024 * 1024;
const attemptWindowMs = 15 * 60 * 1000;
const maximumFailedAttempts = 5;

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function identifierHash(email: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(normalizedEmail(email))
    .digest("hex");
}

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      keyLength,
      {
        N: scryptCost,
        r: scryptBlockSize,
        p: scryptParallelization,
        maxmem: scryptMaxMemory,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const digest = await derive(password, salt);
  return [
    "scrypt-v1",
    String(scryptCost),
    String(scryptBlockSize),
    String(scryptParallelization),
    salt.toString("base64url"),
    digest.toString("base64url"),
  ].join("$");
}

async function passwordMatches(
  password: string,
  storedHash: string | null,
): Promise<boolean> {
  const parts = storedHash?.split("$") ?? [];
  const validRecord =
    parts.length === 6 &&
    parts[0] === "scrypt-v1" &&
    parts[1] === String(scryptCost) &&
    parts[2] === String(scryptBlockSize) &&
    parts[3] === String(scryptParallelization);
  const salt = validRecord
    ? Buffer.from(parts[4] ?? "", "base64url")
    : Buffer.alloc(16);
  const expected = validRecord
    ? Buffer.from(parts[5] ?? "", "base64url")
    : Buffer.alloc(keyLength);
  const received = await derive(password, salt);
  return (
    validRecord &&
    expected.length === received.length &&
    timingSafeEqual(expected, received)
  );
}

export type PasswordAuthenticationResult =
  | {
      status: "authenticated";
      user: {
        id: string;
        email: string;
        name: string | null;
        image: string | null;
      };
    }
  | {
      status: "account_not_found" | "invalid_credentials";
      user:
        | {
            id: string;
            email: string;
            name: string | null;
            image: string | null;
          }
        | undefined;
    };

/**
 * Returns a specific outcome after a constant-work, rate-limited password
 * check. The caller may distinguish an unknown account in user-facing copy;
 * the password derivation still takes the same path for every address.
 */
export async function authenticatePassword(email: string, password: string) {
  const emailValue = normalizedEmail(email);
  const emailHash = identifierHash(emailValue);
  const since = new Date(Date.now() - attemptWindowMs);
  const [[user], [recentFailures]] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, emailValue))
      .limit(1),
    db
      .select({ value: count() })
      .from(passwordSignInAttempts)
      .where(
        and(
          eq(passwordSignInAttempts.identifierHash, emailHash),
          eq(passwordSignInAttempts.succeeded, false),
          gte(passwordSignInAttempts.attemptedAt, since),
        ),
      ),
  ]);

  const matches = await passwordMatches(password, user?.passwordHash ?? null);
  const allowed = (recentFailures?.value ?? 0) < maximumFailedAttempts;
  const succeeded = Boolean(user && matches && allowed);
  await db.insert(passwordSignInAttempts).values({
    identifierHash: emailHash,
    userId: user?.id,
    succeeded,
  });
  /**
   * A lockout is recorded here because this is the only place that can tell one
   * apart: the public result stays `invalid_credentials` rather than revealing
   * the lockout threshold. The address is not stored — its keyed hash is already
   * in the attempt ledger this row sits beside.
   */
  if (!allowed) {
    await recordAudit({
      action: "auth.password.locked_out",
      subjectType: "auth.session",
      subjectId: user?.id ?? null,
      actorUserId: user?.id ?? null,
      actorType: user ? "user" : "system",
      outcome: "denied",
      severity: "warning",
      errorCode: "too_many_attempts",
      metadata: {
        failures: recentFailures?.value ?? 0,
        windowMinutes: attemptWindowMs / 60_000,
      },
    });
  }
  const safeUser = user
    ? {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      }
    : undefined;
  if (succeeded && safeUser) {
    return {
      status: "authenticated",
      user: safeUser,
    } satisfies PasswordAuthenticationResult;
  }
  return {
    status: user ? "invalid_credentials" : "account_not_found",
    user: safeUser,
  } satisfies PasswordAuthenticationResult;
}
