"use client";

import {
  localeMetadata,
  supportedLocales,
  type Locale,
} from "@infokit/shared/i18n";
import {
  Check,
  Languages,
  LogOut,
  Monitor,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { endEditorSession } from "~/app/[locale]/login/actions";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { localizedPath, unlocalizedPath } from "~/i18n/routing";

const themeIcon = { light: Sun, dark: Moon, system: Monitor } as const;

/**
 * Identity and personal preferences in one place: who is signed in, the two
 * settings that belong to the person rather than the data (language, theme),
 * the account page, and the way out.
 */
export function AdminUserMenu({
  locale,
  name,
  email,
  initials,
  context,
  accountHref,
  labels,
}: {
  locale: Locale;
  name: string;
  email: string | null;
  initials: string;
  /** Secondary identity line: the workspace this editor is acting in. */
  context: string;
  accountHref: string;
  labels: {
    open: string;
    account: string;
    language: string;
    theme: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    signOut: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [signingOut, startSignOut] = useTransition();
  const ThemeGlyph =
    themeIcon[theme === "light" || theme === "dark" ? theme : "system"];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={labels.open}
            title={name}
            className="rounded-full"
          />
        }
      >
        <span className="bg-brand text-canvas flex size-8 items-center justify-center rounded-full text-[11px] font-bold uppercase">
          {initials}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <div className="flex items-center gap-2.5 px-1.5 py-2">
          <span className="bg-brand text-canvas flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase">
            {initials}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold">{name}</span>
            {email ? (
              <span className="text-copy-muted block truncate text-xs">
                {email}
              </span>
            ) : null}
            {/* Which workspace the session is acting in: the sidebar says so on
             * a wide screen, this menu is the only place that says so on a
             * phone, where the sidebar is a closed drawer. */}
            <span className="text-copy-muted block truncate text-xs">
              {context}
            </span>
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="min-h-9"
            render={<Link href={accountHref} />}
          >
            <UserRound aria-hidden />
            {labels.account}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="min-h-9">
              <Languages aria-hidden />
              {labels.language}
              <span className="text-copy-muted ms-auto text-xs font-semibold">
                {locale.toUpperCase()}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              {supportedLocales.map((candidate) => (
                <DropdownMenuItem
                  key={candidate}
                  lang={candidate}
                  className="min-h-9"
                  onClick={() => {
                    router.push(
                      localizedPath(unlocalizedPath(pathname), candidate),
                    );
                  }}
                >
                  <span>{localeMetadata[candidate].label}</span>
                  {candidate === locale ? (
                    <Check className="ms-auto" aria-hidden />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="min-h-9">
              <ThemeGlyph aria-hidden />
              {labels.theme}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              <DropdownMenuRadioGroup
                value={theme ?? "system"}
                onValueChange={(value) => {
                  setTheme(String(value));
                }}
              >
                <DropdownMenuRadioItem value="light" className="min-h-9">
                  <Sun aria-hidden />
                  {labels.themeLight}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark" className="min-h-9">
                  <Moon aria-hidden />
                  {labels.themeDark}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system" className="min-h-9">
                  <Monitor aria-hidden />
                  {labels.themeSystem}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="min-h-9"
          disabled={signingOut}
          onClick={() => {
            startSignOut(async () => {
              const formData = new FormData();
              formData.set("locale", locale);
              await endEditorSession(formData);
            });
          }}
        >
          <LogOut aria-hidden />
          {labels.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
