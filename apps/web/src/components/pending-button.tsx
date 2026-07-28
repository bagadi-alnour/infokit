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
 *
 * `useFormStatus` only reports on a form that posts to a server action
 * directly. A form validated by React Hook Form submits through its own
 * handler, so it passes `pending` instead — same feedback, either way.
 */
export function PendingButton({
  variant = "primary",
  className = "",
  name,
  value,
  disabled = false,
  pending: pendingProp = false,
  title,
  "aria-label": ariaLabel,
  children,
}: {
  variant?: WorkspaceButtonVariant;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
  pending?: boolean;
  /** Hover explanation of a short or icon-only label. */
  title?: string;
  /**
   * The button's name when its content is an icon. Named explicitly because the
   * props here are a list, not a spread: an `aria-label` passed to a component
   * that does not read it is dropped without a word from the type checker, and
   * the control ships with no name at all.
   */
  "aria-label"?: string;
  children: React.ReactNode;
}) {
  const status = useFormStatus();
  const pending = status.pending || pendingProp;
  return (
    <Button
      disabled={pending || disabled}
      aria-busy={pending}
      aria-label={ariaLabel}
      title={title}
      variant={variant}
      className={className}
      name={name}
      value={value}
    >
      {children}
    </Button>
  );
}
