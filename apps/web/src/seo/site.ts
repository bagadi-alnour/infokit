import type { Metadata } from "next";

import { env } from "~/env";
import {
  authLanguageAlternates,
  authPath,
  type AuthRoute,
} from "~/i18n/routing";
import type { Locale } from "@calais/shared/i18n";

export const siteConfig = {
  name: "Calais Info",
  description:
    "Multilingual, verified information about services and practical help in Calais.",
  url: new URL(env.SITE_URL),
} as const;

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, siteConfig.url).toString();
}

export function localizedAuthMetadata({
  route,
  locale,
  title,
  description,
}: {
  route: AuthRoute;
  locale: Locale;
  title: string;
  description: string;
}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: authPath(route, locale),
      languages: authLanguageAlternates(route),
    },
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      nocache: true,
    },
  };
}
