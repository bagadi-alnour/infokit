"use client";

import { useActionState, useState } from "react";

import {
  requestMagicLink,
  requestPasswordReset,
  signInWithPassword,
} from "~/app/[locale]/login/actions";
import { AuthStatus } from "~/components/auth/auth-status";
import { AuthTextField } from "~/components/auth/auth-text-field";
import { SubmitButton } from "~/components/auth/submit-button";
import { ActionButton } from "~/components/public/primitives";

type Mode = "password" | "magic" | "reset";
type Labels = Record<string, string>;

/**
 * One sign-in method at a time, with an explicit switch — the two methods no
 * longer compete for attention. Password mode also exposes the reset flow,
 * which re-proves identity through the same secure link + SMS gate.
 */
export function LoginForms({
  locale,
  returnTo,
  labels,
}: {
  locale: string;
  returnTo: string;
  labels: Labels;
}) {
  const [mode, setMode] = useState<Mode>("password");
  const [passwordEmail, setPasswordEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicEmail, setMagicEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPassword,
    {},
  );
  const [resetState, resetAction, resetPending] = useActionState(
    requestPasswordReset,
    {},
  );
  const [magicState, magicAction, magicPending] = useActionState(
    requestMagicLink,
    {},
  );
  const l = (key: string): string => labels[key] ?? key;

  if (mode === "reset") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          {/* Sign-in belongs to no content family, so its eyebrow takes the
              neutral metadata colour rather than a family tint (§5). */}
          <p className="text-eyebrow text-copy-muted">
            {l("auth.login.resetEyebrow")}
          </p>
          <h2 className="font-display text-ink text-xl font-bold">
            {l("auth.login.resetHeading")}
          </h2>
          <p className="text-copy-muted text-[0.95rem] leading-relaxed">
            {l("auth.login.resetDescription")}
          </p>
        </div>
        <form action={resetAction} className="flex flex-col gap-5">
          <input type="hidden" name="locale" value={locale} />
          <AuthStatus
            status={resetState.error}
            labels={{
              account_not_found: l("auth.login.accountNotFound"),
              invalid: l("auth.login.invalidEmail"),
              unavailable: l("auth.login.accountUnavailable"),
            }}
          />
          <AuthTextField
            id="reset-email"
            label={l("auth.login.emailLabel")}
            description={l("auth.login.privacy")}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            autoFocus
            placeholder={l("auth.login.emailPlaceholder")}
            value={resetEmail}
            onChange={(event) => {
              setResetEmail(event.target.value);
            }}
          />
          <SubmitButton
            label={l("auth.login.resetSubmit")}
            pendingLabel={l("auth.login.resetSubmitting")}
            pending={resetPending}
          />
        </form>
        <ActionButton
          tone="quiet"
          size="block"
          onClick={() => {
            setMode("password");
          }}
        >
          {l("auth.login.backToSignIn")}
        </ActionButton>
      </div>
    );
  }

  if (mode === "magic") {
    return (
      <div className="flex flex-col gap-5">
        <form action={magicAction} className="flex flex-col gap-5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <AuthStatus
            status={magicState.error}
            labels={{
              account_not_found: l("auth.login.accountNotFound"),
              invalid: l("auth.login.invalidEmail"),
              unavailable: l("auth.login.accountUnavailable"),
            }}
          />
          <AuthTextField
            id="magic-link-email"
            label={l("auth.login.emailLabel")}
            description={l("auth.login.privacy")}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            autoFocus
            placeholder={l("auth.login.emailPlaceholder")}
            value={magicEmail}
            onChange={(event) => {
              setMagicEmail(event.target.value);
            }}
          />
          <SubmitButton
            label={l("auth.login.magicLinkSubmit")}
            pendingLabel={l("auth.login.magicLinkSubmitting")}
            pending={magicPending}
          />
        </form>
        <ActionButton
          tone="outline"
          size="block"
          onClick={() => {
            setMode("password");
          }}
        >
          {l("auth.login.switchToPassword")}
        </ActionButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form action={passwordAction} className="flex flex-col gap-5">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <AuthStatus
          status={passwordState.error}
          labels={{
            account_not_found: l("auth.login.accountNotFound"),
            invalid_credentials: l("auth.login.invalidCredentials"),
            invalid: l("auth.login.invalidCredentials"),
          }}
        />
        <AuthTextField
          id="password-email"
          label={l("auth.login.emailLabel")}
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          aria-invalid={passwordState.error === "account_not_found"}
          required
          autoFocus
          placeholder={l("auth.login.emailPlaceholder")}
          value={passwordEmail}
          onChange={(event) => {
            setPasswordEmail(event.target.value);
          }}
        />
        <AuthTextField
          id="password"
          label={l("auth.login.passwordLabel")}
          labelAction={
            <ActionButton
              tone="quiet"
              size="compact"
              className="-me-2 min-h-9 px-2"
              onClick={() => {
                setMode("reset");
              }}
            >
              {l("auth.login.forgot")}
            </ActionButton>
          }
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={
            passwordState.error === "invalid_credentials" ||
            passwordState.error === "invalid"
          }
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          visibilityLabels={{
            show: l("auth.password.show"),
            hide: l("auth.password.hide"),
          }}
        />
        <SubmitButton
          label={l("auth.login.passwordSubmit")}
          pendingLabel={l("auth.login.passwordSubmitting")}
          pending={passwordPending}
        />
      </form>
      <ActionButton
        tone="outline"
        size="block"
        onClick={() => {
          setMode("magic");
        }}
      >
        {l("auth.login.switchToMagic")}
      </ActionButton>
    </div>
  );
}
