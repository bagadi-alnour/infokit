import { aboutStrings } from "@infokit/shared/about";
import {
  isLocale,
  localeMetadata,
  translatedInterfaceLocales,
  type PublicLocale,
} from "@infokit/shared/i18n";
import { Download, Info, LogIn } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark, BrandWordmark } from "~/components/public/brand-mark";
import {
  PublicNavMenu,
  type PublicNavItem,
} from "~/components/public/public-nav-menu";
import {
  PublicLanguageSelect,
  PublicThemeToggle,
} from "~/components/public/public-preferences";
import {
  ActionAnchor,
  Callout,
  Eyebrow,
  type ContentFamily,
} from "~/components/public/primitives";
import { authPath, localizedPath } from "~/i18n/routing";
import { cn } from "~/lib/utils";

export const publicSections = [
  "/",
  "/activities",
  "/events",
  "/simulator",
  "/articles",
  "/about",
] as const;

const MOBILE_APP_LINKS = {
  android: "https://play.google.com/store/apps/details?id=org.infokit.app",
  ios: "https://apps.apple.com/app/id6795952455",
} as const;

function sectionLabel(
  path: string,
  messages: Record<string, string>,
  locale: PublicLocale,
) {
  switch (path) {
    case "/activities":
      return messages["public.nav.activities"];
    case "/events":
      return messages["public.nav.events"];
    case "/simulator":
      return messages["public.nav.guide"];
    case "/articles":
      return messages["public.nav.articles"];
    // The page's own title, translated in all eleven languages next to the
    // words it introduces — a nav key would be a twelfth wording of it.
    case "/about":
      return aboutStrings(locale).title;
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
 * The public chrome: one bar with the mark, the six sections, language, theme
 * and the associations' own door. Everything else on a page is content — the
 * shell never competes with the answer the reader came for
 * (docs/DESIGN-SYSTEM.md §1).
 *
 * The bar is one line at every width, and what it can hold changes rather than
 * how many lines it takes: the sections sit on it from `lg`, and below that they
 * move into the menu panel (`PublicNavMenu`). Language stays on the bar at every
 * width because reading the page at all depends on it; theme travels with the
 * sections into the panel.
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
  const navItems: PublicNavItem[] = publicSections.map((path) => ({
    path,
    href: localizedPath(path, locale),
    label: sectionLabel(path, messages, locale) ?? "",
    current: isCurrent(path, currentPath),
  }));
  // Not a section: the associations who publish the information sign in here,
  // and a reader never needs to. It is chrome at the end of the bar, a row
  // under the sections in the menu, and a line in the footer.
  //
  // The console exists in the three interface languages only, so a reader on one
  // of the other eight is sent to the French door — the same fallback the auth
  // layer applies to a session it cannot place (src/server/auth/config.ts).
  const signIn = {
    href: authPath("login", isLocale(locale) ? locale : "fr"),
    label: messages["public.signIn"] ?? "",
  };
  // The footer's ways on: the public information itself, the door the
  // associations publish through, the page that explains what this is, and the
  // two legal pages. The door is the same `signIn` the bar and the menu carry,
  // written out in full. The legal pages are here and nowhere else — a reader
  // looking for who publishes this looks at the bottom of the page, and the bar
  // belongs to the answer they came for (docs/DESIGN-SYSTEM.md §1).
  const footerLinks = [
    {
      href: localizedPath("/", locale),
      label: messages["public.footer.publicInfo"] ?? "",
    },
    signIn,
    {
      href: localizedPath("/about", locale),
      label: aboutStrings(locale).title,
    },
    {
      href: localizedPath("/legal", locale),
      label: messages["public.footer.legal"] ?? "",
    },
    {
      href: localizedPath("/privacy", locale),
      label: messages["public.footer.privacy"] ?? "",
    },
  ];

  return (
    // `clip` rather than `hidden`: a full-bleed band inside the page column is
    // exactly 100vw wide, which is a hair wider than the space left by a
    // classic scrollbar. `hidden` would make the bar's `sticky` stick to this
    // box instead of the window; `clip` creates no scroll container, so the bar
    // keeps working and the overhang simply never shows.
    <div className="bg-canvas flex min-h-screen flex-col overflow-x-clip">
      {/* Paper has no chrome: a sheet a reader saved or printed carries the
       *  answer and the notice that qualifies it, and nothing that only works
       *  under a cursor — the skip link, the bar, the fallback banner and the
       *  footer's links all go. This is the same degradation the design system
       *  asks for, with paper as the last device (docs/DESIGN-SYSTEM.md §1). */}
      <a
        href="#main-content"
        className="bg-brand text-brand-ink rounded-control shadow-lift focus-visible:outline-brand fixed start-4 top-4 z-[100] -translate-y-24 px-5 py-3 font-semibold transition-transform focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 print:hidden"
      >
        {messages["public.skip"]}
      </a>

      <header
        // The lift on scroll is a scroll-driven animation in globals.css: a
        // browser without it simply keeps the resting bar (rule 7).
        data-public-header
        className="border-line bg-surface/90 supports-backdrop-filter:bg-surface/75 sticky top-0 z-50 border-b backdrop-blur-lg print:hidden"
      >
        <div className="max-w-300 mx-auto flex w-full items-center gap-2 px-4 py-2 md:px-6 lg:gap-4 lg:px-8">
          <Link
            href={localizedPath("/", locale)}
            className="rounded-control focus-visible:outline-brand -mx-2 flex min-h-12 shrink-0 items-center px-2 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <BrandWordmark
              locale={locale}
              className="text-ink text-xl sm:text-2xl"
            />
          </Link>

          <nav
            aria-label={messages["public.nav.label"]}
            className="hidden min-w-0 flex-1 items-center gap-0.5 lg:flex"
          >
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.href}
                aria-current={item.current ? "page" : undefined}
                className={cn(
                  "rounded-control focus-visible:outline-brand inline-flex min-h-12 shrink-0 items-center px-3 text-[0.9375rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                  item.current
                    ? "bg-brand-soft text-brand-soft-ink"
                    : "text-copy-muted hover:bg-subtle hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-2">
            <PublicLanguageSelect
              locale={locale}
              currentPath={currentPath}
              label={messages["public.languages"] ?? ""}
            />
            <PublicThemeToggle
              label={messages["public.theme"] ?? ""}
              className="hidden lg:inline-flex"
            />
            {/* On the bar the door is its glyph alone, the same 48px square as
             *  the theme control beside it: the word is carried by `aria-label`
             *  for a screen reader and by `title` on hover, and it is written
             *  out where the reader is choosing rather than glancing — the menu
             *  row and the footer line. */}
            <Link
              href={signIn.href}
              aria-label={signIn.label}
              title={signIn.label}
              className="border-line bg-surface text-copy-muted hover:text-brand-deep hover:border-brand rounded-control focus-visible:outline-brand hidden size-12 shrink-0 items-center justify-center border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 lg:inline-flex"
            >
              <LogIn className="size-5" aria-hidden />
            </Link>
            <PublicNavMenu
              items={navItems}
              signIn={signIn}
              direction={localeMetadata[locale].direction}
              labels={{
                nav: messages["public.nav.label"] ?? "",
                menu: messages["public.menu"] ?? "",
                close: messages["public.menu.close"] ?? "",
                appearance: messages["public.appearance"] ?? "",
                light: messages["public.theme.light"] ?? "",
                dark: messages["public.theme.dark"] ?? "",
              }}
            />
          </div>
        </div>
      </header>

      {interfaceFallback ? (
        <div
          role="status"
          className="border-line bg-brand-soft text-brand-soft-ink border-b print:hidden"
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
          "mx-auto w-full flex-1 px-4 py-8 md:px-6 md:py-12 lg:px-8 print:max-w-none print:p-0",
          width === "reading" ? "max-w-4xl" : "max-w-300",
        )}
      >
        {children}
      </main>

      {/* The mark and what the platform is, three ways on, the two mobile-app
       *  stores, and the sentence that qualifies every answer above them. Three
       *  links rather than the section list: the bar already carries the
       *  sections, and a reader who reached the bottom is choosing between
       *  reading, publishing, and understanding what this is. The tagline is
       *  the one line of the shell translated in all eleven languages, and the
       *  notice is the last thing on the page because it is the limit of
       *  everything before it. */}
      <footer className="border-line bg-surface mt-12 border-t print:mt-6">
        <div className="max-w-300 mx-auto w-full px-4 py-8 md:px-6 md:py-12 lg:px-8 print:max-w-none print:px-0 print:py-4">
          {/* On paper the notice below survives and this does not: a printed
           *  sheet cannot be navigated, and the disclaimer is the one part of
           *  the footer that qualifies what the reader is holding. */}
          <div className="flex flex-col gap-8 md:flex-row md:justify-between md:gap-12 print:hidden">
            <div className="flex max-w-prose flex-col items-start gap-3">
              <Link
                href={localizedPath("/", locale)}
                className="rounded-control focus-visible:outline-brand -mx-1 flex items-center gap-2.5 px-1 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <BrandMark size={28} />
                <BrandWordmark locale={locale} className="text-ink text-2xl" />
              </Link>
              <p className="text-copy-muted text-[0.95rem] leading-relaxed">
                {aboutStrings(locale).tagline}
              </p>
            </div>

            <div className="flex flex-col gap-8 sm:flex-row sm:gap-12 md:justify-end">
              <section
                aria-labelledby="mobile-app-download-title"
                className="flex flex-col items-start md:items-end"
              >
                <h2
                  id="mobile-app-download-title"
                  className="text-ink text-[0.95rem] font-semibold"
                >
                  {messages["public.footer.downloadApp"]}
                </h2>
                <div className="mt-3 flex flex-col items-start gap-2 md:items-end">
                  <ActionAnchor
                    href={MOBILE_APP_LINKS.android}
                    target="_blank"
                    rel="noreferrer"
                    tone="outline"
                    size="compact"
                  >
                    <Download className="size-4" aria-hidden />
                    {messages["public.footer.downloadAndroid"]}
                  </ActionAnchor>
                  <ActionAnchor
                    href={MOBILE_APP_LINKS.ios}
                    target="_blank"
                    rel="noreferrer"
                    tone="outline"
                    size="compact"
                  >
                    <Download className="size-4" aria-hidden />
                    {messages["public.footer.downloadIos"]}
                  </ActionAnchor>
                </div>
              </section>

              <nav aria-label={messages["public.nav.label"]}>
                <ul className="flex flex-col md:items-end">
                  {footerLinks.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="text-copy-muted hover:text-brand-deep rounded-control focus-visible:outline-brand -mx-2 flex min-h-12 items-center px-2 text-[0.95rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>

          {/* Bold summary then detail, in the one notice component the public
           *  surface has: what this site is, and where its authority stops. */}
          <Callout
            role="note"
            title={messages["public.footer"]}
            className="mt-8 md:mt-10 print:mt-0"
          >
            {messages["public.footer.disclaimer"]}
          </Callout>
        </div>
      </footer>
    </div>
  );
}

/**
 * Page opening: eyebrow, title, one lead paragraph, optional actions and an
 * optional strip of facts. Answers before atmosphere (§1).
 *
 * `family` says which kind of content the page is about, and tints the eyebrow
 * in that family's hue (docs/DESIGN-SYSTEM.md §5) — so the agenda opens indigo,
 * the articles plum, the guides copper, and a reader arriving from a card sees
 * the same colour the card wore. It is one element, and the word is beside it.
 */
export function PublicPageHeader({
  eyebrow,
  title,
  description,
  family,
  actions,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  family?: ContentFamily;
  actions?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-6 md:mb-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex max-w-3xl flex-col gap-3">
          <Eyebrow family={family}>{eyebrow}</Eyebrow>
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
