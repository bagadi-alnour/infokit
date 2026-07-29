import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";

import { resetPassword } from "../../actions";
import { AuthShell } from "~/components/auth/auth-shell";
import { AuthStatus } from "~/components/auth/auth-status";
import { PasswordCreationFields } from "~/components/auth/password-creation-fields";
import { SubmitButton } from "~/components/auth/submit-button";
import { ActionLink } from "~/components/public/primitives";
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
        <ActionLink
          href={authPath("login", locale)}
          tone="outline"
          size="block"
        >
          {messages["auth.reset.backToSignIn"]}
        </ActionLink>
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
      <div className="flex flex-col gap-5">
        <AuthStatus
          status={query.error === "password" ? "invalid" : undefined}
          labels={{ invalid: messages["auth.reset.error"] }}
        />
        <form action={resetPassword} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="token" value={token} />
          <PasswordCreationFields
            idPrefix="reset"
            passwordLabel={messages["auth.reset.passwordLabel"]}
            confirmationLabel={messages["auth.reset.passwordConfirmationLabel"]}
            showPasswordLabel={messages["auth.password.show"]}
            hidePasswordLabel={messages["auth.password.hide"]}
            strengthLabels={{
              label: messages["auth.passwordStrength.label"],
              weak: messages["auth.passwordStrength.weak"],
              fair: messages["auth.passwordStrength.fair"],
              good: messages["auth.passwordStrength.good"],
              strong: messages["auth.passwordStrength.strong"],
              veryStrong: messages["auth.passwordStrength.veryStrong"],
              minLength: messages["auth.passwordStrength.minLength"],
              uppercase: messages["auth.passwordStrength.uppercase"],
              lowercase: messages["auth.passwordStrength.lowercase"],
              number: messages["auth.passwordStrength.number"],
              special: messages["auth.passwordStrength.special"],
            }}
          />
          <SubmitButton
            label={messages["auth.reset.submit"]}
            pendingLabel={messages["auth.reset.submitting"]}
          />
        </form>
      </div>
    </AuthShell>
  );
}
