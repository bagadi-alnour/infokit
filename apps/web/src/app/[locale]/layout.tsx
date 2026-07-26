import "~/styles/globals.css";
import "leaflet/dist/leaflet.css";

import { localeMetadata } from "@infokit/shared/i18n";
import { type Metadata } from "next";
import { Noto_Sans_Arabic, Public_Sans, Work_Sans } from "next/font/google";

import { DesignTokenStyles } from "~/components/design-tokens";
import { ThemeProvider } from "~/components/theme/theme-provider";
import { DirectionProvider } from "~/components/ui/direction";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { localeStaticParams } from "~/i18n/routing";
import { siteConfig } from "~/seo/site";

export const metadata: Metadata = {
  metadataBase: siteConfig.url,
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  category: "public information",
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary",
    title: siteConfig.name,
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

/** docs/DESIGN-SYSTEM.md §4: Work Sans headings, Public Sans body, Noto Sans
 *  Arabic for the Arabic-script locales — loaded for every locale so a reader
 *  switching language never waits for a second font. */
const headingFont = Work_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-work-sans",
});

const bodyFont = Public_Sans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-public-sans",
});

const arabicFont = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  display: "swap",
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
