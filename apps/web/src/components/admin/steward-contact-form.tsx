"use client";

import { Check, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { StewardContactFields } from "~/components/admin/steward-contact";
import { PendingButton } from "~/components/pending-button";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
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
}: {
  action: (formData: FormData) => Promise<void>;
  locale: string;
  recordId: string;
  values: StewardContactValues;
  /** The shared console catalogue — the wording is the same everywhere. */
  labels: Record<string, string>;
  columns?: boolean;
  /**
   * The custodian organisation's own people, offered before the free text: the
   * contact is nearly always one of them, and typing a colleague's name and
   * address by hand is how a wrong address gets recorded.
   */
  members?: StewardCandidate[];
}) {
  const showActionError = useActionErrorToast();
  /**
   * Held in state only because the member list writes it too. What the action
   * reads is still the three inputs, so a member choice is a shortcut for
   * typing, not a second way of saving.
   */
  const [draft, setDraft] = useState(values);
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
      {members.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">
            {labels["steward.members"] ?? "steward.members"}
          </p>
          <ul className="grid gap-2">
            {members.map((member) => {
              const chosen =
                draft.stewardName === member.name &&
                (member.email === null || draft.stewardEmail === member.email);
              return (
                <li key={member.id}>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-auto w-full justify-start gap-3 px-3 py-2 text-start",
                      chosen && "border-brand bg-brand-soft",
                    )}
                    aria-pressed={chosen}
                    onClick={() => {
                      setDraft((current) => ({
                        ...current,
                        stewardName: member.name,
                        stewardEmail: member.email ?? current.stewardEmail,
                      }));
                    }}
                  >
                    {chosen ? (
                      <Check
                        className="text-brand size-4 shrink-0"
                        aria-hidden
                      />
                    ) : (
                      <UserRound
                        className="text-copy-muted size-4 shrink-0"
                        aria-hidden
                      />
                    )}
                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate text-sm font-medium">
                        {member.name}
                        {member.title ? (
                          <span className="text-copy-muted font-normal">
                            {" · "}
                            {member.title}
                          </span>
                        ) : null}
                      </span>
                      {member.email ? (
                        <span className="text-copy-muted truncate text-xs">
                          {member.email}
                        </span>
                      ) : null}
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
          {/* The fields below stay editable: the phone is nowhere in a
           * membership record, and the person to ask is not always a member. */}
          <p className="text-copy-muted text-xs">
            {labels["steward.membersHint"] ?? "steward.membersHint"}
          </p>
        </div>
      ) : null}
      <StewardContactFields
        values={draft}
        labels={labels}
        columns={columns}
        // Uncontrolled unless the member list is there to write them too.
        onChange={
          members.length > 0
            ? (patch) => {
                setDraft((current) => ({ ...current, ...patch }));
              }
            : undefined
        }
      />
      <div>
        <PendingButton>
          {labels["steward.save"] ?? "steward.save"}
        </PendingButton>
      </div>
    </form>
  );
}
