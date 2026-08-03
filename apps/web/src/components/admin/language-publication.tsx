"use client";

import { formatMessage, type Locale } from "@infokit/shared/i18n";
import { CalendarClock, CheckCircle2, Globe, MailPlus } from "lucide-react";

import { SchedulePublicationDialog } from "~/components/admin/schedule-publication-dialog";
import { useDialogAction } from "~/components/admin/translation-assignment";
import type { TranslationAssignmentSummary } from "~/components/admin/translation-assignment";
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
import {
  editorialTextDirection,
  type EditorialLanguage,
} from "~/lib/editorial-languages";

/**
 * The per-language row of a screen that both translates and publishes: an
 * article, an activity. What a language says today, the errand outstanding on
 * it, and the two ways it goes live. Each screen keeps its own arrangement of
 * these parts — only the parts themselves are shared.
 */

type Labels = Record<string, string>;
type Action = (formData: FormData) => Promise<void>;

/** A request whose submitted text an editor can still read. */
export type TranslationSubmission = TranslationAssignmentSummary & {
  submittedContent: unknown;
  reviewNote: string | null;
};

/** A language as the summary reads it. Screens carry more; this is the shared part. */
export type LanguageWorkflowState = {
  code: EditorialLanguage;
  state: string;
  method: string;
  publishedAt: string | null;
  scheduledFor: string | null;
  verifiedBy: { name: string | null } | null;
  assignment: TranslationSubmission | null;
};

const stateBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  machine_generated: "secondary",
  needs_review: "secondary",
  verified: "default",
  rejected: "outline",
};

/**
 * Everything known about one language, in reading order: how far along it is,
 * then the dates and people behind that — folded away entirely while there is
 * nothing to say.
 */
