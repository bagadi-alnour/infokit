import {
  isPublicLocale,
  publicSupportedLocales,
  supportedLocales,
  type Locale,
  type PublicLocale,
} from "@calais/shared/i18n";

export type AuthRoute = "login" | "check" | "error" | "verify";

const authRouteBase: Record<AuthRoute, string> = {
  login: "/login",
  check: "/login/check",
  error: "/login/error",
  verify: "/login/verify",
};

type QueryValue = string | number | boolean | null | undefined;

export function localizedPath(
  pathname: string,
  locale: PublicLocale,
  query: Readonly<Record<string, QueryValue>> = {},
): string {
  const normalizedPath =
    pathname === "/" ? "" : `/${pathname.replace(/^\/+|\/+$/g, "")}`;
  const path = `/${locale}${normalizedPath}`;
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const serialized = search.toString();
  return serialized ? `${path}?${serialized}` : path;
}

/** Removes the leading route locale so the same page can be relocalized. */
export function unlocalizedPath(pathname: string): string {
  const segments = pathname.split("/");
  if (isPublicLocale(segments[1])) segments.splice(1, 1);
  const path = segments.join("/");
  return path === "" ? "/" : path;
}

export function authPath(
  route: AuthRoute,
  locale: Locale,
  query?: Readonly<Record<string, QueryValue>>,
): string {
  return localizedPath(authRouteBase[route], locale, query);
}

export function authLanguageAlternates(
  route: AuthRoute,
): Record<Locale | "x-default", string> {
  return {
    ...Object.fromEntries(
      supportedLocales.map((locale) => [locale, authPath(route, locale)]),
    ),
    "x-default": authPath(route, "fr"),
  } as Record<Locale | "x-default", string>;
}

export function localeStaticParams(): Array<{ locale: PublicLocale }> {
  return publicSupportedLocales.map((locale) => ({ locale }));
}

export function languageAlternates(
  pathname: string,
): Record<PublicLocale | "x-default", string> {
  return {
    ...Object.fromEntries(
      publicSupportedLocales.map((locale) => [
        locale,
        localizedPath(pathname, locale),
      ]),
    ),
    "x-default": localizedPath(pathname, "fr"),
  } as Record<PublicLocale | "x-default", string>;
}
