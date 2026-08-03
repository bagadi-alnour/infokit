"use client";

import { unstable_rethrow } from "next/navigation";
import type { ComponentProps } from "react";
import { toast } from "sonner";

import { useActionErrorToast } from "~/components/admin/admin-ui-provider";

type FormProps = Omit<ComponentProps<"form">, "action" | "children">;

/**
 * A native server-action form that reports the completed outcome.
 *
 * PendingButton owns the immediate "working" state inside the form; this
 * wrapper owns the durable result after the server responds. Redirects still
 * belong to Next.js (including the shared permission-denied notice).
 */
export function ActionFeedbackForm({
  action,
  successMessage,
  successMessageField,
  successMessages,
  errorMessage,
  onSuccess,
  children,
  ...formProps
}: FormProps & {
  action: (formData: FormData) => Promise<unknown>;
  successMessage: string;
  /** Pick more precise confirmation copy from the submitted button's value. */
  successMessageField?: string;
  successMessages?: Record<string, string>;
  errorMessage: string;
  onSuccess?: () => void;
  children: React.ReactNode;
}) {
  const showActionError = useActionErrorToast();

  const submit = async (formData: FormData) => {
    try {
      await action(formData);
      const submittedValue = successMessageField
        ? formData.get(successMessageField)
        : null;
      const resolvedSuccess =
        typeof submittedValue === "string"
          ? (successMessages?.[submittedValue] ?? successMessage)
          : successMessage;
      toast.success(resolvedSuccess);
      onSuccess?.();
    } catch (error) {
      unstable_rethrow(error);
      showActionError(error, errorMessage);
    }
  };

  return (
    <form action={submit} {...formProps}>
      {children}
    </form>
  );
}
