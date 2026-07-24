import { NextResponse, type NextRequest } from "next/server";

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

  const hasSessionCookie =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token");
  const requestedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (!hasSessionCookie) {
    const locale = request.nextUrl.pathname.split("/")[1] ?? "fr";
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("returnTo", requestedPath);
    return NextResponse.redirect(loginUrl);
  }
  // Expose the attempted path so requireEditor can return the editor here
  // after the second-factor step (returnTo survives the 2FA hop).
  const headers = new Headers(request.headers);
  headers.set(REQUESTED_PATH_HEADER, requestedPath);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/", "/:locale/dashboard/:path*"],
};
