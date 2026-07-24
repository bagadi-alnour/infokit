import type { Locale } from "@calais/shared/i18n";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getActionLocale } from "~/i18n/request-locale";
import { authPath } from "~/i18n/routing";
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
  if (!session.secondFactorVerified) {
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

export function protectedEditorAction<Result>(
  action: (formData: FormData, locale: Locale) => Promise<Result>,
): (formData: FormData) => Promise<Result> {
  return async (formData) => {
    const locale = await getActionLocale(formData.get("locale"));
    await requireEditor(locale);
    return action(formData, locale);
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
  action: (formData: FormData, locale: Locale) => Promise<Result>,
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
    return action(formData, locale);
  };
}
