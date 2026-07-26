import type { MetadataRoute } from "next";
import { supportedLocales } from "@infokit/shared/i18n";

import { languageAlternates, localizedPath } from "~/i18n/routing";
import { absoluteUrl } from "~/seo/site";

/**
 * Only public, indexable read surfaces belong here. Auth and dashboard routes
 * are deliberately excluded; future content pages should be sourced from the
 * verified public read model and add their localized alternates here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    Object.entries(languageAlternates("/")).map(([locale, path]) => [
      locale,
      absoluteUrl(path),
    ]),
  );

  return supportedLocales.map((locale) => ({
    url: absoluteUrl(localizedPath("/", locale)),
    changeFrequency: "weekly",
    priority: 1,
    alternates: { languages },
  }));
}
