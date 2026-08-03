"use client";

import { toast } from "sonner";

import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { StewardContactPicker } from "~/components/admin/steward-contact-picker";
import { PendingButton } from "~/components/pending-button";
import type {
  StewardCandidate,
  StewardContactValues,
} from "~/lib/steward-contact";

/**
 * The "who to ask about this record" contact as its own small form, for the
 * editors where the record's main form is already long or split into several
 * (activities, editorial entries, organisation profiles, simulator flows).
 * Saving it on its own means recording a phone number never means re-submitting
 * a whole article.
 *
 * The fieldset itself is `StewardContactPicker`, the same control the event
 * editor embeds in its own form: pick a colleague from the list, or write
 * somebody in.
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
  members = [],
  embedded = false,
  formId,
}: {
  action: (formData: FormData) => Promise<void>;
  locale: string;
  recordId: string;
  values: StewardContactValues;
  /** The shared console catalogue — the wording is the same everywhere. */
  labels: Record<string, string>;
  columns?: boolean;
  /**
   * The people the platform can already name, offered before the free text: the
   * custodian organisation's roster, and whoever entered the record. The contact
   * is nearly always one of them, and typing a colleague's name and address by
   * hand is how a wrong address gets recorded.
   */
  members?: StewardCandidate[];
  /** Render only fields, associated with the activity editor's single form. */
  embedded?: boolean;
  formId?: string;
}) {
  const showActionError = useActionErrorToast();
  const label = (key: string) => labels[key] ?? key;
  const submit = async (formData: FormData) => {
    try {
      await action(formData);
      toast.success(label("steward.saved"));
    } catch (error) {
      showActionError(error, label("steward.saveError"));
    }
  };
  const fields = (
    <StewardContactPicker
      values={values}
      members={members}
      labels={labels}
      columns={columns}
      formId={formId}
    />
  );

  if (embedded) return <div className="grid gap-4">{fields}</div>;

  return (
    <form action={submit} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="recordId" value={recordId} />
      {fields}
      <div>
        <PendingButton>{label("steward.save")}</PendingButton>
      </div>
    </form>
  );
}
