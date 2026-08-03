import "~/styles/globals.css";

import { brandName, localeMetadata } from "@infokit/shared/i18n";
import { type Metadata } from "next";
import { Noto_Sans_Arabic, Public_Sans, Work_Sans } from "next/font/google";

import { DesignTokenStyles } from "~/components/design-tokens";
import { ThemeProvider } from "~/components/theme/theme-provider";
import { DirectionProvider } from "~/components/ui/direction";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { localeStaticParams } from "~/i18n/routing";
import { siteConfig } from "~/seo/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = requirePublicRouteLocale((await params).locale);
  const name = brandName(locale);

  return {
    metadataBase: siteConfig.url,
    title: {
      default: name,
      template: `%s · ${name}`,
    },
    description: siteConfig.description,
    applicationName: name,
    authors: [{ name }],
    creator: name,
    publisher: name,
    category: "public information",
    openGraph: {
      type: "website",
      siteName: name,
      title: name,
      description: siteConfig.description,
    },
    twitter: {
      card: "summary",
      title: name,
      description: siteConfig.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    formatDetection: {
      address: false,
      email: false,
      telephone: false,
    },
    icons: [{ rel: "icon", url: "/favicon.ico" }],
  };
}

/** docs/DESIGN-SYSTEM.md §4: Work Sans headings, Public Sans body, Noto Sans
 *  Arabic for the Arabic-script locales. Declared for every locale, so a reader
 *  switching language never meets a page with no face for its script. */
/**
 * Both Latin families ask for the base subset only. Preloading ignores
 * `unicode-range`, so naming `latin-ext` as well fetched a further 53 kB on
 * every page for letters none of the eleven languages spell a word with — the
 * accents French needs, `œ` and `Œ` included, are all inside the base range. An
 * extended letter that does turn up in a borrowed name draws from the system
 * face for that glyph, which is a different shape rather than a missing one.
 * `next/font` reads these arguments at build time, so each must stay a literal.
 *
 * Neither is preloaded. A preload puts the two files, 78 kB together, in front
 * of the paint, where on a slow connection they compete with the markup and the
 * stylesheet the first paint actually needs. `display: swap` plus the
 * metric-adjusted fallback `next/font` generates means the text is readable
 * immediately and the swap moves nothing (layout shift stays at zero and the
 * swapped text never becomes a later Largest Contentful Paint), so the preload
 * was delaying the paint it was meant to protect.
 */
const headingFont = Work_Sans({
  subsets: ["latin"],
  // One variable file serves both, so asking for the lighter weight the console
  // headings use costs nothing beyond the file the public pages already fetch.
  weight: ["600", "700"],
  display: "swap",
  preload: false,
  variable: "--font-work-sans",
});

const bodyFont = Public_Sans({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-public-sans",
});

/**
 * Declared for every locale but never preloaded. The Arabic face is 166 kB —
 * more than the Latin faces put together — and six of the eleven locales render
 * no character it covers. Preloading fetched it on every one of them, and its
 * late arrival re-painted the text and became the page's Largest Contentful
 * Paint. Without the preload the `unicode-range` on each `@font-face` does the
 * choosing: the file is requested only by a page that actually renders Arabic
 * script, one round trip later, and `swap` means that page shows its text
 * immediately in the fallback either way.
 */
const arabicFont = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
  variable: "--font-noto-arabic",
});

const fontVariables = [
  headingFont.variable,
  bodyFont.variable,
  arabicFont.variable,
].join(" ");

export const dynamicParams = false;
export const generateStaticParams = localeStaticParams;

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const locale = requirePublicRouteLocale((await params).locale);
  return (
    <html
      lang={locale}
      dir={localeMetadata[locale].direction}
      className={fontVariables}
      suppressHydrationWarning
    >
      <head>
        <DesignTokenStyles />
      </head>
      <body className="bg-canvas text-ink font-sans antialiased">
        {/* Popups (dropdowns, menus) anchor to the logical start of their
         * trigger; without this the library assumes left-to-right and an
         * Arabic menu would hang off the wrong edge. */}
        <DirectionProvider direction={localeMetadata[locale].direction}>
          <ThemeProvider>{children}</ThemeProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}
