"use server";

import { redirect } from "next/navigation";

import { isLocale, type Locale } from "@infokit/shared/i18n";
import { localizedPath } from "~/i18n/routing";
import { auth } from "~/server/auth";
import { acceptInvitationForUser } from "~/server/auth/link-memberships";
import { describeInvitationToken } from "~/server/invitations";

function formLocale(value: FormDataEntryValue | null): Locale {
  return typeof value === "string" && isLocale(value) ? value : "fr";
}

/**
 * Accept the invitation this page is showing, for the account already signed
 * in. The token is re-read here rather than trusted from the form: the action
 * has to answer "which invitation" from the same evidence the page did, and a
 * form field naming an invitation id would be a field worth tampering with.
 *
 * Every failure lands back on the page, which re-reads the invitation and says
 * what happened — a revoked or expired link has its own wording, and neither is
 * an error the person can do anything about by retrying.
 */
export async function acceptInvitation(formData: FormData) {
  const locale = formLocale(formData.get("locale"));
  const token = formData.get("token");
  // A submit with no token is a broken form, not an invitation: there is no
  // page to send them back to, so they go where an unauthenticated visitor to
  // this app always goes.
  if (typeof token !== "string" || !token)
    redirect(localizedPath("/login", locale));

  const session = await auth();
  const invitation = await describeInvitationToken(token);
  const back = localizedPath(`/invite/${token}`, locale);

  // Not signed in, no longer open, or signed in as somebody else: the page
  // renders each of those states on its own, so there is nothing to do here
  // but show it again.
  const signedIn = session?.user;
  if (!signedIn || invitation?.state !== "open") redirect(back);
  if (
    signedIn.email.trim().toLowerCase() !==
    invitation.email.trim().toLowerCase()
  ) {
    redirect(back);
  }

  const result = await acceptInvitationForUser({
    invitationId: invitation.id,
    userId: signedIn.id,
    email: signedIn.email,
  });
  redirect(result.ok ? back : `${back}?status=${result.reason}`);
}
