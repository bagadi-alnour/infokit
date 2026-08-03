import type { Locale } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  confirmBackupCode,
  confirmSecondFactorCode,
  endEditorSession,
  sendSmsChallenge,
} from "../actions";
import { AuthShell } from "~/components/auth/auth-shell";
import { AuthStatus } from "~/components/auth/auth-status";
import { AuthTextField } from "~/components/auth/auth-text-field";
import { SubmitButton } from "~/components/auth/submit-button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "~/components/ui/input-otp";
import { Label } from "~/components/ui/label";
import { requireRouteLocale } from "~/i18n/route-locale";
import { authPath } from "~/i18n/routing";
import { localizedAuthMetadata } from "~/seo/site";
import { auth } from "~/server/auth";
import { safeReturnTo } from "~/server/auth/return-to";
import { PhoneEnrolment } from "~/components/auth/phone-enrolment";
import { TwoFactorCard } from "~/app/[locale]/dashboard/account/two-factor-card";
import { Callout } from "~/components/public/primitives";
import { secondFactorMandatory } from "~/server/account/settings";
import { passwordStatus } from "~/server/auth/password-status";
import {
  availableSecondFactors,
  maskPhone,
  secondFactorNumber,
} from "~/server/auth/second-factor";

interface VerifySecondFactorPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    returnTo?: string;
    status?: string;
    error?: string;
    methods?: string;
    enrol?: string;
    method?: string;
    /** `1` while the reader has asked for this device to be trusted. */
    trust?: string;
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
    description: messages["auth.verify.description"],
  });
}

/**
 * "Trust this device", offered on every form that can satisfy the factor.
 *
 * It appears three times because there are three ways through this page and the
 * reader picks one before a code exists: asking for an SMS, typing an
 * authenticator code, or spending a backup code. Offering it only on the form
 * that finally submits would hide it behind the SMS button, which is the first
 * thing most people here press — so the choice travels with them instead
 * (`trust` in the query), and each form shows what it is about to submit.
 *
 * A native checkbox rather than the shadcn one, for the same reason the method
 * switch is a link: this page has to work with no JavaScript, and the styled
 * control is a client component that syncs a hidden input — with scripting off it
 * would look ticked and submit nothing, so the device would never be trusted.
 * `accent-brand` colours the tick, which a native box draws itself and which no
 * `text-*` utility can reach.
 */
function TrustDeviceField({
  id,
  defaultChecked,
  label,
  hint,
}: {
  id: string;
  defaultChecked: boolean;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        id={id}
        name="trustDevice"
        defaultChecked={defaultChecked}
        className="accent-brand focus-visible:ring-brand/40 focus-visible:ring-3 mt-0.5 size-4 shrink-0 focus-visible:outline-none"
      />
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className="text-[0.95rem] font-medium">
          {label}
        </Label>
        <p className="text-copy-muted text-[0.85rem]">{hint}</p>
      </div>
    </div>
  );
}

/**
 * A six-digit code, from an authenticator app or from an SMS. The two are
 * indistinguishable to look at, so the form says which verifier to use — see
 * `confirmSecondFactorCode`.
 */
