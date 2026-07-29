"use client";

import { UserRoundPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { StewardContactFields } from "~/components/admin/steward-contact";
import { PendingButton } from "~/components/pending-button";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { SelectField } from "~/components/ui/select-field";
import { hasStewardContact } from "~/lib/steward-contact";
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
 * The list of people the platform can already name is a dropdown, not a column
 * of buttons: the contact is nearly always one of them, and one line of menu
 * says so without taking the panel. Typing somebody else in is a deliberate
 * second step behind "add contact" — which is also the only state a record with
 * no candidates at all can be in.
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
  /**
   * "Someone in this organisation" is only true of a roster; once the record's
   * own author is in the list — which is the whole list for a record the
   * platform holds — the heading has to be the neutral one.
   */
  const heading = members.some((candidate) => candidate.source === "author")
    ? label("steward.candidates")
    : label("steward.members");
  /**
   * Held in state only because the dropdown writes it too. What the action reads
   * is still the three values, so choosing somebody is a shortcut for typing,
   * not a second way of saving.
   */
  const [draft, setDraft] = useState(values);
  // An unset field reads as null here and as "" on a candidate the platform
  // holds no number for; they mean the same thing, so a saved contact still
  // shows as the chosen one on reload.
  const same = (value: string | null, candidate: string) =>
    (value ?? "") === candidate;
  const chosen = members.find(
    (member) =>
      same(draft.stewardName, member.name) &&
      same(draft.stewardEmail, member.email) &&
      same(draft.stewardPhone, member.phone),
  );
  /**
   * The fields open when there is nobody to choose from, and when what is
   * recorded is not one of the candidates — a duty line, or a colleague who has
   * no account. Hiding a saved contact behind a button would read as "nobody to
   * ask", which is the one thing this panel must never say by accident.
   */
  const [expanded, setExpanded] = useState(
    members.length === 0 || (hasStewardContact(draft) && !chosen),
  );
  const submit = async (formData: FormData) => {
    try {
      await action(formData);
      toast.success(label("steward.saved"));
    } catch (error) {
      showActionError(error, label("steward.saveError"));
    }
  };
  const fields = (
    <>
      {members.length > 0 ? (
        <Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FieldLabel htmlFor={`steward-candidate-${recordId}`}>
              {heading}
            </FieldLabel>
            {expanded ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setExpanded(true);
                }}
              >
                <UserRoundPlus aria-hidden />
                {label("steward.addContact")}
              </Button>
            )}
          </div>
          <SelectField
            id={`steward-candidate-${recordId}`}
            value={chosen?.id ?? ""}
            onValueChange={(next) => {
              const member = members.find((candidate) => candidate.id === next);
              if (!member) return;
              setDraft((current) => ({
                ...current,
                stewardName: member.name,
                stewardEmail: member.email,
                stewardPhone: member.phone,
              }));
            }}
          >
            <option value="">{label("steward.choose")}</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {`${member.name} · ${
                  member.source === "author"
                    ? label("steward.author")
                    : member.title
                }`}
              </option>
            ))}
          </SelectField>
          <FieldDescription>{label("steward.membersHint")}</FieldDescription>
        </Field>
      ) : null}
      {expanded ? (
        <StewardContactFields
          values={draft}
          labels={labels}
          columns={columns}
          formId={formId}
          // Uncontrolled unless the dropdown is there to write them too.
          onChange={
            members.length > 0
              ? (patch) => {
                  setDraft((current) => ({ ...current, ...patch }));
                }
              : undefined
          }
        />
      ) : (
        /* Collapsed, the chosen candidate is what gets saved: the three values
         * still post, so the form's Save means the same thing either way. */
        <>
          <input
            type="hidden"
            name="stewardName"
            form={formId}
            value={draft.stewardName ?? ""}
          />
          <input
            type="hidden"
            name="stewardPhone"
            form={formId}
            value={draft.stewardPhone ?? ""}
          />
          <input
            type="hidden"
            name="stewardEmail"
            form={formId}
            value={draft.stewardEmail ?? ""}
          />
        </>
      )}
    </>
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
