import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { ActionLinkSurface, Text, YStack } from "@calais/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { resetPassword } from "../../actions";
import { AuthShell } from "~/components/auth/auth-shell";
import { AuthStatus } from "~/components/auth/auth-status";
import { SubmitButton } from "~/components/auth/submit-button";
import { Field, TextInput } from "~/components/admin/workspace";
import { requireRouteLocale } from "~/i18n/route-locale";
import { authPath } from "~/i18n/routing";
import { localizedAuthMetadata } from "~/seo/site";
import { isResetTokenValid } from "~/server/auth/password-reset";

interface ResetPageProps {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ error?: string }>;
}

export async function generateMetadata({
  params,
}: ResetPageProps): Promise<Metadata> {
  const locale = requireRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "login");
  return localizedAuthMetadata({
    route: "login",
    locale,
    title: messages["auth.reset.title"],
    description: messages["auth.reset.description"],
  });
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: ResetPageProps) {
  const { locale: rawLocale, token } = await params;
  const locale = requireRouteLocale(rawLocale);
  const query = await searchParams;
  const messages = await loadPageCatalog(locale, "login");
  const valid = await isResetTokenValid(token);

  if (!valid) {
    return (
      <AuthShell
        locale={locale}
        pathname="/login/reset"
        eyebrow={messages["auth.reset.eyebrow"]}
        title={messages["auth.reset.invalid"]}
        description={messages["auth.reset.invalidBody"]}
        messages={messages}
      >
        <Link
          href={authPath("login", locale)}
          style={{ textDecoration: "none" }}
        >
          <ActionLinkSurface tone="outline">
            <Text fontWeight="600">{messages["auth.reset.backToSignIn"]}</Text>
          </ActionLinkSurface>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      locale={locale}
      pathname="/login/reset"
      eyebrow={messages["auth.reset.eyebrow"]}
      title={messages["auth.reset.title"]}
      description={messages["auth.reset.description"]}
      messages={messages}
    >
      <YStack gap="$calais5">
        <AuthStatus
          status={query.error === "password" ? "invalid" : undefined}
          labels={{ invalid: messages["auth.reset.error"] }}
        />
        <form action={resetPassword} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="token" value={token} />
          <Field
            label={messages["auth.reset.passwordLabel"]}
            hint={messages["auth.reset.passwordHint"]}
          >
            <TextInput
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </Field>
          <Field label={messages["auth.reset.passwordConfirmationLabel"]}>
            <TextInput
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </Field>
          <SubmitButton
            label={messages["auth.reset.submit"]}
            pendingLabel={messages["auth.reset.submitting"]}
          />
        </form>
      </YStack>
    </AuthShell>
  );
}
