"use client";

import { UserRoundPlus } from "lucide-react";
import { useId, useState } from "react";

import { StewardContactFields } from "~/components/admin/steward-contact";
import { Card } from "~/components/admin/workspace";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { SelectField } from "~/components/ui/select-field";
import { hasStewardContact } from "~/lib/steward-contact";
import type {
  StewardCandidate,
  StewardContactValues,
} from "~/lib/steward-contact";

/**
 * "Who to ask about this record", asked the way an editor answers it: pick the
 * colleague from the list, or write somebody in.
 *
 * The people the platform can already name are a dropdown, not a column of
 * buttons: the contact is nearly always one of them, and one line of menu says
 * so without taking the panel. Typing somebody else in is a deliberate second
 * step behind "add contact" — which is also the only state a record with no
 * candidates at all can be in.
 *
 * It renders inputs and nothing else, so it drops into a form that saves the
 * whole record (the event editor) or into one that saves this contact alone
 * (`StewardContactForm`). Either way what gets posted is the same three fields,
 * so choosing somebody is a shortcut for typing, not a second way of saving.
 */
export function StewardContactPicker({
  values,
  members,
  labels,
  columns,
  formId,
}: {
  values: StewardContactValues;
  /**
   * The people the platform can already name, offered before the free text: the
   * custodian organisation's roster, and whoever entered the record. Typing a
   * colleague's name and address by hand is how a wrong address gets recorded.
   *
   * May change while the form is open — the event editor chooses its host
   * organisation on the same screen — so the list is read on every render and
   * nothing about the draft is derived from it once and kept.
   */
  members: readonly StewardCandidate[];
  /** The shared console catalogue — the wording is the same everywhere. */
  labels: Record<string, string>;
  /** Phone and email side by side; off in a narrow column. */
  columns?: boolean;
  /** Associate these inputs with a form elsewhere on the page. */
  formId?: string;
}) {
  const label = (key: string) => labels[key] ?? key;
  const selectId = useId();
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
   * is still the three values.
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
  const [addingPerson, setAddingPerson] = useState(false);
  /**
   * The fields are open when there is nobody to choose from, when the editor
   * asked for them, and when what is recorded is not one of the candidates — a
   * duty line, a colleague with no account, or a contact kept from before the
   * host organisation was changed. Hiding a saved contact behind a button would
   * read as "nobody to ask", which is the one thing this panel must never say by
   * accident, so this is derived rather than remembered.
   */
  const expanded =
    addingPerson ||
    members.length === 0 ||
    (hasStewardContact(draft) && !chosen);

  return (
    <>
      {members.length > 0 ? (
        <Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FieldLabel htmlFor={selectId}>{heading}</FieldLabel>
            {expanded ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAddingPerson(true);
                }}
              >
                <UserRoundPlus aria-hidden />
                {label("steward.addContact")}
              </Button>
            )}
          </div>
          <SelectField
            id={selectId}
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
                {/* The address is on the line because two colleagues share a
                 * first name more often than they share a mailbox, and because
                 * the whole point of choosing somebody is the address that
                 * comes with them: it should be readable before the pick, not
                 * only after. */}
                {[
                  member.name,
                  member.source === "author"
                    ? label("steward.author")
                    : member.title,
                  member.email,
                ]
                  .filter((part) => part !== "")
                  .join(" · ")}
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
          onChange={(patch) => {
            setDraft((current) => ({ ...current, ...patch }));
          }}
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
}

/**
 * The same control as its own form section, for an editor that saves the whole
 * record in one submit — the event form, where the contact is one card among
 * four rather than a panel with a Save of its own.
 */
export function StewardContactCard({
  values,
  members = [],
  labels,
}: {
  values: StewardContactValues;
  /**
   * The people the record's custodian organisation can name. Empty — a host
   * with no roster at all — simply leaves the free-text fields open.
   */
  members?: readonly StewardCandidate[];
  labels: Record<string, string>;
}) {
  const label = (key: string) => labels[key] ?? key;
  return (
    <Card title={label("steward.title")} hint={label("steward.hint")}>
      <div className="grid gap-4">
        <StewardContactPicker
          values={values}
          members={members}
          labels={labels}
        />
      </div>
    </Card>
  );
}
