import { isLocale, type Locale } from "@infokit/shared/i18n";
import NextAuth from "next-auth";
import { cache } from "react";

import { localeCookieName } from "~/i18n/constants";
import { createAuthConfig } from "./config";

function requestLocale(request?: Request): Locale {
  if (!request) return "fr";

  const callbackUrl = new URL(request.url).searchParams.get("callbackUrl");
  if (callbackUrl) {
    const segment = new URL(callbackUrl, request.url).pathname
      .split("/")
      .find((part) => part.length > 0);
    if (isLocale(segment)) return segment;
  }

  const cookieValue = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === localeCookieName)?.[1];
  const cookieLocale = cookieValue ? decodeURIComponent(cookieValue) : null;
  return isLocale(cookieLocale) ? cookieLocale : "fr";
}

const {
  auth: uncachedAuth,
  handlers,
  signIn,
  signOut,
} = NextAuth((request) => createAuthConfig(requestLocale(request)));

const auth = cache(uncachedAuth);

export { auth, handlers, signIn, signOut };
