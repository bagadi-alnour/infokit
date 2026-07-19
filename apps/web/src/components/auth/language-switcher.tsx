"use client";

import {
  localeMetadata,
  supportedLocales,
  type Locale,
} from "@calais/shared/i18n";
import { PreferenceSelect, Text, type PreferenceOption } from "@calais/ui";
import { usePathname, useRouter } from "next/navigation";

import { localizedPath, unlocalizedPath } from "~/i18n/routing";

export function LanguageSwitcher({
  locale,
  pathname,
  returnTo,
  label,
}: {
  locale: Locale;
  pathname?: string;
  returnTo?: string;
  label: string;
}) {
  const router = useRouter();
  const currentPathname = usePathname();
  const options: readonly PreferenceOption<Locale>[] = supportedLocales.map(
    (candidate) => ({
      value: candidate,
      label: localeMetadata[candidate].label,
      lang: candidate,
    }),
  );

  const changeLocale = (candidate: Locale) => {
    router.push(
      localizedPath(
        pathname ?? unlocalizedPath(currentPathname),
        candidate,
        returnTo ? { returnTo } : undefined,
      ),
    );
  };

  return (
    <PreferenceSelect
      label={label}
      value={locale}
      options={options}
      onValueChange={changeLocale}
      triggerMode="icon"
      triggerValue={
        <Text
          height={18}
          color="$color"
          fontSize="$2"
          fontWeight="700"
          lineHeight={18}
        >
          {locale.toUpperCase()}
        </Text>
      }
    />
  );
}
