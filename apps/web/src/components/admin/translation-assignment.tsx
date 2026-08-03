"use client";

import { formatMessage } from "@infokit/shared/i18n";
import { CheckCircle2, MailPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { PendingButton } from "~/components/pending-button";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SelectField } from "~/components/ui/select-field";
import { Textarea } from "~/components/ui/textarea";
import type { EditorialLanguage } from "~/lib/editorial-languages";

/**
 * Handing a language to an outside translator, and reading back what they sent.
 * The rules are the same wherever it happens — an article, an activity, an
 * organisation profile, a simulator flow — so they are stated here once, along
 * with the plainest form of the panel: one row per language, request and review.
 */

type Labels = Record<string, string>;
type Action = (formData: FormData) => Promise<void>;

/** What every screen says about an outstanding request. */
export type TranslationAssignmentSummary = {
  id: string;
  state: string;
  translatorEmail: string;
  translatorName: string | null;
  /**
   * When the link was sent, already formatted in the reader's locale. It is what
   * turns "request a translation" into "a translation was requested": an errand
   * with no date on it reads as one nobody has run yet.
   */
  requestedAt: string;
  expiresAt: string;
};

/**
 * The states a request has finished in: nothing arrived in time, an editor
 * turned the work down, or it is live. `sent` and `submitted` are not here — a
 * language already in someone's hands must not be handed to a second person.
 */
const settledStates = ["expired", "rejected", "published"];

export function canRequestTranslation({
  isSource,
  assignment,
  hasSource = true,
  disabled = false,
}: {
  isSource: boolean;
  assignment: { state: string } | null;
  /** Nothing can be translated until there is a sealed source to translate. */
  hasSource?: boolean;
  /** An archived or read-only screen offers no errands. */
  disabled?: boolean;
}) {
  if (disabled || isSource || !hasSource) return false;
  return assignment === null || settledStates.includes(assignment.state);
}

/** The translator has sent their work back and it is waiting on an editor. */
export function isAwaitingReview(assignment: { state: string } | null) {
  return assignment?.state === "submitted";
}

/**
 * A dialog that submits and then steps aside: the outcome is toasted once, and
 * it closes only when the action succeeded, so a refused request keeps the
 * address that was typed into it.
 */
export function useDialogAction(
  action: Action,
  messages: { success: string; error: string },
  /** For a dialog whose openness is owned elsewhere — a menu item, say. */
  options?: { onSuccess?: () => void },
) {
  const [open, setOpen] = useState(false);
  const showActionError = useActionErrorToast();
  const submit = async (formData: FormData) => {
    try {
      await action(formData);
      toast.success(messages.success);
      setOpen(false);
      options?.onSuccess?.();
    } catch (error) {
      showActionError(error, messages.error);
    }
  };
  return { open, setOpen, submit };
}

/** A language as the light panel needs it: is anything written, and who has it. */
export type TranslationTargetStatus = {
  code: EditorialLanguage;
  /** Whether a version already exists in this language. */
  authored: boolean;
  assignment: TranslationAssignmentSummary | null;
};

/**
 * One row per editorial language: what the record says today, and what is
 * outstanding. The source language carries no request button — everything else
 * is a target. Used where a language is only ever written or missing; a screen
 * that also publishes per language builds its rows from
 * `~/components/admin/language-publication` instead.
 */
