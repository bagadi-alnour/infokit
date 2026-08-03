// The workspace is an editing surface, so it loads the console's stylesheet
// rather than the trimmed public one (src/styles/globals.css).
import "~/styles/workspace.css";

import type { Metadata } from "next";

import { Toaster } from "~/components/ui/sonner";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function TranslationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <Toaster position="top-center" closeButton />
    </>
  );
}
