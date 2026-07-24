"use client";

import { useFormStatus } from "react-dom";

import {
  Button,
  type WorkspaceButtonVariant,
} from "~/components/admin/workspace";

/**
 * Submit button with built-in pending feedback — every one-tap action in
 * the console responds instantly (aria-busy + dimmed) while the server
 * action runs, keeping the workflow fluid without client state.
 */
export function PendingButton({
  variant = "primary",
  className = "",
  name,
  value,
  disabled = false,
  children,
}: {
  variant?: WorkspaceButtonVariant;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      disabled={pending || disabled}
      aria-busy={pending}
      variant={variant}
      className={className}
      name={name}
      value={value}
    >
      {children}
    </Button>
  );
}
