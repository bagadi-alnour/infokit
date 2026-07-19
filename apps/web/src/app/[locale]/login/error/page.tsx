import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { ActionLinkSurface, Text } from "@calais/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "~/components/auth/auth-shell";
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
      <Link href={authPath("login", locale)} style={{ textDecoration: "none" }}>
        <ActionLinkSurface>
          <Text color="$accentContrast" fontWeight="600">
            {messages["auth.error.retry"]}
          </Text>
        </ActionLinkSurface>
      </Link>
    </AuthShell>
  );
}
