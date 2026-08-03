"use client";

import { useActionState } from "react";

import { manageTwoFactor, type TwoFactorState } from "./two-factor-actions";
import { Card, Field, Notice, TextInput } from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";

/**
 * The second-factor card.
 *
 * A client component, and for one specific reason: the authenticator secret and
 * the backup codes are shown exactly once, and this is the only place that can
 * hold them without writing them somewhere they would outlive their welcome.
 * Better Auth returns both from the call that mints them, so they live in this
 * action's state — never in the URL, never re-read on a later page load. (They
 * could not be re-read anyway: the endpoint that hands out the secret wants the
 * account's password, which a GET does not have.)
 *
 * All the buttons submit one form. The password field is shared between them,
 * and each button names its own `intent` — so a wrong code comes back to a page
 * that still shows the QR it was typed from, instead of throwing the enrolment
 * away and minting a second secret the authenticator app has never seen.
 */
export function TwoFactorCard({
  locale,
  armed,
  mandatory,
  hasPassword,
  recipient,
  labels,
  origin = "security",
  returnTo,
  className,
}: {
  locale: string;
  /**
   * Passed through to the card. The security section flows its cards in columns
   * rather than grid rows and sends `h-auto` to drop `Card`'s `h-full`, which
   * would otherwise stretch this one to the height of the whole section.
   */
  className?: string;
  /**
   * Which page this card is on. The gate sends an account that must enrol to
   * `/login/verify`, outside the console — a form submitted there has to come
   * back there rather than bouncing off the gate mid-enrolment.
   */
  origin?: "security" | "verify";
  /** Where to go once the factor is armed, when the gate had a destination. */
  returnTo?: string;
  armed: boolean;
  mandatory: boolean;
  /** Whether the account holds a password the gated endpoints will demand. */
  hasPassword: boolean;
  /** The masked number codes go to, or null when none is enrolled. */
  recipient: string | null;
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState<TwoFactorState, FormData>(
    manageTwoFactor,
    {},
  );
  const l = (key: string): string => labels[key] ?? key;

  const inSetup = state.step === "setup";
  const codes = state.backupCodes ?? [];

  return (
    <Card
      title={l("security.twoFactor.heading")}
      hint={l("security.twoFactor.hint")}
      className={className}
    >
      <form action={action} className="grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="origin" value={origin} />
        {returnTo ? (
          <input type="hidden" name="returnTo" value={returnTo} />
        ) : null}

        {mandatory ? (
          <Notice title={l("security.twoFactor.locked")}>
            {l("security.twoFactor.lockedHint")}
          </Notice>
        ) : null}

        {state.error ? (
          <Notice
            tone="warn"
            title={
              state.error === "password"
                ? l("security.error.password")
                : state.error === "invalidCode"
                  ? l("security.error.invalidCode")
                  : l("security.error.setupFailed")
            }
          />
        ) : null}

        <p className="text-sm font-medium">
          {armed ? l("security.twoFactor.on") : l("security.twoFactor.off")}
        </p>

        {armed ? (
          <p className="text-copy-muted text-sm">
            {recipient
              ? l("security.twoFactor.recipient").replace("{phone}", recipient)
              : l("security.twoFactor.noRecipient")}
          </p>
        ) : null}

        {/* Asked for once, above every button that needs it. Absent entirely for
            an account that signs in by emailed link and holds no password —
            there would be nothing to type. */}
        {hasPassword ? (
          <Field
            label={l("security.twoFactor.passwordLabel")}
            hint={l("security.twoFactor.passwordHint")}
          >
            <TextInput
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              className="max-w-md"
            />
          </Field>
        ) : null}

        {inSetup ? (
          <div className="border-line grid gap-5 border-t pt-5">
            <div className="grid gap-2">
              <h3 className="font-display text-ink text-base font-bold">
                {l("security.totp.heading")}
              </h3>
              <p className="text-copy-muted text-sm">
                {l("security.totp.hint")}
              </p>
            </div>
            {state.qrSvg ? (
              <div
                className="bg-surface w-fit rounded-md border p-3 [&>svg]:h-auto [&>svg]:w-[200px]"
                // Generated in this process from a value this process just
                // produced — no untrusted markup is involved.
                dangerouslySetInnerHTML={{ __html: state.qrSvg }}
              />
            ) : null}
            {state.totpUri ? (
              <Field
                label={l("security.totp.secretLabel")}
                hint={l("security.totp.secretHint")}
              >
                <TextInput
                  readOnly
                  defaultValue={
                    new URL(state.totpUri).searchParams.get("secret") ?? ""
                  }
                  dir="ltr"
                  className="max-w-md font-mono"
                />
              </Field>
            ) : null}
            <Field label={l("security.totp.codeLabel")}>
              <TextInput
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                dir="ltr"
                className="max-w-[12rem]"
              />
            </Field>
            <div>
              <PendingButton name="intent" value="confirm">
                {l("security.totp.confirm")}
              </PendingButton>
            </div>
          </div>
        ) : null}

        {codes.length > 0 ? (
          <div className="border-line grid gap-3 border-t pt-5">
            <h3 className="font-display text-ink text-base font-bold">
              {l("security.backup.heading")}
            </h3>
            <Notice tone="warn" title={l("security.backup.warn")}>
              {l("security.backup.warnHint")}
            </Notice>
            <ul className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-3">
              {codes.map((code) => (
                <li
                  key={code}
                  className="bg-surface rounded border px-2 py-1 text-center tracking-wider"
                  dir="ltr"
                >
                  {code}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {!armed && !inSetup ? (
            <PendingButton name="intent" value="start">
              {l("security.twoFactor.start")}
            </PendingButton>
          ) : null}
          {armed ? (
            <PendingButton variant="secondary" name="intent" value="regenerate">
              {l("security.backup.regenerate")}
            </PendingButton>
          ) : null}
          {/* Absent, not merely disabled, when a role mandates the factor: an
              inert button invites a click that explains nothing. The action
              refuses it regardless of what is rendered. */}
          {armed && !mandatory ? (
            <PendingButton variant="danger" name="intent" value="off">
              {l("security.twoFactor.turnOff")}
            </PendingButton>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