function CodeForm({
  method,
  locale,
  returnTo,
  methods,
  label,
  submit,
  submitting,
  invalid,
  autoFocus,
  trustLabel,
  trustHint,
  trustDevice,
}: {
  method: "totp" | "otp";
  locale: Locale;
  returnTo: string;
  methods: string;
  label: string;
  submit: string;
  submitting: string;
  invalid: boolean;
  autoFocus?: boolean;
  trustLabel: string;
  trustHint: string;
  /** What the reader already chose, on the screen that sent the code. */
  trustDevice: boolean;
}) {
  const id = `${method}-code`;
  const trustId = `${method}-trust-device`;
  return (
    <form action={confirmSecondFactorCode} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="methods" value={methods} />
      <input type="hidden" name="method" value={method} />
      <div className="flex flex-col gap-3">
        <Label htmlFor={id} className="text-base font-semibold">
          {label}
        </Label>
        {/*
          No `required` or `minLength`: input-otp spreads them onto its real
          input, which sits transparent above the slots. An empty or short code
          would then be cancelled by the browser's own constraint check — no
          request, no message, and a validation bubble pinned to text nobody can
          see, so the button reads as dead. Let the submit through and let the
          action answer with `error=invalid` instead.
        */}
        <InputOTP
          id={id}
          name="code"
          maxLength={6}
          pattern="^[0-9]+$"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus={autoFocus}
          aria-invalid={invalid || undefined}
          containerClassName="w-full justify-center"
          dir="ltr"
        >
          <InputOTPGroup dir="ltr">
            {Array.from({ length: 6 }, (_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                aria-invalid={invalid || undefined}
                className="bg-surface size-11 text-lg font-semibold tabular-nums sm:size-12 sm:text-xl"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <TrustDeviceField
        id={trustId}
        defaultChecked={trustDevice}
        label={trustLabel}
        hint={trustHint}
      />
      <SubmitButton label={submit} pendingLabel={submitting} />
    </form>
  );
}

/**
 * The second factor, asked for at whichever point it is still owed.
 *
 * Better Auth's `twoFactorRedirect` sends people here mid-sign-in, with no
 * session yet and the pending account carried by its own signed cookie. But a
 * magic link is not a path Better Auth intercepts, so a *complete* session can
 * also arrive here still owing a code — and Better Auth's verify endpoints accept
 * either, resolving the account from a live session or from the cookie. One page
 * therefore serves both, and `requireEditor` is what routes the second case in.
 *
 * Enrolling a factor is not here: that needs a session and lives at
 * `/dashboard/account/security`.
 */
export default async function VerifySecondFactorPage({
  params,
  searchParams,
}: VerifySecondFactorPageProps) {
  const locale = requireRouteLocale((await params).locale);
  const query = await searchParams;
  const messages = await loadPageCatalog(locale, "login-verify");
  const returnTo = safeReturnTo(query.returnTo, locale);

  /**
   * This page answers two situations, and the difference is whether a session
   * exists yet:
   *
   * - **Interception.** A password sign-in was accepted and Better Auth minted
   *   nothing; the pending account is carried by its own signed cookie, and the
   *   methods it offered came back in the query.
   * - **Step-up.** A session already exists but has not passed the factor — the
   *   case a magic link creates, since Better Auth does not intercept it. Here
   *   the methods have to be looked up, because no sign-in response said.
   *
   * Only a session that has *already* satisfied the factor is sent away.
   */
  const session = await auth();
  if (session?.secondFactorVerified) redirect(returnTo);

  /**
   * A third situation, and the reason this page rather than a console one: an
   * account whose *role* mandates a factor and has armed none. It cannot be sent
   * into `/dashboard` to enrol, because every layout there runs the same gate —
   * the escape hatch would sit behind the gate it escapes. So the enrolment forms
   * come to it, submitting back here via their `origin`.
   */
  if (session?.user && !session.user.twoFactorEnabled) {
    const [mandatory, password, number, consoleMessages] = await Promise.all([
      secondFactorMandatory(session.user.id),
      passwordStatus(session.user.id),
      secondFactorNumber(session.user.id),
      // The shared enrolment components speak the console's `security.*`
      // vocabulary, which lives in its own catalogue.
      loadPageCatalog(locale, "dashboard-account"),
    ]);
    const enrolLabels: Record<string, string> = {
      ...consoleMessages,
      ...messages,
    };
    return (
      <AuthShell
        locale={locale}
        pathname="/login/verify"
        returnTo={returnTo}
        eyebrow={messages["auth.enrol.eyebrow"]}
        title={messages["auth.enrol.title"]}
        description={messages["auth.enrol.description"]}
        messages={messages}
      >
        <div className="flex flex-col gap-6">
          <AuthStatus
            status={query.error ?? query.status}
            labels={{
              sent: messages["auth.verify.sent"],
              invalid: messages["auth.verify.invalid"],
              invalidCode: messages["auth.verify.invalid"],
              phone: messages["auth.enrol.invalidPhone"],
              rate_limited: messages["auth.verify.rateLimited"],
              send_error: messages["auth.verify.sendError"],
            }}
          />
          <Callout tone="info" role="status" title={messages["auth.enrol.why"]}>
            {messages["auth.enrol.whyHint"]}
          </Callout>

          <TwoFactorCard
            locale={locale}
            armed={false}
            mandatory={mandatory}
            hasPassword={password.set}
            recipient={number ? maskPhone(number.phone) : null}
            labels={enrolLabels}
            origin="verify"
            returnTo={returnTo}
          />

          <PhoneEnrolment
            locale={locale}
            origin="verify"
            returnTo={returnTo}
            hasPassword={password.set}
            armed={false}
            maskedPhone={number ? maskPhone(number.phone) : null}
            pending={number !== null && !number.verified}
            labels={enrolLabels}
          />

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

  const methods = query.methods ?? "";
  const listed = methods.split(",").filter(Boolean);
  const lookedUp = session?.user
    ? await availableSecondFactors(session.user.id)
    : null;

  const hasTotp = lookedUp ? lookedUp.totp : listed.includes("totp");
  // With nothing to go on, offer the SMS: it is the channel every account with a
  // number can use, and the authenticator field would be a dead end for someone
  // who never set one up.
  const hasOtp = lookedUp
    ? lookedUp.otp
    : listed.length === 0 || listed.includes("otp");
  // Which channel the page is showing. SMS unless the reader asked for the app,
  // or has an authenticator and no number to receive a code on.
  const useAuthApp = query.method === "totp";
  const isInvalid = query.error === "invalid" || query.error === "locked";
  const smsSent = query.status === "sent";
  /**
   * The trust choice, carried across the redirect that sends the SMS and across
   * a mistyped code, so a box ticked on the first screen is still ticked on the
   * one that submits. A preference, not a secret — nothing is granted by the
   * query saying so, only by a code being accepted afterwards.
   */
  const trustDevice = query.trust === "1";

  return (
    <AuthShell
      locale={locale}
      pathname="/login/verify"
      returnTo={returnTo}
      eyebrow={messages["auth.verify.eyebrow"]}
      title={messages["auth.verify.title"]}
      description={messages["auth.verify.description"]}
      messages={messages}
    >
      <div className="flex flex-col gap-6">
        <AuthStatus
          status={query.error ?? query.status}
          labels={{
            sent: messages["auth.verify.sent"],
            invalid: messages["auth.verify.invalid"],
            locked: messages["auth.verify.locked"],
            no_phone: messages["auth.verify.noPhone"],
            rate_limited: messages["auth.verify.rateLimited"],
            send_error: messages["auth.verify.sendError"],
          }}
        />

        {/* SMS leads: it is the channel every account with a number can use, and
            the one almost everybody on this platform actually uses. */}
        {hasOtp && !useAuthApp ? (
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-ink text-base font-bold">
                {messages["auth.verify.smsTitle"]}
              </h2>
              <p className="text-copy-muted text-[0.95rem]">
                {messages["auth.verify.smsHint"]}
              </p>
            </div>
            {/* The trust option lives here too, not only on the code form
                below: this button is the first thing most people press, and an
                option they only meet afterwards is an option they have already
                been asked to skip. `sendSmsChallenge` carries the answer back. */}
            <form action={sendSmsChallenge} className="flex flex-col gap-4">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="methods" value={methods} />
              {smsSent ? null : (
                <TrustDeviceField
                  id="send-trust-device"
                  defaultChecked={trustDevice}
                  label={messages["auth.verify.trustDevice"]}
                  hint={messages["auth.verify.trustDeviceHint"]}
                />
              )}
              <SubmitButton
                label={messages["auth.verify.send"]}
                pendingLabel={messages["auth.verify.sending"]}
                tone="outline"
              />
            </form>
            {/* The field appears once a code is actually on its way: an empty box
                next to an unpressed button reads as something already sent. */}
            {smsSent ? (
              <CodeForm
                method="otp"
                locale={locale}
                returnTo={returnTo}
                methods={methods}
                label={messages["auth.verify.codeLabel"]}
                submit={messages["auth.verify.submit"]}
                submitting={messages["auth.verify.submitting"]}
                invalid={isInvalid}
                autoFocus
                trustLabel={messages["auth.verify.trustDevice"]}
                trustHint={messages["auth.verify.trustDeviceHint"]}
                trustDevice={trustDevice}
              />
            ) : null}
          </section>
        ) : null}

        {/* The authenticator, when it is asked for — or when there is no number
            to send a code to, in which case it is the only way through. */}
        {hasTotp && (useAuthApp || !hasOtp) ? (
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-ink text-base font-bold">
                {messages["auth.verify.totpTitle"]}
              </h2>
              <p className="text-copy-muted text-[0.95rem]">
                {messages["auth.verify.totpHint"]}
              </p>
            </div>
            <CodeForm
              method="totp"
              locale={locale}
              returnTo={returnTo}
              methods={methods}
              label={messages["auth.verify.codeLabel"]}
              submit={messages["auth.verify.submit"]}
              submitting={messages["auth.verify.submitting"]}
              invalid={isInvalid}
              autoFocus
              trustLabel={messages["auth.verify.trustDevice"]}
              trustHint={messages["auth.verify.trustDeviceHint"]}
              trustDevice={trustDevice}
            />
          </section>
        ) : null}

        {/* An either/or, not two fields side by side. SMS is what almost
            everybody here uses, so it leads; the authenticator is one tap away
            for the people who set one up. A link rather than client state — the
            page is server-rendered and this must work without JavaScript. */}
        {hasTotp && hasOtp ? (
          <Link
            href={authPath("verify", locale, {
              returnTo,
              methods,
              method: useAuthApp ? undefined : "totp",
            })}
            className="text-copy-muted hover:text-ink text-center text-[0.95rem] underline"
          >
            {useAuthApp
              ? messages["auth.verify.useSms"]
              : messages["auth.verify.useAuthApp"]}
          </Link>
        ) : null}

        <section className="border-line flex flex-col gap-4 border-t pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-ink text-base font-bold">
              {messages["auth.verify.backupTitle"]}
            </h2>
            <p className="text-copy-muted text-[0.95rem]">
              {messages["auth.verify.backupHint"]}
            </p>
          </div>
          <form action={confirmBackupCode} className="flex flex-col gap-5">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="methods" value={methods} />
            <AuthTextField
              id="backup-code"
              label={messages["auth.verify.backupLabel"]}
              name="code"
              autoComplete="one-time-code"
              required
              aria-invalid={query.error === "invalid" || undefined}
              dir="ltr"
            />
            {/* Offered here as well, because a backup code is a factor like any
                other and there are only ten of them: somebody who has lost their
                phone and is asked again every morning spends the list. */}
            <TrustDeviceField
              id="backup-trust-device"
              defaultChecked={trustDevice}
              label={messages["auth.verify.trustDevice"]}
              hint={messages["auth.verify.trustDeviceHint"]}
            />
            <SubmitButton
              label={messages["auth.verify.backupSubmit"]}
              pendingLabel={messages["auth.verify.submitting"]}
              tone="outline"
            />
          </form>
        </section>

        {/* Two different exits. Mid-sign-in there is no session to end, so the
            way out is to start over; stepping an existing session up, the way
            out is to leave it. */}
        {session?.user ? (
          <form action={endEditorSession}>
            <input type="hidden" name="locale" value={locale} />
            <SubmitButton
              label={messages["auth.verify.signOut"]}
              pendingLabel={messages["auth.verify.signOut"]}
              tone="ghost"
            />
          </form>
        ) : (
          <Link
            href={authPath("login", locale, { returnTo })}
            className="text-copy-muted hover:text-ink text-center text-[0.95rem] underline"
          >
            {messages["auth.verify.startAgain"]}
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
