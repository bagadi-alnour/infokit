import type { Metadata } from "next";

import { env } from "~/env";
import {
  authLanguageAlternates,
  authPath,
  type AuthRoute,
} from "~/i18n/routing";
import type { Locale, PublicLocale } from "@infokit/shared/i18n";

export const siteConfig = {
  name: "InfoKit",
  description:
    "Multilingual, verified information about services and practical help in Calais.",
  url: new URL(env.SITE_URL),
} as const;

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, siteConfig.url).toString();
}

/**
 * The generated share card drawn by `[locale]/opengraph-image.tsx`.
 *
 * `publicMetadata` names it outright instead of letting Next's file convention
 * supply it: the convention only fills `og:image` in for a segment that declares
 * no `openGraph` of its own, and every public page declares one. Described here
 * rather than imported from the image file so that stating the default costs no
 * page the `next/og` runtime.
 */
export const defaultShareCard = {
  /** Locale-less, so each locale points at the copy served under its own path. */
  path: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${siteConfig.name} — ${siteConfig.description}`,
} as const;

/**
 * Open Graph wants `language_TERRITORY`, not the bare route code. The
 * territory is the one the language is read in around Calais, which is why
 * English is `en_GB` and Dari is `fa_AF` rather than either default.
 */
const openGraphLocales: Record<PublicLocale, string> = {
  fr: "fr_FR",
  en: "en_GB",
  ar: "ar_AR",
  fa: "fa_IR",
  prs: "fa_AF",
  ps: "ps_AF",
  ckb: "ckb_IQ",
  ti: "ti_ER",
  am: "am_ET",
  om: "om_ET",
  so: "so_SO",
};

export function openGraphLocale(locale: PublicLocale): string {
  return openGraphLocales[locale];
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
