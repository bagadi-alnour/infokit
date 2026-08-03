import "~/styles/globals.css";

import {
  isPublicLocale,
  localeMetadata,
  type PublicLocale,
} from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";
import { headers } from "next/headers";

import { DesignTokenStyles } from "~/components/design-tokens";
import { PublicNotFoundPage } from "~/components/public/not-found-page";
import { PublicSiteShell } from "~/components/public/public-site-shell";
import { ThemeProvider } from "~/components/theme/theme-provider";
import { DirectionProvider } from "~/components/ui/direction";
import { PUBLIC_LOCALE_HEADER } from "~/i18n/request-header";

async function requestedLocale(): Promise<PublicLocale> {
  const candidate = (await headers()).get(PUBLIC_LOCALE_HEADER);
  return isPublicLocale(candidate) ? candidate : "fr";
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestedLocale();
  const messages = await loadPageCatalog(locale, "public-content");

  return {
    title: messages["notFound.title"],
    description: messages["notFound.description"],
  };
}

export default async function GlobalNotFound() {
  const locale = await requestedLocale();
  const messages = await loadPageCatalog(locale, "public-content");
  const direction = localeMetadata[locale].direction;

  return (
    <html lang={locale} dir={direction} suppressHydrationWarning>
      <head>
        <DesignTokenStyles />
      </head>
      <body
        className="bg-canvas text-ink font-sans antialiased"
        style={{
          fontFamily:
            'Inter, "Helvetica Neue", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <DirectionProvider direction={direction}>
          <ThemeProvider>
            <PublicSiteShell
              locale={locale}
              currentPath="/404"
              messages={messages}
            >
              <PublicNotFoundPage locale={locale} messages={messages} />
            </PublicSiteShell>
          </ThemeProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}
