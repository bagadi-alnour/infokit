import {
  translatedInterfaceLocales,
  type PublicLocale,
} from "@infokit/shared/i18n";
import { Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "~/components/public/brand-mark";
import { PublicPreferences } from "~/components/public/public-preferences";
import { Eyebrow } from "~/components/public/primitives";
import { localizedPath } from "~/i18n/routing";
import { cn } from "~/lib/utils";

export const publicSections = [
  "/",
  "/activities",
  "/events",
  "/simulator",
  "/articles",
] as const;

function sectionLabel(path: string, messages: Record<string, string>) {
  switch (path) {
    case "/activities":
      return messages["public.nav.activities"];
    case "/events":
      return messages["public.nav.events"];
    case "/simulator":
      return messages["public.nav.guide"];
    case "/articles":
      return messages["public.nav.articles"];
    default:
      return messages["public.nav.home"];
  }
}

function isCurrent(path: string, currentPath: string) {
  return (
    currentPath === path || (path !== "/" && currentPath.startsWith(`${path}/`))
  );
}

/**
 * The public chrome: one bar with the mark, the four sections, language and
 * theme. Everything else on a page is content — the shell never competes with
 * the answer the reader came for (docs/DESIGN-SYSTEM.md §1).
 */
export function PublicSiteShell({
  locale,
  currentPath,
  messages,
  children,
  width = "default",
}: {
  locale: PublicLocale;
  currentPath: string;
  messages: Record<string, string>;
  children: ReactNode;
  /** `reading` narrows the main column for long-form pages. */
  width?: "default" | "reading";
}) {
  const interfaceFallback = !(
    translatedInterfaceLocales as readonly string[]
  ).includes(locale);

  return (
    <div className="bg-canvas flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="bg-brand text-brand-ink rounded-control shadow-lift focus-visible:outline-brand fixed start-4 top-4 z-[100] -translate-y-24 px-5 py-3 font-semibold transition-transform focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {messages["public.skip"]}
      </a>

      <header className="border-line bg-surface/95 sticky top-0 z-50 border-b backdrop-blur">
        <div className="max-w-300 mx-auto flex w-full flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 md:px-6 lg:px-8">
          <Link
            href={localizedPath("/", locale)}
            className="rounded-control focus-visible:outline-brand -mx-2 flex min-h-12 items-center gap-3 px-2 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <BrandMark size={32} />
            <span className="font-display text-ink text-lg font-bold tracking-tight">
              InfoKit
            </span>
          </Link>

          <nav
            aria-label={messages["public.nav.label"]}
            className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto px-1 md:order-none md:mx-0 md:w-auto md:flex-1 md:px-0"
          >
            {publicSections.map((path) => {
              const current = isCurrent(path, currentPath);
              return (
                <Link
                  key={path}
                  href={localizedPath(path, locale)}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "rounded-control focus-visible:outline-brand inline-flex min-h-12 shrink-0 items-center px-4 text-[0.95rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                    current
                      ? "bg-brand-soft text-brand-soft-ink"
                      : "text-copy-muted hover:bg-subtle hover:text-ink",
                  )}
                >
                  {sectionLabel(path, messages)}
                </Link>
              );
            })}
          </nav>

          <PublicPreferences
            locale={locale}
            currentPath={currentPath}
            languageLabel={messages["public.languages"] ?? ""}
            themeLabel={messages["public.theme"] ?? ""}
          />
        </div>
      </header>

      {interfaceFallback ? (
        <div
          role="status"
          className="border-line bg-brand-soft text-brand-soft-ink border-b"
        >
          <p className="max-w-300 mx-auto flex items-start gap-2 px-4 py-3 text-sm font-medium md:px-6 lg:px-8">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {messages["public.interfaceFallback"]}
          </p>
        </div>
      ) : null}

      <main
        id="main-content"
        className={cn(
          "mx-auto w-full flex-1 px-4 py-8 md:px-6 md:py-12 lg:px-8",
          width === "reading" ? "max-w-4xl" : "max-w-300",
        )}
      >
        {children}
      </main>

      <footer className="border-line bg-surface mt-8 border-t">
        <div className="max-w-300 mx-auto grid w-full gap-8 px-4 py-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:px-6 lg:px-8">
          <div className="flex max-w-prose flex-col gap-3">
            <div className="flex items-center gap-3">
              <BrandMark size={28} />
              <span className="font-display text-ink text-base font-bold">
                InfoKit
              </span>
            </div>
            <p className="text-copy-muted text-[0.95rem] leading-relaxed">
              {messages["public.footer"]}
            </p>
          </div>
          <nav
            aria-label={messages["public.nav.label"]}
            className="flex flex-col gap-1"
          >
            {publicSections.map((path) => (
              <Link
                key={path}
                href={localizedPath(path, locale)}
                className="text-copy-muted hover:text-brand-deep rounded-control focus-visible:outline-brand inline-flex min-h-11 items-center text-[0.95rem] font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {sectionLabel(path, messages)}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

/**
 * Page opening: eyebrow, title, one lead paragraph, optional actions and an
 * optional strip of facts. Answers before atmosphere (§1).
 */
export function PublicPageHeader({
  eyebrow,
  title,
  description,
  actions,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-6 md:mb-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex max-w-3xl flex-col gap-3">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="text-ink text-3xl font-bold tracking-tight md:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="text-copy-muted max-w-2xl text-lg leading-relaxed">
              {description}
            </p>
          ) : null}
          {actions ? (
            <div className="mt-2 flex flex-wrap gap-3">{actions}</div>
          ) : null}
        </div>
        {aside}
      </div>
      {children}
    </header>
  );
}
