import { isLocale, type Locale } from "@calais/shared/i18n";
import { cookies, headers } from "next/headers";

import { localeCookieName } from "~/i18n/constants";

/** Resolves locale for server actions; page rendering always uses route params. */
export async function getActionLocale(candidate?: unknown): Promise<Locale> {
  if (isLocale(candidate)) return candidate;

  const referer = (await headers()).get("referer");
  if (referer) {
    const segment = new URL(referer).pathname
      .split("/")
      .find((part) => part.length > 0);
    if (isLocale(segment)) return segment;
  }

  const cookieLocale = (await cookies()).get(localeCookieName)?.value;
  return isLocale(cookieLocale) ? cookieLocale : "fr";
}
