import "~/styles/globals.css";

import { localeMetadata } from "@calais/shared/i18n";
import { type Metadata } from "next";
import { Inter } from "next/font/google";

import {
  DesignTokenStyles,
  ThemeInitializationScript,
} from "~/components/design-tokens";
import { ThemeProvider } from "~/components/theme/theme-provider";
import { requireRouteLocale } from "~/i18n/route-locale";
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

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const dynamicParams = false;
export const generateStaticParams = localeStaticParams;

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const locale = requireRouteLocale((await params).locale);
  return (
    <html
      lang={locale}
      dir={localeMetadata[locale].direction}
      className={inter.variable}
      suppressHydrationWarning
    >
      <head>
        <ThemeInitializationScript />
        <DesignTokenStyles />
      </head>
      <body className="bg-canvas text-ink font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
