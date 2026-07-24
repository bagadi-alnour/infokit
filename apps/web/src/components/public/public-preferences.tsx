"use client";

import {
  localeMetadata,
  publicSupportedLocales,
  type PublicLocale,
} from "@calais/shared/i18n";
import {
  PreferenceSelect,
  PublicThemeToggleButton,
  type PreferenceOption,
} from "@calais/ui";
import { useRouter } from "next/navigation";

import { localizedPath } from "~/i18n/routing";
import { useThemePreference } from "~/components/theme/theme-provider";

const languageOptions: readonly PreferenceOption<PublicLocale>[] =
  publicSupportedLocales.map((language) => ({
    value: language,
    label: localeMetadata[language].label,
    lang: language,
  }));

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
  const { preference, setPreference } = useThemePreference();
  const dark =
    preference === "dark" ||
    (preference === "system" &&
      typeof document !== "undefined" &&
      document.documentElement.dataset.theme === "dark");

  return (
    <div className="flex items-center gap-2">
      <PreferenceSelect
        label={languageLabel}
        value={locale}
        options={languageOptions}
        minWidth={116}
        onValueChange={(nextLocale) => {
          router.push(localizedPath(currentPath, nextLocale));
        }}
      />
      <PublicThemeToggleButton
        label={themeLabel}
        dark={dark}
        onPress={() => {
          setPreference(dark ? "light" : "dark");
        }}
      />
    </div>
  );
}
