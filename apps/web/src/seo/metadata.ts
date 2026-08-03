import type { Metadata } from "next";
import {
  brandName,
  publicSupportedLocales,
  type PublicLocale,
} from "@infokit/shared/i18n";

import { languageAlternates, localizedPath } from "~/i18n/routing";
import { defaultShareCard, openGraphLocale, siteConfig } from "~/seo/site";

/**
 * A page's own share image. Public content stores covers as app-relative
 * paths (`/api/public/assets/…`); `metadataBase` in the locale layout turns
 * them absolute, so callers pass what the read model gave them unchanged.
 */
export interface PublicMetadataImage {
  url: string;
  alt: string;
}

export interface PublicMetadataInput {
  /**
   * The route without its locale segment — `/activities`, `/articles/a-slug`.
   * Both the canonical URL and the eleven hreflang alternates are derived from
   * it, so a page names its path once and cannot describe itself twice.
   */
  path: string;
  /**
   * The translated path per locale, for content whose slug is generated from
   * its own title in each language. Given these, the canonical becomes this
   * locale's own path rather than the one the reader happened to arrive on, so
   * the same article reached through two of its slugs points at one URL.
   */
  localizedPaths?: Partial<Record<PublicLocale, string>>;
  locale: PublicLocale;
  title: string;
  description: string;
  /**
   * Replaces `%s · InfoKit` with the title exactly as given. Only the home
   * page wants this: everywhere else the suffix is what tells a reader in a
   * tab strip or a result list which site they are looking at.
   */
  absoluteTitle?: boolean;
  /**
   * The published cover, when the content has one. Left out, the generated card
   * from `[locale]/opengraph-image.tsx` stands in, so no shared link is ever a
   * bare URL.
   */
  image?: PublicMetadataImage | null;
  /** `article` for a dated, authored read; `website` for everything else. */
  type?: "website" | "article";
  /** ISO instants for a dated read, surfaced as article:published_time. */
  publishedTime?: string;
  modifiedTime?: string;
  /** Factual owners of the content, not the platform. */
  authors?: string[];
  /**
   * Kept out of the index: preview and draft surfaces reachable by link but
   * never a search result. Their alternates are dropped too, because a page
   * that must not be indexed must not nominate itself as anyone's canonical.
   */
  noIndex?: boolean;
}

/**
 * Search results cut a description off near this length. Writing longer is not
 * an error, but the tail is never read, so it is trimmed at a word rather than
 * handed over to be truncated mid-word by someone else.
 */
const DESCRIPTION_LIMIT = 160;

/**
 * The description for a page built from published content.
 *
 * Candidates are tried in order — an editor's own summary first, then the
 * page's catalogue description as the localized last resort — because a
 * published record may carry no summary while still needing to be findable.
 * Body text is accepted as a candidate too, which is why this collapses
 * whitespace and trims to a word boundary.
 */
export function metaDescription(
  ...candidates: Array<string | null | undefined>
): string {
  const text = candidates
    .map((candidate) => candidate?.replace(/\s+/g, " ").trim())
    .find((candidate) => Boolean(candidate));
  if (!text) return siteConfig.description;
  if (text.length <= DESCRIPTION_LIMIT) return text;

  const clipped = text.slice(0, DESCRIPTION_LIMIT);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).replace(/[,;:.…]+$/, "")}…`;
}

/**
 * The single metadata builder for every public page.
 *
 * Titles and descriptions arrive already localized — from the catalogue for a
 * fixed page, from the server presenter for published content — matching the
 * rule that a surface renders strings rather than choosing translations
 * (docs/UI-ARCHITECTURE.md §1). What this owns is the shape a crawler reads:
 * one canonical, eleven alternates, and Open Graph and Twitter cards that say
 * the same thing as the page.
 */
export function publicMetadata({
  path,
  localizedPaths,
  locale,
  title,
  description,
  absoluteTitle = false,
  image,
  type = "website",
  publishedTime,
  modifiedTime,
  authors,
  noIndex = false,
}: PublicMetadataInput): Metadata {
  const heading = absoluteTitle ? { absolute: title } : title;

  if (noIndex) {
    return {
      title: heading,
      description,
      robots: { index: false, follow: false, nocache: true },
    };
  }

  const canonical = localizedPath(localizedPaths?.[locale] ?? path, locale);
  // A published cover when there is one, the generated card otherwise: an
  // unillustrated page still arrives in a chat as a card rather than a bare URL,
  // which is often all someone sees before deciding to open it.
  const images = image
    ? [{ url: image.url, alt: image.alt }]
    : [
        {
          url: localizedPath(defaultShareCard.path, locale),
          width: defaultShareCard.width,
          height: defaultShareCard.height,
          alt: defaultShareCard.alt,
        },
      ];

  return {
    title: heading,
    description,
    alternates: {
      canonical,
      languages: languageAlternates(path, localizedPaths),
    },
    openGraph: {
      type,
      siteName: brandName(locale),
      title,
      description,
      url: canonical,
      locale: openGraphLocale(locale),
      alternateLocale: publicSupportedLocales
        .filter((other) => other !== locale)
        .map(openGraphLocale),
      images,
      ...(type === "article"
        ? { publishedTime, modifiedTime, authors }
        : undefined),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}
