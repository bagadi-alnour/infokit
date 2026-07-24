"use client";

import { ActionButton, AuthTextField, Paragraph, YStack } from "@calais/ui";
import { useState } from "react";

import {
  requestMagicLink,
  requestPasswordReset,
  signInWithPassword,
} from "~/app/[locale]/login/actions";
import { SubmitButton } from "~/components/auth/submit-button";

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
      <YStack gap="$calais5">
        <YStack gap="$calais2">
          <Paragraph
            fontSize="$2"
            fontWeight="700"
            letterSpacing={0.6}
            textTransform="uppercase"
            color="$mutedText"
          >
            {l("auth.login.resetEyebrow")}
          </Paragraph>
          <Paragraph fontSize="$6" fontWeight="700">
            {l("auth.login.resetHeading")}
          </Paragraph>
          <Paragraph fontSize="$3" color="$mutedText">
            {l("auth.login.resetDescription")}
          </Paragraph>
        </YStack>
        <form action={requestPasswordReset}>
          <input type="hidden" name="locale" value={locale} />
          <YStack gap="$calais5">
            <AuthTextField
              id="reset-email"
              label={l("auth.login.emailLabel")}
              description={l("auth.login.privacy")}
              inputProps={{
                name: "email",
                type: "email",
                autoComplete: "email",
                inputMode: "email",
                required: true,
                autoFocus: true,
                placeholder: l("auth.login.emailPlaceholder"),
              }}
            />
            <SubmitButton
              label={l("auth.login.resetSubmit")}
              pendingLabel={l("auth.login.resetSubmitting")}
            />
          </YStack>
        </form>
        <ActionButton
          type="button"
          tone="ghost"
          width="100%"
          onPress={() => {
            setMode("password");
          }}
        >
          {l("auth.login.backToSignIn")}
        </ActionButton>
      </YStack>
    );
  }

  if (mode === "magic") {
    return (
      <YStack gap="$calais5">
        <form action={requestMagicLink}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <YStack gap="$calais5">
            <AuthTextField
              id="magic-link-email"
              label={l("auth.login.emailLabel")}
              description={l("auth.login.privacy")}
              inputProps={{
                name: "email",
                type: "email",
                autoComplete: "email",
                inputMode: "email",
                required: true,
                autoFocus: true,
                placeholder: l("auth.login.emailPlaceholder"),
              }}
            />
            <SubmitButton
              label={l("auth.login.magicLinkSubmit")}
              pendingLabel={l("auth.login.magicLinkSubmitting")}
            />
          </YStack>
        </form>
        <ActionButton
          type="button"
          tone="outline"
          width="100%"
          onPress={() => {
            setMode("password");
          }}
        >
          {l("auth.login.switchToPassword")}
        </ActionButton>
      </YStack>
    );
  }

  return (
    <YStack gap="$calais5">
      <form action={signInWithPassword}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <YStack gap="$calais5">
          <AuthTextField
            id="password-email"
            label={l("auth.login.emailLabel")}
            inputProps={{
              name: "email",
              type: "email",
              autoComplete: "username",
              inputMode: "email",
              required: true,
              autoFocus: true,
              placeholder: l("auth.login.emailPlaceholder"),
            }}
          />
          <AuthTextField
            id="password"
            label={l("auth.login.passwordLabel")}
            labelAction={
              <ActionButton
                type="button"
                tone="ghost"
                minHeight={32}
                paddingHorizontal="$calais2"
                onPress={() => {
                  setMode("reset");
                }}
              >
                {l("auth.login.forgot")}
              </ActionButton>
            }
            inputProps={{
              name: "password",
              type: "password",
              autoComplete: "current-password",
              required: true,
            }}
          />
          <SubmitButton
            label={l("auth.login.passwordSubmit")}
            pendingLabel={l("auth.login.passwordSubmitting")}
          />
        </YStack>
      </form>
      <YStack gap="$calais3" alignItems="center">
        <ActionButton
          type="button"
          tone="outline"
          width="100%"
          onPress={() => {
            setMode("magic");
          }}
        >
          {l("auth.login.switchToMagic")}
        </ActionButton>
      </YStack>
    </YStack>
  );
}