export function LanguageStateSummary({
  language,
  authored,
  sourceLanguage,
  labels,
}: {
  language: LanguageWorkflowState;
  /** Whether anything has been written in this language yet. */
  authored: boolean;
  sourceLanguage: EditorialLanguage;
  labels: Labels;
}) {
  const published = Boolean(language.publishedAt);
  const scheduled = Boolean(language.scheduledFor);
  const isSource = language.code === sourceLanguage;
  const assignment = language.assignment;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">
          {labels[`language.${language.code}`]}
        </span>
        {isSource ? (
          <Badge variant="outline" className="text-brand">
            ★
          </Badge>
        ) : null}
        {authored ? (
          <Badge variant={stateBadgeVariant[language.state] ?? "outline"}>
            {labels[`translation.state.${language.state}`] ?? language.state}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-copy-muted">
            {labels["translation.missing"]}
          </Badge>
        )}
        {!published ? (
          <span className="text-copy-muted text-xs">
            {scheduled
              ? labels["publication.scheduled"]
              : labels["translation.notPublished"]}
          </span>
        ) : null}
      </div>
      {authored && !isSource && language.method === "ai" ? (
        <p className="text-copy-muted mt-1 text-xs">
          {formatMessage(labels["translation.aiNote"] ?? "", {
            source: labels[`language.${sourceLanguage}`] ?? "",
            target: labels[`language.${language.code}`] ?? "",
          })}
        </p>
      ) : null}
      {published || scheduled || language.verifiedBy || assignment ? (
        <dl className="border-line mt-3 grid gap-2 border-s-2 ps-3 text-xs">
          {published ? (
            <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
              <dt className="text-copy-muted">
                {labels["translation.publishedAt"]}
              </dt>
              <dd className="text-success inline-flex min-w-0 items-start gap-1 font-medium tabular-nums">
                <CheckCircle2
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden
                />
                <time>{language.publishedAt}</time>
              </dd>
            </div>
          ) : null}
          {scheduled ? (
            <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
              <dt className="text-copy-muted">
                {labels["publication.scheduledFor"]}
              </dt>
              <dd className="text-brand inline-flex min-w-0 items-start gap-1 font-medium tabular-nums">
                <CalendarClock
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden
                />
                <time>{language.scheduledFor}</time>
              </dd>
            </div>
          ) : null}
          {language.verifiedBy ? (
            <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
              <dt className="text-copy-muted">
                {labels["translation.verifiedBy"]}
              </dt>
              <dd className="text-ink font-medium">
                {language.verifiedBy.name ??
                  labels["translation.verifierNameUnavailable"]}
              </dd>
            </div>
          ) : null}
          {assignment ? (
            <div className="grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-2">
              <dt className="text-copy-muted">
                {labels["translation.translatedBy"]}
              </dt>
              <dd className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                {assignment.translatorName ? (
                  <span className="text-ink font-medium">
                    {assignment.translatorName}
                  </span>
                ) : null}
                <a
                  className="text-brand focus-visible:ring-ring w-fit max-w-full break-all underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2"
                  href={`mailto:${assignment.translatorEmail}`}
                  dir="ltr"
                >
                  {assignment.translatorName
                    ? `(${assignment.translatorEmail})`
                    : assignment.translatorEmail}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}

/** Live now, or on a chosen date — the pair a language is published with. */
export function LanguagePublicationActions({
  locale,
  ownerField,
  ownerId,
  language,
  labels,
  disabled,
  publish,
  publishAction,
}: {
  locale: string;
  /** The hidden field the record is posted as: `entryId`, `activityId`. */
  ownerField: string;
  ownerId: string;
  language: EditorialLanguage;
  labels: Labels;
  disabled: boolean;
  /** Publishing now, already wrapped in the screen's own toast. */
  publish: Action;
  /** The same server action, for the scheduling dialog to post a date to. */
  publishAction: Action;
}) {
  return (
    <div className="grid w-full min-w-0 grid-cols-2 gap-2">
      <form action={publish}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name={ownerField} value={ownerId} />
        <input type="hidden" name="languageCode" value={language} />
        <PendingButton
          variant="secondary"
          className="min-h-10 w-full min-w-0 whitespace-normal"
          disabled={disabled}
        >
          <Globe aria-hidden />
          {labels["publication.now"]}
        </PendingButton>
      </form>
      <SchedulePublicationDialog
        locale={locale as Locale}
        fields={{ locale, [ownerField]: ownerId, languageCode: language }}
        action={publishAction}
        disabled={disabled}
        labels={labels}
      />
    </div>
  );
}

/**
 * Emailing a translator a one-off link to work through. The word count is shown
 * where the screen knows it, because it is what a translator is asked to quote
 * against.
 */
export function TranslationRequestDialog({
  action,
  locale,
  ownerField,
  ownerId,
  language,
  labels,
  disabled = false,
  wordCount,
  triggerId,
  open,
  onOpenChange,
  title,
  description,
}: {
  action: Action;
  locale: string;
  ownerField: string;
  ownerId: string;
  language: EditorialLanguage;
  labels: Labels;
  disabled?: boolean;
  wordCount?: number;
  /** Set where another control opens this dialog by id. */
  triggerId?: string;
  /**
   * Set together to hand openness to a control that is not a trigger — a menu
   * item, which has closed by the time its dialog is needed. The trigger button
   * is then not rendered at all.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Overrides for the same errand under a different name: giving access. */
  title?: string;
  description?: string;
}) {
  const controlled = open !== undefined && onOpenChange !== undefined;
  const dialog = useDialogAction(
    action,
    {
      success: labels["translation.requested"] ?? "",
      error: labels["translation.requestError"] ?? "",
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
          id={triggerId}
          render={<Button variant="outline" size="sm" disabled={disabled} />}
        >
          <MailPlus aria-hidden />
          {labels["translation.request"]}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {title ??
              formatMessage(labels["translation.requestTitle"] ?? "", {
                language: labels[`language.${language}`] ?? "",
              })}
          </DialogTitle>
          <DialogDescription>
            {description ?? labels["translation.requestHint"]}
          </DialogDescription>
        </DialogHeader>
        {wordCount === undefined ? null : (
          <p className="border-line bg-subtle text-copy-muted rounded-lg border px-3 py-2 text-xs font-medium">
            {formatMessage(labels["translation.wordCount"] ?? "", {
              count: String(wordCount),
            })}
          </p>
        )}
        <form action={dialog.submit} className="grid gap-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name={ownerField} value={ownerId} />
          <input type="hidden" name="targetLanguageCode" value={language} />
          <Field>
            <FieldLabel htmlFor={`translator-email-${language}`}>
              {labels["translation.translatorEmail"]}
            </FieldLabel>
            <Input
              id={`translator-email-${language}`}
              name="translatorEmail"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`translator-name-${language}`}>
              {labels["translation.translatorName"]}
            </FieldLabel>
            <Input
              id={`translator-name-${language}`}
              name="translatorName"
              autoComplete="name"
              maxLength={200}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`translator-expiry-${language}`}>
              {labels["translation.expiry"]}
            </FieldLabel>
            <SelectField
              id={`translator-expiry-${language}`}
              name="lifetimeHours"
              defaultValue="72"
            >
              <option value="24">{labels["translation.expiry.24"]}</option>
              <option value="72">{labels["translation.expiry.72"]}</option>
              <option value="168">{labels["translation.expiry.168"]}</option>
            </SelectField>
          </Field>
          <Field>
            <FieldLabel htmlFor={`translator-instructions-${language}`}>
              {labels["translation.instructions"]}
            </FieldLabel>
            <Textarea
              id={`translator-instructions-${language}`}
              name="instructions"
              rows={3}
              maxLength={2000}
            />
          </Field>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {labels["action.cancel"]}
            </DialogClose>
            <PendingButton>
              <MailPlus aria-hidden />
              {labels["translation.sendRequest"]}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What came back, above the decision about it. The submitted text is shown in
 * its own direction — it is the translator's language, not the reader's.
 */
export function TranslationReviewDialog({
  action,
  locale,
  ownerField,
  ownerId,
  language,
  assignment,
  labels,
}: {
  action: Action;
  locale: string;
  ownerField: string;
  ownerId: string;
  language: EditorialLanguage;
  assignment: TranslationSubmission;
  labels: Labels;
}) {
  const dialog = useDialogAction(action, {
    success: labels["translation.reviewed"] ?? "",
    error: labels["translation.reviewError"] ?? "",
  });
  const submitted = assignment.submittedContent as {
    title?: unknown;
    summary?: unknown;
    bodyHtml?: unknown;
    plainText?: unknown;
  } | null;
  /**
   * Read as the translator wrote it. A rich-text submission is markup the server
   * already sanitized down to the editorial vocabulary before storing it
   * (`sanitizeRichText`), and a reviewer judging structure has to be able to see
   * the structure.
   */
  const submittedHtml =
    typeof submitted?.bodyHtml === "string" ? submitted.bodyHtml : null;
  return (
    <Dialog open={dialog.open} onOpenChange={dialog.setOpen}>
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>
        <CheckCircle2 aria-hidden />
        {labels["translation.review"]}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {formatMessage(labels["translation.reviewTitle"] ?? "", {
              language: labels[`language.${language}`] ?? "",
            })}
          </DialogTitle>
          <DialogDescription>
            {assignment.translatorName ?? assignment.translatorEmail}
          </DialogDescription>
        </DialogHeader>
        <div
          className="border-line bg-subtle grid gap-3 rounded-lg border p-4"
          dir={editorialTextDirection(language)}
        >
          <h3 className="text-lg font-semibold">
            {typeof submitted?.title === "string" ? submitted.title : ""}
          </h3>
          {typeof submitted?.summary === "string" && submitted.summary ? (
            <p className="text-copy-muted">{submitted.summary}</p>
          ) : null}
          {submittedHtml ? (
            <div
              className="[&_a]:text-brand leading-relaxed [&_a]:underline [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:ps-5 [&_p:not(:last-child)]:mb-3 [&_ul]:list-disc [&_ul]:ps-5"
              dangerouslySetInnerHTML={{ __html: submittedHtml }}
            />
          ) : typeof submitted?.plainText === "string" ? (
            <p className="whitespace-pre-wrap leading-relaxed">
              {submitted.plainText}
            </p>
          ) : null}
        </div>
        <form action={dialog.submit} className="grid gap-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name={ownerField} value={ownerId} />
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <Field>
            <FieldLabel htmlFor={`translation-review-note-${language}`}>
              {labels["translation.reviewNote"]}
            </FieldLabel>
            <Textarea
              id={`translation-review-note-${language}`}
              name="reviewNote"
              rows={3}
              maxLength={2000}
            />
          </Field>
          <DialogFooter>
            <PendingButton variant="danger" name="decision" value="reject">
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
