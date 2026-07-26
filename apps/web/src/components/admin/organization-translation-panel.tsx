"use client";

import { CheckCircle2, MailPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  requestOrganizationTranslation,
  reviewOrganizationTranslation,
} from "~/app/[locale]/dashboard/organizations/translation-actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { PendingButton } from "~/components/pending-button";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SelectField } from "~/components/ui/select-field";
import { Textarea } from "~/components/ui/textarea";
import type { EditorialLanguage } from "~/lib/editorial-languages";

type Labels = Record<string, string>;

export interface OrganizationLanguageStatus {
  code: EditorialLanguage;
  /** Whether a narrative already exists in this language. */
  authored: boolean;
  assignment: {
    id: string;
    state: string;
    translatorEmail: string;
    translatorName: string | null;
    expiresAt: string;
  } | null;
}

/**
 * One row per editorial language: what the profile says today, and what is
 * outstanding. The source language carries no request button — everything else
 * is a target, exactly as on an article or an activity.
 */
export function OrganizationTranslationPanel({
  locale,
  organizationId,
  sourceLanguage,
  languages,
  labels,
  /** No source version sealed yet: nothing can be requested. */
  hasSource,
  disabled = false,
}: {
  locale: EditorialLanguage;
  organizationId: string;
  sourceLanguage: string;
  languages: OrganizationLanguageStatus[];
  labels: Labels;
  hasSource: boolean;
  disabled?: boolean;
}) {
  return (
    <ul className="grid gap-2">
      {languages.map((language) => {
        const isSource = language.code === sourceLanguage;
        const assignment = language.assignment;
        const canRequest =
          !disabled &&
          !isSource &&
          hasSource &&
          (!assignment ||
            ["expired", "rejected", "published"].includes(assignment.state));
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
                {(labels["translation.active"] ?? "").replace(
                  "{email}",
                  assignment.translatorEmail,
                )}{" "}
                · {assignment.expiresAt}
              </p>
            ) : null}
            {isSource && !hasSource ? (
              <p className="text-copy-muted text-xs">
                {labels["translation.needsSource"]}
              </p>
            ) : null}
            {canRequest ? (
              <RequestDialog
                locale={locale}
                organizationId={organizationId}
                language={language.code}
                labels={labels}
              />
            ) : null}
            {!disabled && assignment?.state === "submitted" ? (
              <ReviewDialog
                locale={locale}
                organizationId={organizationId}
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

function RequestDialog({
  locale,
  organizationId,
  language,
  labels,
}: {
  locale: EditorialLanguage;
  organizationId: string;
  language: EditorialLanguage;
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);
  const showActionError = useActionErrorToast();
  const submit = async (formData: FormData) => {
    try {
      await requestOrganizationTranslation(formData);
      toast.success(labels["translation.requested"]);
      setOpen(false);
    } catch (error) {
      showActionError(error, labels["editor.saveError"] ?? "");
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="w-fit" />}
      >
        <MailPlus aria-hidden />
        {labels["translation.request"]}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={submit}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="targetLanguageCode" value={language} />
          <DialogHeader>
            <DialogTitle>
              {(labels["translation.requestTitle"] ?? "").replace(
                "{language}",
                labels[`language.${language}`] ?? language,
              )}
            </DialogTitle>
            <DialogDescription>
              {labels["translation.requestHint"]}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-5">
            <Field>
              <FieldLabel htmlFor={`org-translator-email-${language}`}>
                {labels["translation.email"]}
              </FieldLabel>
              <Input
                id={`org-translator-email-${language}`}
                name="translatorEmail"
                type="email"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`org-translator-name-${language}`}>
                {labels["translation.name"]}
              </FieldLabel>
              <Input
                id={`org-translator-name-${language}`}
                name="translatorName"
                maxLength={200}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`org-translator-instructions-${language}`}>
                {labels["translation.instructions"]}
              </FieldLabel>
              <Textarea
                id={`org-translator-instructions-${language}`}
                name="instructions"
                rows={4}
                maxLength={2000}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`org-translator-expires-${language}`}>
                {labels["translation.expires"]}
              </FieldLabel>
              <SelectField
                id={`org-translator-expires-${language}`}
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

function ReviewDialog({
  locale,
  organizationId,
  assignmentId,
  language,
  labels,
}: {
  locale: EditorialLanguage;
  organizationId: string;
  assignmentId: string;
  language: EditorialLanguage;
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);
  const showActionError = useActionErrorToast();
  const submit = async (formData: FormData) => {
    try {
      await reviewOrganizationTranslation(formData);
      toast.success(labels["translation.reviewed"]);
      setOpen(false);
    } catch (error) {
      showActionError(error, labels["editor.saveError"] ?? "");
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="w-fit" />}
      >
        <CheckCircle2 aria-hidden />
        {labels["translation.review"]}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={submit}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <DialogHeader>
            <DialogTitle>
              {(labels["translation.reviewTitle"] ?? "").replace(
                "{language}",
                labels[`language.${language}`] ?? language,
              )}
            </DialogTitle>
            <DialogDescription>
              {labels["translation.reviewHint"]}
            </DialogDescription>
          </DialogHeader>
          <div className="py-5">
            <Field>
              <FieldLabel htmlFor={`org-review-note-${language}`}>
                {labels["translation.reviewNote"]}
              </FieldLabel>
              <Textarea
                id={`org-review-note-${language}`}
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
