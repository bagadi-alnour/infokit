import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate only: checks for the session cookie and redirects to the
 * locale's login page. Database sessions cannot be validated at the edge —
 * the real enforcement is requireEditor()/protectedEditorAction in layouts
 * and every server action (defense in depth, RISKS.md R10).
 */
export function middleware(request: NextRequest) {
  const hasSessionCookie =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token");
  if (!hasSessionCookie) {
    const locale = request.nextUrl.pathname.split("/")[1] ?? "fr";
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/:locale/dashboard/:path*"],
};
