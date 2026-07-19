import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { ActionLinkSurface, Paragraph, Text, YStack } from "@calais/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "~/components/auth/auth-shell";
import { requireRouteLocale } from "~/i18n/route-locale";
import { authPath } from "~/i18n/routing";
import { localizedAuthMetadata } from "~/seo/site";

interface CheckEmailPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: CheckEmailPageProps): Promise<Metadata> {
  const locale = requireRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "login-check");
  return localizedAuthMetadata({
    route: "check",
    locale,
    title: messages["auth.check.title"],
    description: messages["auth.check.description"],
  });
}

export default async function CheckEmailPage({ params }: CheckEmailPageProps) {
  const locale = requireRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "login-check");
  return (
    <AuthShell
      locale={locale}
      pathname="/login/check"
      eyebrow={messages["auth.check.eyebrow"]}
      title={messages["auth.check.title"]}
      description={messages["auth.check.description"]}
      messages={messages}
    >
      <YStack gap="$calais5">
        <YStack
          backgroundColor="$subtle"
          borderRadius="$control"
          padding="$calais4"
        >
          <Paragraph color="$mutedText" fontSize="$3" lineHeight={20}>
            {messages["auth.check.next"]}
          </Paragraph>
        </YStack>
        <Link
          href={authPath("login", locale)}
          style={{ textDecoration: "none" }}
        >
          <ActionLinkSurface tone="outline">
            <Text fontWeight="600">{messages["auth.check.back"]}</Text>
          </ActionLinkSurface>
        </Link>
      </YStack>
    </AuthShell>
  );
}
