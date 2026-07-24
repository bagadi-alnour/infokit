import type { PublicLocale } from "@calais/shared/i18n";

import { siteConfig } from "~/seo/site";

export function WebsiteJsonLd({
  locale,
  description,
  url,
}: {
  locale: PublicLocale;
  description: string;
  url: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    description,
    url,
    inLanguage: locale,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replaceAll("<", "\\u003c"),
      }}
    />
  );
}
