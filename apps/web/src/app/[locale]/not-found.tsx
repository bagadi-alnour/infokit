import { isPublicLocale } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { headers } from "next/headers";

import { PublicNotFoundPage } from "~/components/public/not-found-page";
import { PublicSiteShell } from "~/components/public/public-site-shell";
import { PUBLIC_LOCALE_HEADER } from "~/i18n/request-header";

export default async function NotFound() {
  const requestedLocale = (await headers()).get(PUBLIC_LOCALE_HEADER);
  const locale = isPublicLocale(requestedLocale) ? requestedLocale : "fr";
  const messages = await loadPageCatalog(locale, "public-content");

  return (
    <PublicSiteShell locale={locale} currentPath="/404" messages={messages}>
      <PublicNotFoundPage locale={locale} messages={messages} />
    </PublicSiteShell>
  );
}
