"use client";

import { useState } from "react";

import { AuthTextField } from "~/components/auth/auth-text-field";
import {
  PasswordStrength,
  type PasswordStrengthLabels,
} from "~/components/auth/password-strength";

export function PasswordCreationFields({
  idPrefix,
  passwordLabel,
  confirmationLabel,
  showPasswordLabel,
  hidePasswordLabel,
  strengthLabels,
}: {
  idPrefix: string;
  passwordLabel: string;
  confirmationLabel: string;
  showPasswordLabel: string;
  hidePasswordLabel: string;
  strengthLabels: PasswordStrengthLabels;
}) {
  const [password, setPassword] = useState("");
  const visibilityLabels = {
    show: showPasswordLabel,
    hide: hidePasswordLabel,
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        <AuthTextField
          id={`${idPrefix}-password`}
          label={passwordLabel}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          visibilityLabels={visibilityLabels}
        />
        <PasswordStrength password={password} labels={strengthLabels} />
      </div>
      <AuthTextField
        id={`${idPrefix}-password-confirmation`}
        label={confirmationLabel}
        name="passwordConfirmation"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
        required
        visibilityLabels={visibilityLabels}
      />
    </>
  );
}
