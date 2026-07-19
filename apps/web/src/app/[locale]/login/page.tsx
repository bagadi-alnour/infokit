import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { AuthTextField, YStack } from "@calais/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requestMagicLink } from "./actions";
import { AuthShell } from "~/components/auth/auth-shell";
import { AuthStatus } from "~/components/auth/auth-status";
import { SubmitButton } from "~/components/auth/submit-button";
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
      <form action={requestMagicLink}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <YStack gap="$calais5">
          <AuthStatus
            status={query.error ? "login_error" : undefined}
            labels={{ login_error: messages["auth.login.error"] }}
          />
          <AuthTextField
            id="email"
            label={messages["auth.login.emailLabel"]}
            description={messages["auth.login.privacy"]}
            inputProps={{
              name: "email",
              type: "email",
              autoComplete: "email",
              inputMode: "email",
              required: true,
              autoFocus: true,
              placeholder: messages["auth.login.emailPlaceholder"],
            }}
          />
          <SubmitButton
            label={messages["auth.login.submit"]}
            pendingLabel={messages["auth.login.submitting"]}
          />
        </YStack>
      </form>
    </AuthShell>
  );
}
