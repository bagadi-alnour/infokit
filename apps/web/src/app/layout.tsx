import "~/styles/globals.css";

import { type Metadata } from "next";
import { Inter } from "next/font/google";

import { DesignTokenStyles } from "~/components/design-tokens";

export const metadata: Metadata = {
  title: "Calais Info",
  description:
    "Multilingual public-information platform for Calais — Slice 0 instrument",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-canvas text-ink font-sans antialiased">
        <DesignTokenStyles />
        {children}
      </body>
    </html>
  );
}
