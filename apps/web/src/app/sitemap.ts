import type { MetadataRoute } from "next";
import { publicSupportedLocales } from "@infokit/shared/i18n";

import { languageAlternates, localizedPath } from "~/i18n/routing";
import { absoluteUrl } from "~/seo/site";
import { listPublicRoutes } from "~/server/content/public-routes";

/**
 * Every public page, in all eleven reading languages.
 *
 * What belongs here is decided in `public-routes.ts`, which reads the published
 * record and nothing else; this file only turns those entries into the XML
 * shape. Each page appears once per locale with the full set of alternates
 * attached, so a crawler that finds the Pashto URL learns the other ten exist
 * and treats them as one page rather than eleven near-duplicates. Auth and
 * console routes are absent by construction — they are never public routes.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = await listPublicRoutes();

  return routes.flatMap((route) => {
    const languages = Object.fromEntries(
      Object.entries(languageAlternates(route.paths.fr, route.paths)).map(
        ([locale, path]) => [locale, absoluteUrl(path)],
      ),
    );
    return publicSupportedLocales.map((locale) => ({
      url: absoluteUrl(localizedPath(route.paths[locale], locale)),
      lastModified: route.lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: { languages },
    }));
  });
}

/**
 * Rebuilt on the same cadence as the pages it lists: often enough that a new
 * activity is announced the day it is published, rarely enough that a crawler
 * hitting this route cannot turn it into a query storm.
 */
export const revalidate = 3600;
