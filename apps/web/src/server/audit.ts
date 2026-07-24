import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { auditEvents } from "~/server/db/schema";

/**
 * Append-only audit trail (NFR-006): every console mutation records who
 * did what to which record. Metadata is allowlisted, small, and never
 * contains sensitive values (AGENTS.md). Failures are swallowed — the
 * user's action must not fail because the log did.
 */
export async function recordAudit(input: {
  action: string;
  subjectType: string;
  subjectId?: string;
  organizationId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  reason?: string;
}) {
  try {
    const session = await auth();
    await db.insert(auditEvents).values({
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      organizationId: input.organizationId ?? null,
      actorUserId: session?.user.id ?? null,
      actorType: "user",
      metadata: input.metadata,
      reason: input.reason,
    });
  } catch (error) {
    console.error("audit write failed", error);
  }
}
