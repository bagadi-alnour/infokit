"use client";

import {
  localeMetadata,
  publicSupportedLocales,
  type PublicLocale,
} from "@infokit/shared/i18n";
import { Languages, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";

import { PreferenceSelect } from "~/components/public/preference-select";
import { useThemePreference } from "~/components/theme/theme-provider";
import { localizedPath } from "~/i18n/routing";

/**
 * Language and theme, side by side, in the header. The language menu opens
 * under its control, in the platform palette, each language written in its own
 * script (docs/DESIGN-SYSTEM.md §1).
 */
export function PublicPreferences({
  locale,
  currentPath,
  languageLabel,
  themeLabel,
}: {
  locale: PublicLocale;
  currentPath: string;
  languageLabel: string;
  themeLabel: string;
}) {
  const router = useRouter();
  const { preference, resolved, setPreference } = useThemePreference();
  const dark =
    preference === "dark" || (preference === "system" && resolved === "dark");

  return (
    <div className="ms-auto flex items-center gap-2">
      <PreferenceSelect
        label={languageLabel}
        value={locale}
        options={publicSupportedLocales.map((language) => ({
          value: language,
          label: localeMetadata[language].label,
          lang: language,
        }))}
        onValueChange={(language) => {
          router.push(localizedPath(currentPath, language));
        }}
        icon={<Languages className="size-4" aria-hidden />}
      />
      <button
        type="button"
        aria-label={themeLabel}
        aria-pressed={dark}
        onClick={() => {
          setPreference(dark ? "light" : "dark");
        }}
        className="border-line bg-surface text-copy-muted hover:text-brand-deep hover:border-brand rounded-control focus-visible:outline-brand inline-flex size-12 items-center justify-center border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {dark ? (
          <Sun className="size-5" aria-hidden />
        ) : (
          <Moon className="size-5" aria-hidden />
        )}
      </button>
    </div>
  );
}
