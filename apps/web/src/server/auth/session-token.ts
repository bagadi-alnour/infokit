import { createHash } from "node:crypto";
import { cookies } from "next/headers";

const sessionCookieNames = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
] as const;

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function currentSessionTokenHash(): Promise<string | null> {
  const cookieStore = await cookies();
  for (const name of sessionCookieNames) {
    const token = cookieStore.get(name)?.value;
    if (token) return hashSessionToken(token);
  }
  return null;
}
