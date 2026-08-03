import {
  confirmSecondFactorPhone,
  enrolSecondFactorPhone,
  resendPhoneCode,
} from "~/app/[locale]/dashboard/account/two-factor-actions";
import { Card, Field, Notice, TextInput } from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";

/**
 * The SMS half of enrolling a second factor: record a number, then prove it.
 *
 * Shared, because the same forms are needed in two places that cannot be the
 * same page. Account settings is the ordinary home for them. But an account whose
 * *role* mandates a factor has to enrol before it may read anything, and the page
 * that lets it do so cannot live under `/dashboard` — every layout there runs
 * `requireEditor`, so the escape hatch would sit behind the gate it escapes. The
 * `origin` prop is what sends each submission back to the page it came from.
 */
export function PhoneEnrolment({
  locale,
  origin,
  returnTo,
  hasPassword,
  armed,
  maskedPhone,
  pending,
  labels,
  className,
}: {
  locale: string;
  origin: "security" | "verify";
  /**
   * Passed through to the card. The security section flows its cards in columns
   * rather than grid rows and sends `h-auto` to drop `Card`'s `h-full`, which
   * would otherwise stretch this one to the height of the whole section.
   */
  className?: string;
  returnTo?: string;
  /** Whether the gated `enableTwoFactor` call will demand a password. */
  hasPassword: boolean;
  /** Whether a factor is already armed, which decides if that call happens. */
  armed: boolean;
  /** Already masked by the caller: a full number never reaches this component. */
  maskedPhone: string | null;
  /** A number is on file but no code has come back from it yet. */
  pending: boolean;
  labels: Record<string, string>;
}) {
  const l = (key: string): string => labels[key] ?? key;
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="origin" value={origin} />
      {returnTo ? (
        <input type="hidden" name="returnTo" value={returnTo} />
      ) : null}
    </>
  );

  return (
    <Card
      title={l("security.phone.heading")}
      hint={l("security.phone.hint")}
      className={className}
    >
      <div className="grid gap-4">
        {pending ? (
          <Notice tone="warn" title={l("security.phone.pending")}>
            {l("security.phone.pendingHint")}
          </Notice>
        ) : null}
        {maskedPhone ? (
          <p className="text-copy-muted text-sm">
            {l("security.phone.current").replace("{phone}", maskedPhone)}
          </p>
        ) : null}

        {/* Confirming the number and arming the factor are the same code: Better
            Auth turns the factor on when the first one comes back. No password
            here — a code is its own proof. */}
        {pending ? (
          <div className="flex flex-wrap items-end gap-3">
            <form
              action={confirmSecondFactorPhone}
              className="grid max-w-xs gap-3"
            >
              {hidden}
              <Field label={l("security.phone.codeLabel")}>
                <TextInput
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  dir="ltr"
                />
              </Field>
              <div>
                <PendingButton>{l("security.phone.confirm")}</PendingButton>
              </div>
            </form>
            <form action={resendPhoneCode}>
              {hidden}
              <PendingButton variant="secondary">
                {l("security.phone.resend")}
              </PendingButton>
            </form>
          </div>
        ) : null}

        <form action={enrolSecondFactorPhone} className="grid max-w-md gap-4">
          {hidden}
          <Field
            label={l("security.phone.label")}
            hint={l("security.phone.labelHint")}
          >
            <TextInput
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={20}
              placeholder={l("security.phone.placeholder")}
              dir="ltr"
              required
            />
          </Field>
          {/* Enrolling the first number also creates the factor, which is a
              gated call — so the password is needed here too, and only when the
              account has one. */}
          {hasPassword && !armed ? (
            <Field
              label={l("security.twoFactor.passwordLabel")}
              hint={l("security.twoFactor.passwordHint")}
            >
              <TextInput
                name="currentPassword"
                type="password"
                autoComplete="current-password"
              />
            </Field>
          ) : null}
          <div>
            <PendingButton>
              {maskedPhone
                ? l("security.phone.replace")
                : l("security.phone.enrol")}
            </PendingButton>
          </div>
        </form>
      </div>
    </Card>
  );
}
