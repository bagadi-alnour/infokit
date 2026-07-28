import type { Locale } from "@infokit/shared/i18n";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getActionLocale } from "~/i18n/request-locale";
import { authPath } from "~/i18n/routing";
import { secondFactorRequired } from "~/server/account/settings";
import { auth } from "~/server/auth";
import { getRoleTestState } from "~/server/auth/authorization";
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
  // The step-up is on for every account by default and cannot be turned off
  // by a platform administrator; `secondFactorRequired` re-reads that on the
  // server, so the stored preference is a policy input, never a bypass.
  if (
    !session.secondFactorVerified &&
    (await secondFactorRequired(session.user.id))
  ) {
    const returnTo = await requestedReturnTo(locale);
    redirect(authPath("verify", locale, { returnTo }));
  }
  return session.user;
}

/**
 * Permission gate for new protected reads and mutations. During superadmin
 * testing it evaluates only the selected roles' combined grants, never
 * support access.
 */
export async function requirePermission(
  permissionCode: string,
  candidateLocale?: Locale,
  organizationId?: string,
) {
  const user = await requireEditor(candidateLocale);
  const authorization = await getRoleTestState(user.id, organizationId);
  const assumedOrganizationId = authorization.assumedOrganizationId;
  const wrongTestOrganization =
    assumedOrganizationId !== null && assumedOrganizationId !== organizationId;
  if (
    wrongTestOrganization ||
    !authorization.effectivePermissions.has(permissionCode)
  ) {
    throw new Error("Forbidden");
  }
  return user;
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
  const authorization = await getRoleTestState(session.user.id, organizationId);
  const assumedOrganizationId = authorization.assumedOrganizationId;
  if (
    assumedOrganizationId !== null &&
    assumedOrganizationId !== organizationId
  ) {
    return false;
  }
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
    return action(formData, locale, user);
  };
}

/**
 * Existing editor mutations are migrating to full organisation RBAC. While
 * that proceeds, this wrapper makes superadmin role tests authoritative: the
 * selected roles' combined grants must include the mutation permission, and
 * support access cannot bypass it.
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
    const authorization = await getRoleTestState(user.id);
    if (
      authorization.isSuperadmin &&
      !authorization.effectivePermissions.has(permissionCode)
    ) {
      redirect(await permissionDeniedPath(locale));
    }
    return action(formData, locale, user);
  };
}
