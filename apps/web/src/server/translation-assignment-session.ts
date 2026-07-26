import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { env } from "~/env";

export const translationAssignmentCookie = "infokit_translation_assignment";

function signature(payload: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(payload)
    .digest("base64url");
}

export function createTranslationAssignmentSessionValue(
  assignmentId: string,
  expiresAt: Date,
): string {
  const payload = `${assignmentId}.${String(expiresAt.getTime())}`;
  return `${payload}.${signature(payload)}`;
}

export async function readTranslationAssignmentSession(): Promise<
  string | null
> {
  const value = (await cookies()).get(translationAssignmentCookie)?.value;
  if (!value) return null;
  const [assignmentId, expiresRaw, receivedSignature] = value.split(".");
  if (!assignmentId || !expiresRaw || !receivedSignature) return null;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  const payload = `${assignmentId}.${expiresRaw}`;
  const expected = Buffer.from(signature(payload));
  const received = Buffer.from(receivedSignature);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return null;
  }
  return assignmentId;
}
