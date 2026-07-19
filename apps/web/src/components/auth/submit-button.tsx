"use client";

import { ActionButton, PendingActionLabel } from "@calais/ui";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  label,
  pendingLabel,
  tone = "primary",
}: {
  label: string;
  pendingLabel: string;
  tone?: "primary" | "outline" | "ghost";
}) {
  const { pending } = useFormStatus();
  return (
    <ActionButton
      type="submit"
      tone={tone}
      width="100%"
      disabled={pending}
      aria-disabled={pending}
    >
      <PendingActionLabel
        pending={pending}
        label={label}
        pendingLabel={pendingLabel}
        tone={tone}
      />
    </ActionButton>
  );
}
