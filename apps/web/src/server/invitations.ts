import { createHash, randomBytes } from "node:crypto";

import type { Locale } from "@calais/shared/i18n";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { env } from "~/env";
import { localizedPath } from "~/i18n/routing";
import { recordAudit } from "~/server/audit";
import { sendInvitationEmail } from "~/server/auth/aws";
import { db } from "~/server/db";
import { invitations } from "~/server/db/schema";

const INVITATION_TTL_DAYS = 14;

/**
 * Create — or refresh, when one is still pending — the invitation for an
 * email inside one organisation, then deliver it. Only the token hash is
 * stored (docs/DATABASE-SCHEMA.md §11); the raw token lives in the email
 * link alone. Acceptance happens on first sign-in with the invited address
 * (`linkPendingMemberships`), because a magic-link login already proves
 * ownership of that address.
 */
export async function sendMemberInvitation({
  organizationId,
  email,
  memberId,
  invitedById,
  locale,
  organizationName,
  teamName,
  inviterName,
}: {
  organizationId: string;
  email: string;
  memberId: string;
  invitedById: string | null;
  locale: Locale;
  organizationName: string;
  teamName: string;
  inviterName: string;
}) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(
    Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const [pending] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        sql`lower(${invitations.email}) = ${email.toLowerCase()}`,
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (pending) {
    await db
      .update(invitations)
      .set({ tokenHash, expiresAt, invitedById })
      .where(eq(invitations.id, pending.id));
  } else {
    await db.insert(invitations).values({
      organizationId,
      email,
      kind: "member",
      tokenHash,
      invitedById,
      expiresAt,
    });
  }

  const url = `${env.SITE_URL}${localizedPath("/login", locale)}?email=${encodeURIComponent(email)}&invite=${token}`;
  await sendInvitationEmail({
    email,
    url,
    locale,
    organizationName,
    teamName,
    inviterName,
    expiresAt,
  });
  await recordAudit({
    action: pending ? "member.invitation_resent" : "member.invited",
    subjectType: "member",
    subjectId: memberId,
    organizationId,
  });
}
