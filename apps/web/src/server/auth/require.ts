import type { Locale } from "@infokit/shared/i18n";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getActionLocale } from "~/i18n/request-locale";
import { authPath } from "~/i18n/routing";
import { secondFactorMandatory } from "~/server/account/settings";
import { recordAccessDenied, withFailureAudit } from "~/server/audit";
import { auth } from "~/server/auth";
import { authorizationFor } from "~/server/auth/authorization";
import { safeReturnTo } from "~/server/auth/return-to";
import { REQUESTED_PATH_HEADER } from "~/lib/requested-path";

const permissionDeniedNotice = "permission-denied";

/**
 * The path the visitor was trying to reach, surfaced by the middleware, so
 * gate redirects can send them back there after signing in / confirming SMS.
 */
async function requestedReturnTo(locale: Locale): Promise<string> {
  const requestedPath = (await headers()).get(REQUESTED_PATH_HEADER);
  return safeReturnTo(requestedPath, locale);
}

async function permissionDeniedPath(locale: Locale) {
  const fallback = `/${locale}/dashboard?notice=${permissionDeniedNotice}`;
  const referer = (await headers()).get("referer");
  if (!referer) return fallback;
  try {
    const url = new URL(referer);
    const dashboardRoot = `/${locale}/dashboard`;
    if (
      url.pathname !== dashboardRoot &&
      !url.pathname.startsWith(`${dashboardRoot}/`)
    ) {
      return fallback;
    }
    url.searchParams.set("notice", permissionDeniedNotice);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * A signed-in account, with no view on the second factor.
 *
 * This is the gate for the pages that *arm* the factor. `requireEditor` below
 * sends an account whose role mandates a factor it has not armed to the security
 * page — so that page, and the actions it submits to, cannot use the same gate
 * without redirecting to themselves forever.
 *
 * Nothing else should reach for this: it is a weaker check, and the reason it is
 * safe here is that the only thing it protects is the enrolment itself.
 */
async function uncachedRequireAccountHolder(candidateLocale?: Locale) {
  const locale = await getActionLocale(candidateLocale);
  const session = await auth();
  if (!session?.user) redirect(authPath("login", locale));
  return session.user;
}

export const requireAccountHolder = cache(uncachedRequireAccountHolder);

/**
 * Server-side auth gate — call it at the top of every protected layout and
 * server action (defense in depth, RISKS.md R10).
 */
async function uncachedRequireEditor(candidateLocale?: Locale) {
  const locale = await getActionLocale(candidateLocale);
  const session = await auth();
  if (!session?.user) redirect(authPath("login", locale));
  /**
   * The second-factor gate, and it is a *session* check rather than an account
   * one on purpose.
   *
   * Better Auth applies the factor by interrupting sign-in, but it only
   * interrupts `/sign-in/email`, `/sign-in/username` and `/sign-in/phone-number`.
   * A magic link is none of those, so an account with a factor armed can arrive
   * here holding a complete session that was never asked for a code. Trusting
   * `user.twoFactorEnabled` would wave exactly that session through.
   *
   * So two different refusals, told apart by whether there is a factor to use:
   *
   * - Armed, but this session has not passed it → step up, and ask for a code.
   * - Not armed, while a role demands one → enrol, because there is no code to
   *   ask for yet.
   */
  if (!session.secondFactorVerified) {
    const mustHoldFactor =
      session.user.twoFactorEnabled ||
      (await secondFactorMandatory(session.user.id));
    if (mustHoldFactor) {
      const returnTo = await requestedReturnTo(locale);
      /**
       * Both destinations are `/login/verify`, and that is the whole point: it
       * sits outside `/dashboard`, where every layout runs this same gate. An
       * enrolment page inside the console would be behind the gate it exists to
       * escape, and the redirect would chase its own tail — appending `returnTo`
       * to itself on every hop.
       */
      redirect(
        authPath("verify", locale, {
          returnTo,
          enrol: session.user.twoFactorEnabled ? undefined : "required",
        }),
      );
    }
  }
  return session.user;
}

/**
 * A protected route can have several nested layouts, each of which must keep
 * its own gate for defence in depth. React's request cache lets those gates
 * share the same decision during one render instead of repeating the account
 * policy queries as the user moves between nested sections.
 */
export const requireEditor = cache(uncachedRequireEditor);

/** Permission gate for protected reads and mutations. */
export async function requirePermission(
  permissionCode: string,
  candidateLocale?: Locale,
  organizationId?: string,
) {
  const user = await requireEditor(candidateLocale);
  const authorization = await authorizationFor(user.id, organizationId);
  if (!authorization.effectivePermissions.has(permissionCode)) {
    // Recorded before the throw, and awaited: this is the row a security review
    // opens with, so it is worth the round trip that the caller's error is
    // already paying for. `recordAudit` swallows its own failures, so the
    // refusal itself cannot be turned into a different error by the log.
    await recordAccessDenied({
      permissionCode,
      organizationId: organizationId ?? null,
      metadata: { organizationId: organizationId ?? null },
    });
    throw new Error("Forbidden");
  }
  return user;
}

/**
 * Refuse a page whose gate is more than one permission lookup, and say so in
 * the trail. The audit trail is the first of these: what a reader may see there
 * depends on platform grants *and* on organisation memberships, so the decision
 * belongs to the module that knows both, while the refusal — the row, and the
 * notice on the page the reader came from — should read exactly like every
 * other one. Never returns: `redirect()` throws.
 */
export async function denyPageAccess(
  permissionCode: string,
  candidateLocale?: Locale,
  reason?: string,
): Promise<never> {
  const locale = await getActionLocale(candidateLocale);
  await recordAccessDenied({ permissionCode, reason: reason ?? null });
  redirect(await permissionDeniedPath(locale));
}

/**
 * Read-side counterpart to `requirePermission`, for deciding whether to render
 * a control at all. It never redirects: a missing grant simply hides the
 * button. The action behind the button still gates itself.
 */
export async function hasPermission(
  permissionCode: string,
  organizationId?: string,
): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  const authorization = await authorizationFor(session.user.id, organizationId);
  return authorization.effectivePermissions.has(permissionCode);
}

/**
 * The editor a protected action runs as. Handed to the action body so it never
 * has to ask a second time: an action that reached its body has already been
 * through `requireEditor`, and re-reading the session there both costs another
 * round trip and re-states the guarantee with a weaker check — a bare `throw`
 * skips the login redirect and the SMS step-up this gate applies.
 */
export type ActionUser = Awaited<ReturnType<typeof requireEditor>>;

/**
 * What an action was, for the trail, when it threw before it could say so
 * itself. The successful events are written by the action bodies, which know
 * *what* they changed; this is only ever the name on a failure, and the route in
 * the event says which page it was.
 */
const failedActionDescriptor = {
  action: "console.action.failed",
  subjectType: "console.action",
} as const;

export function protectedEditorAction<Result>(
  action: (
    formData: FormData,
    locale: Locale,
    user: ActionUser,
  ) => Promise<Result>,
): (formData: FormData) => Promise<Result> {
  return async (formData) => {
    const locale = await getActionLocale(formData.get("locale"));
    const user = await requireEditor(locale);
    return withFailureAudit(failedActionDescriptor, () =>
      action(formData, locale, user),
    );
  };
}

/**
 * The permission gate every wrapped mutation passes through, and it refuses by
 * default: a missing grant denies the actor, whoever they are.
 *
 * It reads **platform** grants only, because the wrapper cannot know which
 * organisation the mutation targets — that lives in the form body, shaped
 * differently by every action. So this is the outer limit, not the whole rule:
 *
 * - Platform staff act through the grants their platform roles carry.
 * - An organisation's own members hold their grants per organisation, so they do
 *   not pass here. An action they should be able to run has to resolve the
 *   organisation from the record it is about and call
 *   `requirePermission(code, locale, organizationId)` itself — binding the
 *   permission to the row rather than to a field the caller supplied.
 *
 * That second case is deliberately unbuilt rather than approximated. Trusting a
 * `organizationId` form field here would let a member of one association carry
 * their own grants into a mutation on another association's record; the check
 * belongs where the record's owner is known.
 */
export function protectedPermissionAction<Result>(
  permissionCode: string,
  action: (
    formData: FormData,
    locale: Locale,
    user: ActionUser,
  ) => Promise<Result>,
): (formData: FormData) => Promise<Result> {
  return async (formData) => {
    const locale = await getActionLocale(formData.get("locale"));
    const user = await requireEditor(locale);
    const authorization = await authorizationFor(user.id);
    if (!authorization.effectivePermissions.has(permissionCode)) {
      await recordAccessDenied({
        permissionCode,
        reason: "No platform grant carries this mutation",
      });
      redirect(await permissionDeniedPath(locale));
    }
    return withFailureAudit(
      { ...failedActionDescriptor, metadata: { permission: permissionCode } },
      () => action(formData, locale, user),
    );
  };
}
