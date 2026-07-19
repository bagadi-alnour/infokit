import { localeMetadata, type Locale } from "@calais/shared/i18n";
import type { CommonCatalog } from "@calais/shared/i18n/catalogs";
import { AuthShell as UniversalAuthShell, XStack } from "@calais/ui";
import type { ReactNode } from "react";

import { LanguageSwitcher } from "~/components/auth/language-switcher";
import { ThemeChanger } from "~/components/theme/theme-changer";

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
  return (
    <section lang={locale} dir={localeMetadata[locale].direction}>
      <UniversalAuthShell
        brand={messages["auth.brand"]}
        privateLabel={messages["auth.privateInstrument"]}
        securityTitle={messages["auth.securityTitle"]}
        securityItems={[
          messages["auth.securityEmail"],
          messages["auth.securitySms"],
          messages["auth.securitySession"],
        ]}
        eyebrow={eyebrow}
        title={title}
        description={description}
        headerActions={
          <XStack gap="$calais2" flexWrap="wrap" justifyContent="flex-end">
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
          </XStack>
        }
      >
        {children}
      </UniversalAuthShell>
    </section>
  );
}
