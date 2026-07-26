"use client";

import { toast } from "sonner";

import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { StewardContactFields } from "~/components/admin/steward-contact";
import { PendingButton } from "~/components/pending-button";
import type { StewardContactValues } from "~/lib/steward-contact";

/**
 * The "who to ask about this record" contact as its own small form, for the
 * editors where the record's main form is already long or split into several
 * (activities, editorial entries, organisation profiles, simulator flows).
 * Saving it on its own means recording a phone number never means re-submitting
 * a whole article.
 *
 * The action is passed in so each content type keeps its own permission gate;
 * the record id travels as `recordId`, which is what every steward action reads.
 */
export function StewardContactForm({
  action,
  locale,
  recordId,
  values,
  labels,
  columns,
}: {
  action: (formData: FormData) => Promise<void>;
  locale: string;
  recordId: string;
  values: StewardContactValues;
  /** The shared console catalogue — the wording is the same everywhere. */
  labels: Record<string, string>;
  columns?: boolean;
}) {
  const showActionError = useActionErrorToast();
  const submit = async (formData: FormData) => {
    try {
      await action(formData);
      toast.success(labels["steward.saved"] ?? "steward.saved");
    } catch (error) {
      showActionError(
        error,
        labels["steward.saveError"] ?? "steward.saveError",
      );
    }
  };
  return (
    <form action={submit} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="recordId" value={recordId} />
      <StewardContactFields values={values} labels={labels} columns={columns} />
      <div>
        <PendingButton>
          {labels["steward.save"] ?? "steward.save"}
        </PendingButton>
      </div>
    </form>
  );
}
