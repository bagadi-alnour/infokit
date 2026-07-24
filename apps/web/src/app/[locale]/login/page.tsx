import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { YStack } from "@calais/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "~/components/auth/auth-shell";
import { AuthStatus } from "~/components/auth/auth-status";
import { LoginForms } from "~/components/auth/login-forms";
import { requireRouteLocale } from "~/i18n/route-locale";
import { authPath } from "~/i18n/routing";
import { localizedAuthMetadata } from "~/seo/site";
import { auth } from "~/server/auth";
import { safeReturnTo } from "~/server/auth/return-to";

interface LoginPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    returnTo?: string;
    error?: string;
    status?: string;
  }>;
}

export async function generateMetadata({
  params,
}: LoginPageProps): Promise<Metadata> {
  const locale = requireRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "login");
  return localizedAuthMetadata({
    route: "login",
    locale,
    title: messages["auth.login.title"],
    description: messages["auth.login.description"],
  });
}

export default async function LoginPage({
  params,
  searchParams,
}: LoginPageProps) {
  const locale = requireRouteLocale((await params).locale);
  const query = await searchParams;
  const messages = await loadPageCatalog(locale, "login");
  const returnTo = safeReturnTo(query.returnTo, locale);
  const session = await auth();
  if (session?.secondFactorVerified) redirect(returnTo);
  if (session?.user) {
    redirect(authPath("verify", locale, { returnTo }));
  }

  return (
    <AuthShell
      locale={locale}
      pathname="/login"
      returnTo={returnTo}
      eyebrow={messages["auth.login.eyebrow"]}
      title={messages["auth.login.title"]}
      description={messages["auth.login.description"]}
      messages={messages}
    >
      <YStack gap="$calais6">
        <AuthStatus
          status={
            query.error === "reset"
              ? "reset_error"
              : query.error
                ? "login_error"
                : query.status === "reset"
                  ? "reset"
                  : undefined
          }
          labels={{
            login_error: messages["auth.login.error"],
            reset: messages["auth.login.resetSuccess"],
            reset_error: messages["auth.login.resetError"],
          }}
        />
        <LoginForms locale={locale} returnTo={returnTo} labels={messages} />
      </YStack>
    </AuthShell>
  );
}
