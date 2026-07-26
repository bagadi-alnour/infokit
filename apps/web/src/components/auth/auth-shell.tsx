import { localeMetadata, type Locale } from "@infokit/shared/i18n";
import type { CommonCatalog } from "@infokit/shared/i18n/catalogs";
import type { ReactNode } from "react";

import { LanguageSwitcher } from "~/components/auth/language-switcher";
import { BrandMark } from "~/components/public/brand-mark";
import { Eyebrow, SurfaceCard } from "~/components/public/primitives";
import { ThemeChanger } from "~/components/theme/theme-changer";

/**
 * Editor sign-in. It uses the same tokens and targets as the public site, but
 * says plainly that this is a private instrument and lists the three gates the
 * editor is about to pass (docs/DESIGN-SYSTEM.md §1).
 */
export function AuthShell({
  locale,
  pathname,
  returnTo,
  eyebrow,
  title,
  description,
  messages,
  children,
}: {
  locale: Locale;
  pathname: string;
  returnTo?: string;
  eyebrow: string;
  title: string;
  description: string;
  messages: CommonCatalog;
  children: ReactNode;
}) {
  const securityItems = [
    messages["auth.securityEmail"],
    messages["auth.securitySms"],
    messages["auth.securitySession"],
  ];

  return (
    <section
      lang={locale}
      dir={localeMetadata[locale].direction}
      className="bg-canvas flex min-h-screen flex-col items-center px-4 py-6 md:py-10"
    >
      <div className="flex w-full max-w-4xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark size={30} />
            <span className="font-display text-ink text-base font-bold">
              {messages["auth.brand"]}
            </span>
            <span className="text-copy-muted hidden text-sm font-semibold sm:inline">
              {messages["auth.privateInstrument"]}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ThemeChanger
              label={messages["ui.theme"]}
              systemLabel={messages["ui.theme.system"]}
              lightLabel={messages["ui.theme.light"]}
              darkLabel={messages["ui.theme.dark"]}
            />
            <LanguageSwitcher
              locale={locale}
              pathname={pathname}
              returnTo={returnTo}
              label={messages["auth.language"]}
            />
          </div>
        </div>

        <SurfaceCard className="shadow-lift grid overflow-hidden md:grid-cols-[minmax(0,0.62fr)_minmax(0,1fr)]">
          <div className="bg-subtle border-line flex flex-col gap-4 border-b p-6 md:border-b-0 md:border-e md:p-7">
            <h2 className="text-copy-muted text-xs font-bold uppercase tracking-[0.08em]">
              {messages["auth.securityTitle"]}
            </h2>
            <ol className="flex flex-col gap-3">
              {securityItems.map((item, index) => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    className="bg-brand-soft text-brand-soft-ink flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <p className="text-copy-muted flex-1 text-[0.95rem] leading-relaxed">
                    {item}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col gap-6 p-6 md:p-8">
            <div className="flex flex-col gap-3">
              <Eyebrow>{eyebrow}</Eyebrow>
              <h1 className="text-ink text-2xl font-bold leading-tight tracking-tight md:text-3xl">
                {title}
              </h1>
              <p className="text-copy-muted text-[1.0625rem] leading-relaxed">
                {description}
              </p>
            </div>
            {children}
          </div>
        </SurfaceCard>
      </div>
    </section>
  );
}
