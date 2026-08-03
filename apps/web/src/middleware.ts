import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { isPublicLocale } from "@infokit/shared/i18n";
import { localeCookieName } from "~/i18n/constants";
import { PUBLIC_LOCALE_HEADER } from "~/i18n/request-header";
import { REQUESTED_PATH_HEADER } from "~/lib/requested-path";
import { preferredLocale } from "~/lib/preferred-locale";

/**
 * Optimistic gate only: checks for the session cookie and redirects to the
 * locale's login page. Database sessions cannot be validated at the edge —
 * the real enforcement is requireEditor()/protectedEditorAction in layouts
 * and every server action (defense in depth, RISKS.md R10).
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    const locale = preferredLocale(request.headers.get("accept-language"));
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  const routeLocale = request.nextUrl.pathname.split("/")[1];
  const cookieLocale = request.cookies.get(localeCookieName)?.value;
  const locale = isPublicLocale(routeLocale)
    ? routeLocale
    : isPublicLocale(cookieLocale)
      ? cookieLocale
      : preferredLocale(request.headers.get("accept-language"));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PUBLIC_LOCALE_HEADER, locale);

  const isDashboardRoute =
    isPublicLocale(routeLocale) &&
    (request.nextUrl.pathname === `/${routeLocale}/dashboard` ||
      request.nextUrl.pathname.startsWith(`/${routeLocale}/dashboard/`));
  if (!isDashboardRoute) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Better Auth's helper, so the `__Secure-` prefix and the configured cookie
  // prefix are its business rather than a string this file has to keep in step.
  const hasSessionCookie = getSessionCookie(request) !== null;
  const requestedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (!hasSessionCookie) {
    const locale = request.nextUrl.pathname.split("/")[1] ?? "fr";
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("returnTo", requestedPath);
    return NextResponse.redirect(loginUrl);
  }
  // Expose the attempted path so requireEditor can return the editor here
  // after the second-factor step (returnTo survives the 2FA hop).
  requestHeaders.set(REQUESTED_PATH_HEADER, requestedPath);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/",
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};
