"use client";

import { useState } from "react";

import {
  requestMagicLink,
  requestPasswordReset,
  signInWithPassword,
} from "~/app/[locale]/login/actions";
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
  const l = (key: string): string => labels[key] ?? key;

  if (mode === "reset") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-eyebrow">{l("auth.login.resetEyebrow")}</p>
          <h2 className="font-display text-ink text-xl font-bold">
            {l("auth.login.resetHeading")}
          </h2>
          <p className="text-copy-muted text-[0.95rem] leading-relaxed">
            {l("auth.login.resetDescription")}
          </p>
        </div>
        <form action={requestPasswordReset} className="flex flex-col gap-5">
          <input type="hidden" name="locale" value={locale} />
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
          />
          <SubmitButton
            label={l("auth.login.resetSubmit")}
            pendingLabel={l("auth.login.resetSubmitting")}
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
        <form action={requestMagicLink} className="flex flex-col gap-5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="returnTo" value={returnTo} />
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
          />
          <SubmitButton
            label={l("auth.login.magicLinkSubmit")}
            pendingLabel={l("auth.login.magicLinkSubmitting")}
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
      <form action={signInWithPassword} className="flex flex-col gap-5">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <AuthTextField
          id="password-email"
          label={l("auth.login.emailLabel")}
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          autoFocus
          placeholder={l("auth.login.emailPlaceholder")}
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
          required
        />
        <SubmitButton
          label={l("auth.login.passwordSubmit")}
          pendingLabel={l("auth.login.passwordSubmitting")}
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
