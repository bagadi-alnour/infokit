import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";

import { AuthShell } from "~/components/auth/auth-shell";
import { ActionLink } from "~/components/public/primitives";
import { requireRouteLocale } from "~/i18n/route-locale";
import { authPath } from "~/i18n/routing";
import { localizedAuthMetadata } from "~/seo/site";

interface LoginErrorPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: LoginErrorPageProps): Promise<Metadata> {
  const locale = requireRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "login-error");
  return localizedAuthMetadata({
    route: "error",
    locale,
    title: messages["auth.error.title"],
    description: messages["auth.error.description"],
  });
}

export default async function LoginErrorPage({ params }: LoginErrorPageProps) {
  const locale = requireRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "login-error");
  return (
    <AuthShell
      locale={locale}
      pathname="/login/error"
      eyebrow={messages["auth.error.eyebrow"]}
      title={messages["auth.error.title"]}
      description={messages["auth.error.description"]}
      messages={messages}
    >
      <ActionLink href={authPath("login", locale)} size="block">
        {messages["auth.error.retry"]}
      </ActionLink>
    </AuthShell>
  );
}
