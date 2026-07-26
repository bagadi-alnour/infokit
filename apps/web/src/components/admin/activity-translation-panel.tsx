"use client";

import type { Locale } from "@infokit/shared/i18n";
import { CalendarClock, CheckCircle2, Globe, MailPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  publishActivityLanguage,
  unpublishActivityLanguage,
} from "~/app/[locale]/dashboard/activities/actions";
import {
  requestActivityTranslation,
  reviewActivityTranslation,
} from "~/app/[locale]/dashboard/activities/translation-actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { SchedulePublicationDialog } from "~/components/admin/schedule-publication-dialog";
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

type Labels = Record<string, string>;

function format(
  template: string | undefined,
  values: Record<string, string | undefined>,
) {
  return (template ?? "").replace(
    /\{(\w+)\}/g,
    (_, key: string) => values[key] ?? "",
  );
}

export type ActivityTranslationAssignment = {
  id: string;
  state: string;
  translatorEmail: string;
  translatorName: string | null;
  expiresAt: string;
  submittedContent: unknown;
  reviewNote: string | null;
};

export type ActivityLanguageStatus = {
  code: EditorialLanguage;
  name: string | null;
  state: string;
  method: string;
  publishedAt: string | null;
  scheduledFor: string | null;
  verifiedBy: { name: string | null } | null;
  assignment: ActivityTranslationAssignment | null;
};

const stateBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  machine_generated: "secondary",
  needs_review: "secondary",
  verified: "default",
  rejected: "outline",
};

/**
 * Per-language activity workflow: translation status and requests sit beside
 * the publication state and actions so editors do not have to hunt between
 * separate cards.
 */
