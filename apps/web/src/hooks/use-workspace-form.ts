"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { unstable_rethrow } from "next/navigation";
import { useMemo, useRef, type ComponentProps, type RefObject } from "react";
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { DefaultValues, Mode } from "react-hook-form";
import type { z } from "zod";

import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import {
  formMessages,
  type FormMessages,
  type Labels,
} from "~/lib/form-messages";

/**
 * The console's form runtime: React Hook Form for values and validation, the
 * existing server actions for saving.
 *
 * The actions stay `FormData`-shaped. Every workspace control already renders a
 * native named input — a hidden input for `SearchableSelect` and `DatePicker`,
 * a real one for text and time — so the browser can still build exactly the
 * `FormData` an action expects while React Hook Form owns the typed values, the
 * error state and the pending state. That keeps a large action file untouched
 * and lets a form migrate one field at a time: an uncontrolled child (the
 * translation workspace, the attachment rails) keeps posting its own inputs
 * without knowing a form library exists.
 */

/**
 * A form schema whose parsed output is the shape the form holds.
 *
 * Client schemas describe what the controls contain — strings, mostly — and
 * never transform: the server action re-parses the post and owns coercion, so a
 * transform here would only give the two sides different ideas of the same
 * field.
 */
export type WorkspaceFormSchema<TValues extends FieldValues> = z.ZodType<
  TValues,
  z.ZodTypeDef,
  TValues
>;

/** Memoize the shared validation wording so schemas keep a stable identity. */
export function useFormMessages(labels: Labels): FormMessages {
  return useMemo(() => formMessages(labels), [labels]);
}

/**
 * `useForm` with the console's defaults: validate on blur and on change once a
 * field has been touched, so an editor filling a long form is corrected as they
 * leave a field rather than scolded as they type.
 */
export function useWorkspaceForm<TValues extends FieldValues>({
  schema,
  defaultValues,
  mode = "onTouched",
}: {
  schema: WorkspaceFormSchema<TValues>;
  defaultValues: DefaultValues<TValues>;
  mode?: Mode;
}): UseFormReturn<TValues> {
  return useForm<TValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode,
  });
}

/** A server action called with the `FormData` the form element produces. */
export type ServerFormAction<TResult> = (
  formData: FormData,
) => Promise<TResult>;

/** Taken from the element rather than named, so React owns the event's type. */
type FormSubmitHandler = NonNullable<ComponentProps<"form">["onSubmit"]>;

export type ServerFormBinding = {
  /**
   * Spread onto the `<form>`: the ref that reads the post, the submit handler
   * that gates on validity, and `noValidate` so the browser's own bubbles stay
   * out of the way of the field-level errors.
   */
  formProps: {
    ref: RefObject<HTMLFormElement | null>;
    noValidate: true;
    onSubmit: FormSubmitHandler;
  };
};

/**
 * Post a validated form to a server action.
 *
 * The submit is gated on React Hook Form's validity, then the `FormData` is
 * read straight off the form element: what the action receives is what the
 * markup says, not a re-serialization of the client's idea of it.
 *
 * Errors keep today's semantics — `unstable_rethrow` first so a redirect or a
 * `notFound` still navigates, then the shared toast, which turns a denied
 * permission into its own message.
 */
export function useServerFormAction<TValues extends FieldValues, TResult>({
  form,
  action,
  errorMessage,
  invalidMessage,
  onSuccess,
}: {
  form: UseFormReturn<TValues>;
  action: ServerFormAction<TResult>;
  /** Toast copy when the action fails for a reason no field can explain. */
  errorMessage: string;
  /**
   * Toast copy when submit is blocked by an invalid field. Worth passing on
   * forms with collapsed sections, where focusing the field shows nothing.
   */
  invalidMessage?: string;
  /** Runs after the action resolves, with whatever it returned. */
  onSuccess?: (result: TResult, formData: FormData) => void;
}): ServerFormBinding {
  const formRef = useRef<HTMLFormElement | null>(null);
  const showActionError = useActionErrorToast();

  const submit = form.handleSubmit(
    async () => {
      const element = formRef.current;
      if (!element) return;
      const formData = new FormData(element);
      try {
        const result = await action(formData);
        onSuccess?.(result, formData);
      } catch (error) {
        unstable_rethrow(error);
        showActionError(error, errorMessage);
      }
    },
    () => {
      if (invalidMessage) toast.error(invalidMessage);
    },
  );

  return {
    formProps: {
      ref: formRef,
      noValidate: true,
      onSubmit: (event) => {
        void submit(event);
      },
    },
  };
}