export function TranslationAssignmentRows({
  locale,
  ownerField,
  ownerId,
  sourceLanguage,
  languages,
  labels,
  request,
  review,
  hasSource = true,
  disabled = false,
}: {
  locale: EditorialLanguage;
  /** The hidden field the record is posted as: `organizationId`, `flowId`. */
  ownerField: string;
  ownerId: string;
  sourceLanguage: string;
  languages: readonly TranslationTargetStatus[];
  labels: Labels;
  request: Action;
  review: Action;
  /** No source version sealed yet: nothing can be requested. */
  hasSource?: boolean;
  disabled?: boolean;
}) {
  return (
    <ul className="grid gap-2">
      {languages.map((language) => {
        const isSource = language.code === sourceLanguage;
        const assignment = language.assignment;
        return (
          <li
            key={language.code}
            className="border-line grid gap-3 border-b py-4 first:pt-0 last:border-b-0 last:pb-0"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">
                {labels[`language.${language.code}`] ?? language.code}
              </span>
              {isSource ? (
                <Badge variant="outline" className="text-brand">
                  {labels["translation.source"]}
                </Badge>
              ) : language.authored ? (
                <Badge variant="secondary">{labels["translation.draft"]}</Badge>
              ) : (
                <Badge variant="outline" className="text-copy-muted">
                  {labels["translation.missing"]}
                </Badge>
              )}
              {assignment ? (
                <Badge
                  variant={
                    assignment.state === "submitted" ? "default" : "outline"
                  }
                >
                  {labels[`translation.state.${assignment.state}`] ??
                    assignment.state}
                </Badge>
              ) : null}
            </div>
            {assignment ? (
              <p className="text-copy-muted text-xs">
                {formatMessage(labels["translation.active"] ?? "", {
                  email: assignment.translatorEmail,
                })}{" "}
                · {assignment.expiresAt}
              </p>
            ) : null}
            {isSource && !hasSource ? (
              <p className="text-copy-muted text-xs">
                {labels["translation.needsSource"]}
              </p>
            ) : null}
            {canRequestTranslation({
              isSource,
              assignment,
              hasSource,
              disabled,
            }) ? (
              <RequestDialog
                action={request}
                locale={locale}
                ownerField={ownerField}
                ownerId={ownerId}
                language={language.code}
                labels={labels}
              />
            ) : null}
            {!disabled && isAwaitingReview(assignment) && assignment ? (
              <AssignmentReviewDialog
                action={review}
                locale={locale}
                ownerField={ownerField}
                ownerId={ownerId}
                assignmentId={assignment.id}
                language={language.code}
                labels={labels}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Field ids are built from the record's own field name, so two panels on one
 * screen cannot label each other's inputs and nobody has to remember a prefix.
 */
function fieldId(ownerField: string, name: string, language: string) {
  return `${ownerField}-${name}-${language}`;
}

function RequestDialog({
  action,
  locale,
  ownerField,
  ownerId,
  language,
  labels,
}: {
  action: Action;
  locale: EditorialLanguage;
  ownerField: string;
  ownerId: string;
  language: EditorialLanguage;
  labels: Labels;
}) {
  const dialog = useDialogAction(action, {
    success: labels["translation.requested"] ?? "",
    error: labels["editor.saveError"] ?? "",
  });
  return (
    <Dialog open={dialog.open} onOpenChange={dialog.setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="w-fit" />}
      >
        <MailPlus aria-hidden />
        {labels["translation.request"]}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={dialog.submit}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name={ownerField} value={ownerId} />
          <input type="hidden" name="targetLanguageCode" value={language} />
          <DialogHeader>
            <DialogTitle>
              {formatMessage(labels["translation.requestTitle"] ?? "", {
                language: labels[`language.${language}`] ?? language,
              })}
            </DialogTitle>
            <DialogDescription>
              {labels["translation.requestHint"]}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-5">
            <Field>
              <FieldLabel htmlFor={fieldId(ownerField, "email", language)}>
                {labels["translation.email"]}
              </FieldLabel>
              <Input
                id={fieldId(ownerField, "email", language)}
                name="translatorEmail"
                type="email"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={fieldId(ownerField, "name", language)}>
                {labels["translation.name"]}
              </FieldLabel>
              <Input
                id={fieldId(ownerField, "name", language)}
                name="translatorName"
                maxLength={200}
              />
            </Field>
            <Field>
              <FieldLabel
                htmlFor={fieldId(ownerField, "instructions", language)}
              >
                {labels["translation.instructions"]}
              </FieldLabel>
              <Textarea
                id={fieldId(ownerField, "instructions", language)}
                name="instructions"
                rows={4}
                maxLength={2000}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={fieldId(ownerField, "expires", language)}>
                {labels["translation.expires"]}
              </FieldLabel>
              <SelectField
                id={fieldId(ownerField, "expires", language)}
                name="lifetimeHours"
                defaultValue="72"
              >
                {["24", "72", "168"].map((hours) => (
                  <option key={hours} value={hours}>
                    {labels[`translation.${hours}h`]}
                  </option>
                ))}
              </SelectField>
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {labels.cancel}
            </DialogClose>
            <PendingButton>
              <MailPlus aria-hidden />
              {labels["translation.send"]}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Reading back what a translator sent: accept it onto the record, or refuse it
 * with a reason. Both decisions post the same form, distinguished by which
 * button submitted it.
 */
export function AssignmentReviewDialog({
  action,
  locale,
  ownerField,
  ownerId,
  assignmentId,
  language,
  labels,
  open,
  onOpenChange,
}: {
  action: Action;
  locale: EditorialLanguage;
  ownerField: string;
  ownerId: string;
  assignmentId: string;
  language: EditorialLanguage;
  labels: Labels;
  /**
   * Set together to hand openness to a control that is not a trigger — a menu
   * item, which has closed by the time its dialog is needed. The trigger button
   * is then not rendered at all.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const controlled = open !== undefined && onOpenChange !== undefined;
  const dialog = useDialogAction(
    action,
    {
      success: labels["translation.reviewed"] ?? "",
      error: labels["editor.saveError"] ?? "",
    },
    { onSuccess: () => onOpenChange?.(false) },
  );
  return (
    <Dialog
      open={controlled ? open : dialog.open}
      onOpenChange={controlled ? onOpenChange : dialog.setOpen}
    >
      {controlled ? null : (
        <DialogTrigger
          render={<Button variant="outline" size="sm" className="w-fit" />}
        >
          <CheckCircle2 aria-hidden />
          {labels["translation.review"]}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <form action={dialog.submit}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name={ownerField} value={ownerId} />
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <DialogHeader>
            <DialogTitle>
              {formatMessage(labels["translation.reviewTitle"] ?? "", {
                language: labels[`language.${language}`] ?? language,
              })}
            </DialogTitle>
            <DialogDescription>
              {labels["translation.reviewHint"]}
            </DialogDescription>
          </DialogHeader>
          <div className="py-5">
            <Field>
              <FieldLabel
                htmlFor={fieldId(ownerField, "review-note", language)}
              >
                {labels["translation.reviewNote"]}
              </FieldLabel>
              <Textarea
                id={fieldId(ownerField, "review-note", language)}
                name="reviewNote"
                rows={4}
                maxLength={2000}
              />
            </Field>
          </div>
          <DialogFooter>
            <PendingButton
              variant="ghost"
              name="decision"
              value="reject"
              className="text-danger"
            >
              {labels["translation.reject"]}
            </PendingButton>
            <PendingButton name="decision" value="accept">
              {labels["translation.accept"]}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