export function ActivityTranslationPanel({
  locale,
  activityId,
  sourceLanguage,
  sourceWordCount,
  languages,
  labels,
}: {
  locale: string;
  activityId: string;
  sourceLanguage: EditorialLanguage;
  sourceWordCount: number;
  languages: ActivityLanguageStatus[];
  labels: Labels;
}) {
  const showActionError = useActionErrorToast();
  const publish = async (formData: FormData) => {
    try {
      await publishActivityLanguage(formData);
      toast.success(labels["toast.published"]);
    } catch (error) {
      showActionError(
        error,
        labels["toast.publishError"] ?? labels["toast.actionError"] ?? "",
      );
    }
  };
  const unpublish = async (formData: FormData) => {
    try {
      await unpublishActivityLanguage(formData);
      toast.success(labels["toast.unpublished"]);
    } catch (error) {
      showActionError(error, labels["toast.actionError"] ?? "");
    }
  };

  return (
    <ul className="grid gap-2.5">
      {languages.map((language) => {
        const authored = Boolean(language.name);
        const published = Boolean(language.publishedAt);
        const scheduled = Boolean(language.scheduledFor);
        const isSource = language.code === sourceLanguage;
        const assignment = language.assignment;
        const canRequest =
          !isSource &&
          (!assignment ||
            ["expired", "rejected", "published"].includes(assignment.state));
        return (
          <li
            key={language.code}
            className="border-line grid min-w-0 gap-3 border-b py-4 first:pt-0 last:border-b-0 last:pb-0"
          >
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
                  <Badge
                    variant={stateBadgeVariant[language.state] ?? "outline"}
                  >
                    {labels[`translation.state.${language.state}`] ??
                      language.state}
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
                  {format(labels["translation.aiNote"], {
                    source: labels[`language.${sourceLanguage}`],
                    target: labels[`language.${language.code}`],
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
            <div className="grid min-w-0 grid-cols-1 gap-2 [&>button]:w-full [&>button]:justify-center">
              {canRequest ? (
                <TranslationRequestDialog
                  locale={locale}
                  activityId={activityId}
                  language={language.code}
                  sourceWordCount={sourceWordCount}
                  labels={labels}
                />
              ) : null}
              {assignment?.state === "submitted" ? (
                <TranslationReviewDialog
                  locale={locale}
                  activityId={activityId}
                  language={language.code}
                  assignment={assignment}
                  labels={labels}
                />
              ) : null}
              {published || scheduled ? (
                <form action={unpublish}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="activityId" value={activityId} />
                  <input
                    type="hidden"
                    name="languageCode"
                    value={language.code}
                  />
                  <PendingButton variant="ghost" className="text-danger w-full">
                    {scheduled
                      ? labels["publication.cancelSchedule"]
                      : labels["publication.unpublish"]}
                  </PendingButton>
                </form>
              ) : (
                <ActivityPublicationActions
                  locale={locale}
                  activityId={activityId}
                  language={language.code}
                  authored={authored}
                  labels={labels}
                  publish={publish}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ActivityPublicationActions({
  locale,
  activityId,
  language,
  authored,
  labels,
  publish,
}: {
  locale: string;
  activityId: string;
  language: EditorialLanguage;
  authored: boolean;
  labels: Labels;
  publish: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="grid w-full min-w-0 grid-cols-2 gap-2">
      <form action={publish}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="activityId" value={activityId} />
        <input type="hidden" name="languageCode" value={language} />
        <PendingButton
          variant="secondary"
          className="min-h-10 w-full min-w-0 whitespace-normal"
          disabled={!authored}
        >
          <Globe aria-hidden />
          {labels["publication.now"]}
        </PendingButton>
      </form>
      <SchedulePublicationDialog
        locale={locale as Locale}
        fields={{ locale, activityId, languageCode: language }}
        action={publishActivityLanguage}
        disabled={!authored}
        labels={labels}
      />
    </div>
  );
}

function TranslationRequestDialog({
  locale,
  activityId,
  language,
  sourceWordCount,
  labels,
}: {
  locale: string;
  activityId: string;
  language: EditorialLanguage;
  sourceWordCount: number;
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);
  const showActionError = useActionErrorToast();
  const request = async (formData: FormData) => {
    try {
      await requestActivityTranslation(formData);
      toast.success(labels["translation.requested"] ?? "");
      setOpen(false);
    } catch (error) {
      showActionError(error, labels["translation.requestError"] ?? "");
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* The translation workspace's rail reaches this trigger by id, so the
       * emailing form lives in exactly one place. */}
      <DialogTrigger
        id={`request-translation-${language}`}
        render={<Button variant="outline" size="sm" />}
      >
        <MailPlus aria-hidden />
        {labels["translation.request"]}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {format(labels["translation.requestTitle"], {
              language: labels[`language.${language}`],
            })}
          </DialogTitle>
          <DialogDescription>
            {labels["translation.requestHint"]}
          </DialogDescription>
        </DialogHeader>
        <p className="border-line bg-subtle text-copy-muted rounded-lg border px-3 py-2 text-xs font-medium">
          {format(labels["translation.wordCount"], {
            count: String(sourceWordCount),
          })}
        </p>
        <form action={request} className="grid gap-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="activityId" value={activityId} />
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

function TranslationReviewDialog({
  locale,
  activityId,
  language,
  assignment,
  labels,
}: {
  locale: string;
  activityId: string;
  language: EditorialLanguage;
  assignment: ActivityTranslationAssignment;
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);
  const showActionError = useActionErrorToast();
  const submitted = assignment.submittedContent as {
    title?: unknown;
    summary?: unknown;
    plainText?: unknown;
  } | null;
  const review = async (formData: FormData) => {
    try {
      await reviewActivityTranslation(formData);
      toast.success(labels["translation.reviewed"] ?? "");
      setOpen(false);
    } catch (error) {
      showActionError(error, labels["translation.reviewError"] ?? "");
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>
        <CheckCircle2 aria-hidden />
        {labels["translation.review"]}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {format(labels["translation.reviewTitle"], {
              language: labels[`language.${language}`],
            })}
          </DialogTitle>
          <DialogDescription>
            {assignment.translatorName ?? assignment.translatorEmail}
          </DialogDescription>
        </DialogHeader>
        <div
          className="border-line bg-subtle grid gap-3 rounded-lg border p-4"
          dir={language === "ar" ? "rtl" : "ltr"}
        >
          <h3 className="text-lg font-semibold">
            {typeof submitted?.title === "string" ? submitted.title : ""}
          </h3>
          {typeof submitted?.summary === "string" && submitted.summary ? (
            <p className="text-copy-muted">{submitted.summary}</p>
          ) : null}
          {typeof submitted?.plainText === "string" ? (
            <p className="whitespace-pre-wrap leading-relaxed">
              {submitted.plainText}
            </p>
          ) : null}
        </div>
        <form action={review} className="grid gap-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="activityId" value={activityId} />
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
