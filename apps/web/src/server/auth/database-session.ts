import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { db } from "~/server/db";
import { sessions } from "~/server/db/schema";
import { hashSessionToken } from "./session-token";

const sessionLifetimeSeconds = 8 * 60 * 60;

/** Creates the same revocable, server-side session used by magic-link auth. */
export async function createDatabaseSession(userId: string): Promise<void> {
  const rawToken = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + sessionLifetimeSeconds * 1000);
  await db.insert(sessions).values({
    sessionToken: hashSessionToken(rawToken),
    userId,
    expires,
  });

  const secure = process.env.NODE_ENV === "production";
  (await cookies()).set(
    secure ? "__Secure-authjs.session-token" : "authjs.session-token",
    rawToken,
    {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      expires,
    },
  );
}
