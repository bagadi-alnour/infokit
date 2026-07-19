import { formatMessage } from "@calais/shared/i18n";
import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { ActionButton, BrandMark, Text } from "@calais/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { endEditorSession } from "../login/actions";
import { Chip } from "~/components/ui";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { ThemeChanger } from "~/components/theme/theme-changer";
import { LanguageSwitcher } from "~/components/auth/language-switcher";
import { requireEditor } from "~/server/auth/require";
import { DashboardNav } from "./nav";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
};

function SignOutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H10" />
      <path d="m15 8 4 4-4 4M19 12H9" />
    </svg>
  );
}

/**
 * Slice 0 editor console — private, single-editor instrument. The layout is
 * the read gate; every mutation has its own protected-action gate as well.
 */
export default async function DashboardLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const locale = requireRouteLocale((await params).locale);
  const user = await requireEditor(locale);
  const messages = await loadPageCatalog(locale, "dashboard-layout");
  const navigation = [
    {
      href: localizedPath("/dashboard", locale),
      label: messages["auth.dashboard.overview"],
    },
    {
      href: localizedPath("/dashboard/organizations", locale),
      label: messages["auth.dashboard.organizations"],
    },
    {
      href: localizedPath("/dashboard/places", locale),
      label: messages["auth.dashboard.places"],
    },
    {
      href: localizedPath("/dashboard/services", locale),
      label: messages["auth.dashboard.services"],
    },
  ] as const;
  const signedInLabel = formatMessage(messages["auth.dashboard.signedIn"], {
    email: user.email ?? "",
  });

  return (
    <div className="bg-subtle min-h-screen">
      <header className="border-line bg-surface sticky top-0 z-50 border-b">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-3 sm:px-4 lg:px-6">
          <Link
            href={localizedPath("/", locale)}
            className="focus-visible:ring-accent/50 flex shrink-0 items-center gap-2.5 rounded-[10px] font-semibold outline-none focus-visible:ring-2"
          >
            <BrandMark size={24} />
            <span className="whitespace-nowrap tracking-[-0.01em]">
              Calais Info
            </span>
          </Link>
          <div className="border-line hidden h-6 border-s md:block" />
          <span className="text-muted hidden whitespace-nowrap text-sm md:inline">
            {messages["auth.dashboard.console"]}
          </span>

          <div className="ms-auto flex min-w-0 shrink-0 items-center gap-2">
            <div
              className="hidden min-w-0 items-center gap-2 sm:flex"
              title={signedInLabel}
              aria-label={signedInLabel}
            >
              <span className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase">
                {(user.email ?? "C").slice(0, 1)}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-muted text-[10px] font-medium">
                  {messages["auth.dashboard.role"]}
                </span>
                <span className="text-xs font-semibold">
                  {messages["auth.dashboard.role.editor"]}
                </span>
              </span>
              <span className="text-muted border-line hidden max-w-44 truncate border-s ps-3 text-xs xl:inline">
                {user.email}
              </span>
            </div>
            <div className="hidden lg:block">
              <Chip tone="ok">{messages["auth.privateInstrument"]}</Chip>
            </div>
            <ThemeChanger
              label={messages["ui.theme"]}
              systemLabel={messages["ui.theme.system"]}
              lightLabel={messages["ui.theme.light"]}
              darkLabel={messages["ui.theme.dark"]}
            />
            <LanguageSwitcher
              locale={locale}
              label={messages["auth.language"]}
            />
            <form action={endEditorSession} className="shrink-0">
              <input type="hidden" name="locale" value={locale} />
              <ActionButton
                type="submit"
                tone="outline"
                minHeight={44}
                flexShrink={0}
                paddingHorizontal="$calais3"
                gap="$calais2"
                size="$3"
                aria-label={messages["auth.dashboard.signOut"]}
                $max-sm={{ width: 44, paddingHorizontal: 0 }}
              >
                <SignOutIcon />
                <Text
                  color="$color"
                  fontSize="$3"
                  fontWeight="600"
                  $max-sm={{ display: "none" }}
                >
                  {messages["auth.dashboard.signOut"]}
                </Text>
              </ActionButton>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 py-5 md:grid-cols-[220px_minmax(0,1fr)] md:gap-7 md:py-7 lg:px-6">
        <aside className="min-w-0 md:sticky md:top-24 md:self-start">
          <DashboardNav
            ariaLabel={messages["auth.dashboard.console"]}
            items={navigation}
          />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
