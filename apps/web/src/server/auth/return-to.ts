import { isLocale, type Locale } from "@infokit/shared/i18n";

import { localizedPath } from "~/i18n/routing";

export function safeReturnTo(value: unknown, locale: Locale): string {
  const fallback = localizedPath("/dashboard", locale);
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return fallback;
  }

  const parsed = new URL(value, "https://infokit.invalid");
  if (parsed.origin !== "https://infokit.invalid") return fallback;

  const segments = parsed.pathname.split("/").filter(Boolean);
  const pathSegments = isLocale(segments[0]) ? segments.slice(1) : segments;
  /**
   * The console, the phone app's hand-off page, and an invitation link.
   *
   * `/login/device` is a non-dashboard destination worth allowing: a
   * magic-link sign-in from the app lands there to be turned into a token, and
   * if the account owes a second factor the verify page has to be able to send
   * the reader *back* to it.
   *
   * `/invite/<token>` is the other: somebody who follows an invitation without
   * a session signs in *from* that page and has to come back to it to be told
   * the invitation was accepted and where it leads. Returning them to the
   * console instead would leave the link they were sent looking unanswered.
   * All three are first-party paths on this origin, so none widens the
   * open-redirect surface this function exists to close.
   */
  const isConsole = pathSegments[0] === "dashboard";
  const isDeviceHandoff =
    pathSegments[0] === "login" && pathSegments[1] === "device";
  const isInvitation =
    pathSegments[0] === "invite" && pathSegments.length === 2;
  if (!isConsole && !isDeviceHandoff && !isInvitation) return fallback;

  return `${localizedPath(`/${pathSegments.join("/")}`, locale)}${parsed.search}${parsed.hash}`;
}
