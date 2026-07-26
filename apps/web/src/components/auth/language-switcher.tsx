"use client";

import {
  localeMetadata,
  supportedLocales,
  type Locale,
} from "@infokit/shared/i18n";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import {
  PreferenceSelect,
  type PreferenceOption,
} from "~/components/public/preference-select";
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

  return (
    <PreferenceSelect
      label={label}
      value={locale}
      options={options}
      icon={<Languages className="size-4" />}
      onValueChange={(candidate) => {
        router.push(
          localizedPath(
            pathname ?? unlocalizedPath(currentPathname),
            candidate,
            returnTo ? { returnTo } : undefined,
          ),
        );
      }}
    />
  );
}
