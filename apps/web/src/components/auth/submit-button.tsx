"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { ActionButton } from "~/components/public/primitives";

const TONES = {
  primary: "solid",
  outline: "outline",
  ghost: "quiet",
} as const;

/**
 * The pending label replaces the label rather than sitting beside it, so the
 * button never changes width mid-submit. The spinner disappears entirely under
 * reduced motion (globals.css kills animations first).
 */
export function SubmitButton({
  label,
  pendingLabel,
  tone = "primary",
}: {
  label: string;
  pendingLabel: string;
  tone?: keyof typeof TONES;
}) {
  const { pending } = useFormStatus();
  return (
    <ActionButton
      type="submit"
      tone={TONES[tone]}
      size="block"
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? (
        <Loader2
          className="size-4 animate-spin motion-reduce:hidden"
          aria-hidden
        />
      ) : null}
      {pending ? pendingLabel : label}
    </ActionButton>
  );
}
