import type { MetadataRoute } from "next";
import { supportedLocales } from "@infokit/shared/i18n";

import { absoluteUrl, siteConfig } from "~/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        ...supportedLocales.flatMap((locale) => [
          `/${locale}/dashboard`,
          `/${locale}/dashboard/`,
          `/${locale}/login`,
          `/${locale}/login/`,
        ]),
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteConfig.url.origin,
  };
}
