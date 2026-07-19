import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import type { Metadata } from "next";
import Link from "next/link";

import { WebsiteJsonLd } from "~/components/seo/website-json-ld";
import { requireRouteLocale } from "~/i18n/route-locale";
import { languageAlternates, localizedPath } from "~/i18n/routing";
import { absoluteUrl } from "~/seo/site";

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const locale = requireRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "home");
  const url = localizedPath("/", locale);

  return {
    title: { absolute: messages["home.title"] },
    description: messages["home.metaDescription"],
    alternates: {
      canonical: url,
      languages: languageAlternates("/"),
    },
    openGraph: {
      type: "website",
      title: messages["home.title"],
      description: messages["home.metaDescription"],
      url,
      locale,
    },
    twitter: {
      card: "summary",
      title: messages["home.title"],
      description: messages["home.metaDescription"],
    },
  };
}

/**
 * Placeholder landing — the public experience (finder, basic info,
 * simulator) is built against real verified content per PRODUCT.md §8.1.
 */
export default async function HomePage({ params }: HomePageProps) {
  const locale = requireRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "home");
  const url = localizedPath("/", locale);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <WebsiteJsonLd
        locale={locale}
        description={messages["home.metaDescription"]}
        url={absoluteUrl(url)}
      />
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-6 w-6 grid-cols-2 gap-0.5 *:rounded-[3px]"
        >
          <span className="bg-accent" />
          <span className="bg-ok" />
          <span className="bg-warn" />
          <span className="bg-danger" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">
          {messages["home.title"]}
        </h1>
      </div>
      <p className="text-muted max-w-md text-center text-sm">
        {messages["home.description"]}
      </p>
      <Link
        href={localizedPath("/dashboard", locale)}
        className="bg-accent rounded-control px-5 py-2.5 text-sm font-semibold text-white"
      >
        {messages["home.editorAction"]}
      </Link>
    </main>
  );
}
