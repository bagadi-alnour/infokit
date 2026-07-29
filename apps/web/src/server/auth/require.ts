import type { Locale } from "@infokit/shared/i18n";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getActionLocale } from "~/i18n/request-locale";
import { authPath } from "~/i18n/routing";
import { secondFactorRequired } from "~/server/account/settings";
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
 * Server-side auth gate — call it at the top of every protected layout and
 * server action (defense in depth, RISKS.md R10).
 */
export async function requireEditor(candidateLocale?: Locale) {
  const locale = await getActionLocale(candidateLocale);
  const session = await auth();
  if (!session?.user) redirect(authPath("login", locale));
  // The step-up is on by default, and a role can make it mandatory whatever
  // the account chose; `secondFactorRequired` re-reads both on the server, so
  // the stored preference is a policy input, never a bypass. An account whose
  // role mandates it and that has no number yet is sent to the same page to
  // enrol one.
  if (
    !session.secondFactorVerified &&
    (await secondFactorRequired(session.user.id))
  ) {
    const returnTo = await requestedReturnTo(locale);
    redirect(authPath("verify", locale, { returnTo }));
  }
  return session.user;
}

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
