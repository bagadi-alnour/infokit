"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { ControlField, TextInput } from "~/components/admin/workspace";
import {
  PasswordStrength,
  type PasswordStrengthLabels,
} from "~/components/auth/password-strength";
import { Button } from "~/components/ui/button";

function PasswordInput({
  id,
  name,
  value,
  onChange,
  showLabel,
  hideLabel,
}: {
  id: string;
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  showLabel: string;
  hideLabel: string;
}) {
  const [visible, setVisible] = useState(false);
  const visibilityLabel = visible ? hideLabel : showLabel;

  return (
    <div className="relative">
      <TextInput
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
        required
        value={value}
        onChange={
          onChange
            ? (event) => {
                onChange(event.target.value);
              }
            : undefined
        }
        className="pe-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute inset-y-0 end-0"
        aria-label={visibilityLabel}
        aria-pressed={visible}
        title={visibilityLabel}
        onClick={() => {
          setVisible((current) => !current);
        }}
      >
        {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </Button>
    </div>
  );
}

export function AdminPasswordCreationFields({
  passwordLabel,
  confirmationLabel,
  showPasswordLabel,
  hidePasswordLabel,
  strengthLabels,
}: {
  passwordLabel: string;
  confirmationLabel: string;
  showPasswordLabel: string;
  hidePasswordLabel: string;
  strengthLabels: PasswordStrengthLabels;
}) {
  const [password, setPassword] = useState("");

  return (
    <>
      <div className="grid gap-3">
        <ControlField label={passwordLabel} htmlFor="account-password">
          <PasswordInput
            id="account-password"
            name="password"
            value={password}
            onChange={setPassword}
            showLabel={showPasswordLabel}
            hideLabel={hidePasswordLabel}
          />
        </ControlField>
        <PasswordStrength password={password} labels={strengthLabels} />
      </div>
      <ControlField
        label={confirmationLabel}
        htmlFor="account-password-confirmation"
      >
        <PasswordInput
          id="account-password-confirmation"
          name="passwordConfirmation"
          showLabel={showPasswordLabel}
          hideLabel={hidePasswordLabel}
        />
      </ControlField>
    </>
  );
}
