import {
  translatedInterfaceLocales,
  type PublicLocale,
} from "@calais/shared/i18n";
import { BrandMark } from "@calais/ui";
import Link from "next/link";
import type { ReactNode } from "react";

import { PublicPreferences } from "~/components/public/public-preferences";
import { localizedPath } from "~/i18n/routing";

export function PublicSiteShell({
  locale,
  currentPath,
  messages,
  children,
}: {
  locale: PublicLocale;
  currentPath: string;
  messages: Record<string, string>;
  children: ReactNode;
}) {
  const sections = [
    ["/", messages["public.nav.home"]],
    ["/simulator", messages["public.nav.guide"]],
    ["/activities", messages["public.nav.activities"]],
    ["/articles", messages["public.nav.articles"]],
  ] as const;

  return (
    <div className="bg-subtle min-h-screen">
      <a
        href="#main-content"
        className="bg-brand focus-visible:ring-brand rounded-control fixed start-4 top-4 z-[100] -translate-y-24 px-4 py-3 font-semibold text-white focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2"
      >
        {messages["public.skip"]}
      </a>
      <header className="border-line bg-surface border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <Link
            href={localizedPath("/", locale)}
            className="focus-visible:ring-brand rounded-control flex min-h-11 items-center gap-3 focus-visible:outline-none focus-visible:ring-2"
          >
            <BrandMark size={28} />
            <span className="text-lg font-bold">Calais Info</span>
          </Link>
          <nav
            aria-label={messages["public.nav.label"]}
            className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto"
          >
            {sections.map(([path, label]) => (
              <Link
                key={path}
                href={localizedPath(path, locale)}
                aria-current={
                  currentPath === path ||
                  (path !== "/" && currentPath.startsWith(`${path}/`))
                    ? "page"
                    : undefined
                }
                className="text-copy-muted hover:bg-brand-soft hover:text-brand focus-visible:ring-brand rounded-control aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand min-h-11 shrink-0 px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
              >
                {label}
              </Link>
            ))}
          </nav>
          <PublicPreferences
            locale={locale}
            currentPath={currentPath}
            languageLabel={messages["public.languages"] ?? ""}
            themeLabel={messages["public.theme"] ?? ""}
          />
        </div>
      </header>
      {!(translatedInterfaceLocales as readonly string[]).includes(locale) ? (
        <div
          role="status"
          className="border-brand-soft bg-brand-soft text-brand border-b px-4 py-3 text-center text-sm font-semibold"
        >
          {messages["public.interfaceFallback"]}
        </div>
      ) : null}
      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12"
      >
        {children}
      </main>
      <footer className="border-line text-copy-muted border-t px-4 py-8 text-center text-sm">
        {messages["public.footer"]}
      </footer>
    </div>
  );
}

export function PublicPageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-8 max-w-3xl">
      <p className="text-brand mb-3 text-xs font-extrabold uppercase tracking-[0.16em]">
        {eyebrow}
      </p>
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      <p className="text-copy-muted mt-3 text-base leading-relaxed md:text-lg">
        {description}
      </p>
    </header>
  );
}
