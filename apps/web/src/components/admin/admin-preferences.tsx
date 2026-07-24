"use client";

import {
  isLocale,
  localeMetadata,
  supportedLocales,
  type Locale,
} from "@calais/shared/i18n";
import { Check, ChevronDown, Languages, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { localizedPath, unlocalizedPath } from "~/i18n/routing";

export function AdminThemeToggle({ label }: { label: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="relative"
      aria-label={label}
      title={label}
      onClick={() => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      }}
    >
      <Sun
        className="size-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
        aria-hidden
      />
      <Moon
        className="absolute size-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

export function AdminLanguageMenu({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const changeLocale = (candidate: string) => {
    if (!isLocale(candidate)) return;
    router.push(localizedPath(unlocalizedPath(pathname), candidate));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-label={label}
          />
        }
      >
        <span className="text-xs font-bold">{locale.toUpperCase()}</span>
        <ChevronDown className="text-copy-muted" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2">
            <Languages aria-hidden />
            {label}
          </DropdownMenuLabel>
          {supportedLocales.map((candidate) => (
            <DropdownMenuItem
              key={candidate}
              lang={candidate}
              className="min-h-9"
              onClick={() => {
                changeLocale(candidate);
              }}
            >
              <span>{localeMetadata[candidate].label}</span>
              {candidate === locale ? (
                <Check className="ms-auto" aria-hidden />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
