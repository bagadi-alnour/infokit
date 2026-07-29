import { formatMessage, type Locale } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  confirmSecondFactorCode,
  endEditorSession,
  enrolSecondFactorPhone,
  sendSecondFactorCode,
} from "../actions";
import { AuthShell } from "~/components/auth/auth-shell";
import { AuthStatus } from "~/components/auth/auth-status";
import { AuthTextField } from "~/components/auth/auth-text-field";
import { SubmitButton } from "~/components/auth/submit-button";
import { Callout } from "~/components/public/primitives";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "~/components/ui/input-otp";
import { Label } from "~/components/ui/label";
import { requireRouteLocale } from "~/i18n/route-locale";
import { authPath } from "~/i18n/routing";
import { localizedAuthMetadata } from "~/seo/site";
import { secondFactorRequired } from "~/server/account/settings";
import { auth } from "~/server/auth";
import { maskPhone, secondFactorNumber } from "~/server/auth/second-factor";
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

/**
 * The number an account claims. Same form whether it is the first one or a
 * correction, because enrolling again is how a mistyped number is fixed.
 */
function PhoneForm({
  id,
  locale,
  returnTo,
  label,
  description,
  placeholder,
  submit,
  submitting,
  invalid,
  autoFocus,
}: {
  id: string;
  locale: Locale;
  returnTo: string;
  label: string;
  description: string;
  placeholder: string;
  submit: string;
  submitting: string;
  invalid: boolean;
  autoFocus?: boolean;
}) {
  return (
    <form action={enrolSecondFactorPhone} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <AuthTextField
        id={id}
        label={label}
        description={description}
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        required
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        dir="ltr"
      />
      <SubmitButton label={submit} pendingLabel={submitting} />
    </form>
  );
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

  const [required, number] = await Promise.all([
    secondFactorRequired(session.user.id),
    secondFactorNumber(session.user.id),
  ]);
  // Nothing to prove and nothing waiting to be confirmed: an account that
  // turned the second factor off never sees this page, and requireEditor lets
  // the same session through.
  const pendingEnrolment = number !== null && !number.verified;
  if (!required && !pendingEnrolment) redirect(returnTo);

  const isInvalidCode = query.error === "invalid";
  const isInvalidPhone = query.error === "phone";

  return (
    <AuthShell
      locale={locale}
      pathname="/login/verify"
      returnTo={returnTo}
      eyebrow={
        number
          ? messages["auth.verify.eyebrow"]
          : messages["auth.enrol.eyebrow"]
      }
      title={
        number ? messages["auth.verify.title"] : messages["auth.enrol.title"]
      }
      description={
        number
          ? formatMessage(messages["auth.verify.description"], {
              phone: maskPhone(number.phone),
            })
          : messages["auth.enrol.description"]
      }
      messages={messages}
    >
      <div className="flex flex-col gap-5">
        <p className="text-copy-muted text-[0.95rem]">
          {formatMessage(messages["auth.verify.signedInAs"], {
            email: session.user.email,
          })}
        </p>
        <AuthStatus
          status={query.error ?? query.status}
          labels={{
            sent: messages["auth.verify.sent"],
            invalid: messages["auth.verify.invalid"],
            cooldown: messages["auth.verify.cooldown"],
            rate_limited: messages["auth.verify.rateLimited"],
            send_error: messages["auth.verify.sendError"],
            phone: messages["auth.enrol.invalidPhone"],
          }}
        />

        {number ? (
          <>
            {pendingEnrolment ? (
              <Callout tone="info" role="status">
                {messages["auth.verify.unverified"]}
              </Callout>
            ) : null}

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
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3">
                  <Label htmlFor="code" className="text-base font-semibold">
                    {messages["auth.verify.codeLabel"]}
                  </Label>
                  {/*
                    No `required` or `minLength` here: input-otp spreads them
                    onto its real input, which sits transparent above the slots.
                    An empty or short code would then be cancelled by the
                    browser's own constraint check — no request, no message, and
                    a validation bubble pinned to text nobody can see, so the
                    button reads as dead. Let the submit through and let
                    confirmSecondFactorCode answer with `error=invalid` instead.
                  */}
                  <InputOTP
                    id="code"
                    name="code"
                    maxLength={6}
                    pattern="^[0-9]+$"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={messages["auth.verify.codePlaceholder"]}
                    aria-invalid={isInvalidCode || undefined}
                    containerClassName="w-full justify-center"
                    dir="ltr"
                  >
                    <InputOTPGroup dir="ltr">
                      {Array.from({ length: 6 }, (_, index) => (
                        <InputOTPSlot
                          key={index}
                          index={index}
                          aria-invalid={isInvalidCode || undefined}
                          className="bg-surface size-11 text-lg font-semibold tabular-nums sm:size-12 sm:text-xl"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <SubmitButton
                  label={messages["auth.verify.submit"]}
                  pendingLabel={messages["auth.verify.submitting"]}
                />
              </div>
            </form>

            {/* Only while the number is unproven. Once a code has come back
                from it, replacing it is account administration rather than a
                step in signing in. */}
            {pendingEnrolment ? (
              <div className="border-line flex flex-col gap-4 border-t pt-5">
                <h2 className="font-display text-ink text-base font-bold">
                  {messages["auth.verify.changeNumber"]}
                </h2>
                <PhoneForm
                  id="replacement-phone"
                  locale={locale}
                  returnTo={returnTo}
                  label={messages["auth.enrol.phoneLabel"]}
                  description={messages["auth.verify.changeNumberHint"]}
                  placeholder={messages["auth.enrol.phonePlaceholder"]}
                  submit={messages["auth.verify.changeSubmit"]}
                  submitting={messages["auth.enrol.submitting"]}
                  invalid={isInvalidPhone}
                />
              </div>
            ) : null}
          </>
        ) : (
          <>
            {/* The reach of the role is the whole reason for the ask, so the
                page says it before the field rather than after a refusal. */}
            <Callout
              tone="info"
              role="status"
              title={messages["auth.enrol.why"]}
            >
              {messages["auth.enrol.whyHint"]}
            </Callout>
            <PhoneForm
              id="phone"
              locale={locale}
              returnTo={returnTo}
              label={messages["auth.enrol.phoneLabel"]}
              description={messages["auth.enrol.phoneHint"]}
              placeholder={messages["auth.enrol.phonePlaceholder"]}
              submit={messages["auth.enrol.submit"]}
              submitting={messages["auth.enrol.submitting"]}
              invalid={isInvalidPhone}
              autoFocus
            />
          </>
        )}

        <form action={endEditorSession}>
          <input type="hidden" name="locale" value={locale} />
          <SubmitButton
            label={messages["auth.verify.signOut"]}
            pendingLabel={messages["auth.verify.signOut"]}
            tone="ghost"
          />
        </form>
      </div>
    </AuthShell>
  );
}
