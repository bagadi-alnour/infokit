import { formatMessage } from "@calais/shared/i18n";
import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { AuthTextField, Paragraph, YStack } from "@calais/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  confirmSecondFactorCode,
  endEditorSession,
  sendSecondFactorCode,
} from "../actions";
import { AuthShell } from "~/components/auth/auth-shell";
import { AuthStatus } from "~/components/auth/auth-status";
import { SubmitButton } from "~/components/auth/submit-button";
import { requireRouteLocale } from "~/i18n/route-locale";
import { authPath } from "~/i18n/routing";
import { localizedAuthMetadata } from "~/seo/site";
import { auth } from "~/server/auth";
import { editorRecipient, maskPhone } from "~/server/auth/editors";
import { safeReturnTo } from "~/server/auth/return-to";

interface VerifySecondFactorPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    returnTo?: string;
    status?: string;
    error?: string;
  }>;
}

export async function generateMetadata({
  params,
}: VerifySecondFactorPageProps): Promise<Metadata> {
  const locale = requireRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "login-verify");
  return localizedAuthMetadata({
    route: "verify",
    locale,
    title: messages["auth.verify.title"],
    description: messages["auth.securitySms"],
  });
}

export default async function VerifySecondFactorPage({
  params,
  searchParams,
}: VerifySecondFactorPageProps) {
  const locale = requireRouteLocale((await params).locale);
  const query = await searchParams;
  const messages = await loadPageCatalog(locale, "login-verify");
  const returnTo = safeReturnTo(query.returnTo, locale);
  const session = await auth();
  if (!session?.user.email) redirect(authPath("login", locale));
  if (session.secondFactorVerified) redirect(returnTo);

  const recipient = editorRecipient(session.user.email);
  if (!recipient) redirect(authPath("error", locale));
  const phone = maskPhone(recipient.phone);

  return (
    <AuthShell
      locale={locale}
      pathname="/login/verify"
      returnTo={returnTo}
      eyebrow={messages["auth.verify.eyebrow"]}
      title={messages["auth.verify.title"]}
      description={formatMessage(messages["auth.verify.description"], {
        phone,
      })}
      messages={messages}
    >
      <YStack gap="$calais5">
        <Paragraph color="$mutedText" fontSize="$3">
          {formatMessage(messages["auth.verify.signedInAs"], {
            email: session.user.email,
          })}
        </Paragraph>
        <AuthStatus
          status={query.error ?? query.status}
          labels={{
            sent: messages["auth.verify.sent"],
            invalid: messages["auth.verify.invalid"],
            cooldown: messages["auth.verify.cooldown"],
            rate_limited: messages["auth.verify.rateLimited"],
            send_error: messages["auth.verify.sendError"],
          }}
        />

        <form action={sendSecondFactorCode}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <SubmitButton
            label={messages["auth.verify.send"]}
            pendingLabel={messages["auth.verify.sending"]}
            tone="outline"
          />
        </form>

        <form action={confirmSecondFactorCode}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <YStack gap="$calais5">
            <AuthTextField
              id="code"
              label={messages["auth.verify.codeLabel"]}
              inputProps={{
                name: "code",
                type: "text",
                autoComplete: "one-time-code",
                inputMode: "numeric",
                pattern: "[0-9]{6}",
                minLength: 6,
                maxLength: 6,
                required: true,
                placeholder: messages["auth.verify.codePlaceholder"],
                textAlign: "center",
                fontSize: 20,
                fontWeight: "600",
                letterSpacing: 7,
              }}
            />
            <SubmitButton
              label={messages["auth.verify.submit"]}
              pendingLabel={messages["auth.verify.submitting"]}
            />
          </YStack>
        </form>

        <form action={endEditorSession}>
          <input type="hidden" name="locale" value={locale} />
          <SubmitButton
            label={messages["auth.verify.signOut"]}
            pendingLabel={messages["auth.verify.signOut"]}
            tone="ghost"
          />
        </form>
      </YStack>
    </AuthShell>
  );
}
