"use client";

import { useFormStatus } from "react-dom";

import { buttonVariants } from "~/components/ui";

/**
 * Submit button with built-in pending feedback — every one-tap action in
 * the console responds instantly (aria-busy + dimmed) while the server
 * action runs, keeping the workflow fluid without client state.
 */
export function PendingButton({
  variant = "primary",
  className = "",
  children,
}: {
  variant?: keyof typeof buttonVariants;
  className?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      aria-busy={pending}
      className={`rounded-[10px] px-3 py-1.5 text-sm font-semibold transition-opacity disabled:opacity-50 ${buttonVariants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
