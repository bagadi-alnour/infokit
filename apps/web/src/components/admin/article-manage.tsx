"use client";

import type { Locale } from "@calais/shared/i18n";
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  Eye,
  Globe,
  MailPlus,
  Plus,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  addArticleSource,
  archiveArticle,
  publishArticleLanguage,
  removeArticleSource,
  restoreArticle,
  saveArticleContent,
  submitArticleForReview,
  unpublishArticleLanguage,
  updateArticleFreshness,
} from "~/app/[locale]/dashboard/articles/actions";
import {
  requestArticleTranslation,
  reviewArticleTranslation,
} from "~/app/[locale]/dashboard/articles/translation-actions";
import {
  ArticleContentFields,
  type ArticleContentValue,
} from "~/components/admin/article-content-fields";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { SearchableMultiSelect } from "~/components/admin/searchable-select";
import { SchedulePublicationDialog } from "~/components/admin/schedule-publication-dialog";
import { PendingButton } from "~/components/pending-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DatePicker } from "~/components/ui/date-picker";
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
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";
import type { EditorialLanguage } from "~/lib/editorial-languages";

type Language = EditorialLanguage;
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

/* ------------------------------------------------------------------ */
/* Content editor                                                     */
/* ------------------------------------------------------------------ */

export function ArticleEditorForm({
  locale,
  entryId,
  sourceLanguage,
  articleDate,
  featured,
  tags,
  initialTagIds,
  content,
  labels,
}: {
  locale: string;
  entryId: string;
  sourceLanguage: Language;
  articleDate: string | null;
  featured: boolean;
  tags: { value: string; label: string; description?: string }[];
  initialTagIds: string[];
  content: ArticleContentValue;
  labels: Labels;
}) {
  const [selectedTagIds, setSelectedTagIds] = useState(initialTagIds);
  const showActionError = useActionErrorToast();
  const submit = async (formData: FormData) => {
    try {
      await saveArticleContent(formData);
      toast.success(labels["toast.saved"]);
    } catch (error) {
      showActionError(error, labels["toast.saveError"] ?? "");
    }
  };
  return (
    <form action={submit} className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="entryId" value={entryId} />
      <ArticleContentFields
        interfaceLocale={locale}
        sourceLanguage={sourceLanguage}
        initial={content}
        labels={labels}
      />
      <Field>
        <FieldLabel>{labels["field.tags"]}</FieldLabel>
        {tags.length > 0 ? (
          <SearchableMultiSelect
            name="tagIds"
            maxSelections={3}
            options={tags}
            value={selectedTagIds}
            onValueChange={setSelectedTagIds}
            label={labels["field.tags"]}
            placeholder={labels["field.tagsPlaceholder"]}
            emptyLabel={labels.noMatch}
          />
        ) : (
          <p className="text-copy-muted text-sm">{labels["field.tagsEmpty"]}</p>
        )}
        <FieldDescription>{labels["field.tagsHint"]}</FieldDescription>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="edit-article-date">
            {labels["field.articleDate"]}
          </FieldLabel>
          <DatePicker
            id="edit-article-date"
            name="articleDate"
            locale={locale as Locale}
            defaultValue={articleDate ?? undefined}
            placeholder={labels["date.select"] ?? ""}
            clearLabel={labels["date.clear"] ?? ""}
          />
        </Field>
        <label className="border-line bg-subtle flex items-center gap-3 self-end rounded-lg border p-3 text-sm">
          <Checkbox name="featured" defaultChecked={featured} />
          <span className="font-medium">{labels["field.featured"]}</span>
        </label>
      </div>
      <div className="flex justify-end">
        <PendingButton>
          <CheckCircle2 aria-hidden />
          {labels["action.saveContent"]}
        </PendingButton>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Freshness                                                          */
/* ------------------------------------------------------------------ */

export function ArticleFreshnessForm({
  locale,
  entryId,
  canBecomeOutdated,
  unreliableFrom,
  sourceSummary,
  labels,
}: {
  locale: string;
  entryId: string;
  canBecomeOutdated: boolean;
  unreliableFrom: string | null;
  sourceSummary: string | null;
  labels: Labels;
}) {
  const [canOutdate, setCanOutdate] = useState(canBecomeOutdated);
  const showActionError = useActionErrorToast();
  const submit = async (formData: FormData) => {
    try {
      await updateArticleFreshness(formData);
      toast.success(labels["toast.freshnessSaved"]);
    } catch (error) {
      showActionError(error, labels["toast.actionError"] ?? "");
    }
  };
  return (
    <form action={submit} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="entryId" value={entryId} />
      <label className="border-line bg-subtle flex items-start gap-3 rounded-lg border p-3 text-sm">
        <Checkbox
          name="canBecomeOutdated"
          className="mt-0.5"
          checked={canOutdate}
          onCheckedChange={(value) => {
            setCanOutdate(value);
          }}
        />
        <span>
          <span className="font-medium">{labels["freshness.canOutdate"]}</span>
          <span className="text-copy-muted mt-0.5 block text-xs">
            {canOutdate
              ? labels["freshness.canOutdateHint"]
              : labels["freshness.stable"]}
          </span>
        </span>
      </label>
      {canOutdate ? (
        <Field>
          <FieldLabel htmlFor="freshness-unreliable">
            {labels["freshness.unreliableFrom"]}
          </FieldLabel>
          <DatePicker
            id="freshness-unreliable"
            name="unreliableFrom"
            locale={locale as Locale}
            defaultValue={unreliableFrom ?? undefined}
            placeholder={labels["date.select"] ?? ""}
            clearLabel={labels["date.clear"] ?? ""}
            required
          />
          <FieldDescription>
            {labels["freshness.unreliableHint"]}
          </FieldDescription>
        </Field>
      ) : null}
      <Field>
        <FieldLabel htmlFor="freshness-summary">
          {labels["freshness.sourceSummary"]}
        </FieldLabel>
        <Textarea
          id="freshness-summary"
          name="sourceSummary"
          rows={2}
          defaultValue={sourceSummary ?? undefined}
        />
        <FieldDescription>
          {labels["freshness.sourceSummaryHint"]}
        </FieldDescription>
      </Field>
      <div className="flex justify-end">
        <PendingButton variant="secondary">
          {labels["freshness.save"]}
        </PendingButton>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Sources                                                            */
/* ------------------------------------------------------------------ */

export interface ArticleSource {
  id: string;
  title: string;
  publisher: string | null;
  url: string | null;
  sourceDate: string | null;
}

export function ArticleSources({
  locale,
  entryId,
  sources,
  labels,
}: {
  locale: string;
  entryId: string;
  sources: ArticleSource[];
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);
  const showActionError = useActionErrorToast();
  const add = async (formData: FormData) => {
    try {
      await addArticleSource(formData);
      toast.success(labels["source.added"]);
      setOpen(false);
    } catch (error) {
      showActionError(error, labels["toast.actionError"] ?? "");
    }
  };
  const remove = async (formData: FormData) => {
    try {
      await removeArticleSource(formData);
      toast.success(labels["source.removed"]);
    } catch (error) {
      showActionError(error, labels["toast.actionError"] ?? "");
    }
  };
  return (
    <div className="grid gap-3">
      {sources.length === 0 ? (
        <p className="text-copy-muted text-sm">{labels["source.empty"]}</p>
      ) : (
        <ul className="grid gap-2">
          {sources.map((source) => (
            <li
              key={source.id}
              className="border-line flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{source.title}</p>
                <p className="text-copy-muted truncate text-xs">
                  {[source.publisher, source.sourceDate]
                    .filter(Boolean)
                    .join(" · ")}
                  {source.url ? (
                    <>
                      {source.publisher || source.sourceDate ? " · " : ""}
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand underline"
                      >
                        {source.url}
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
              <form action={remove}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="entryId" value={entryId} />
                <input type="hidden" name="sourceId" value={source.id} />
                <PendingButton variant="ghost" className="size-8 p-0">
                  <Trash2 className="size-4" aria-hidden />
                  <span className="sr-only">{labels["source.remove"]}</span>
                </PendingButton>
              </form>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm" className="w-fit gap-2" />
          }
        >
          <Plus className="size-4" aria-hidden />
          {labels["source.add"]}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{labels["source.add"]}</DialogTitle>
          </DialogHeader>
          <form action={add} className="grid gap-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="entryId" value={entryId} />
            <Field>
              <FieldLabel htmlFor="source-title">
                {labels["source.name"]}
              </FieldLabel>
              <Input id="source-title" name="title" required minLength={2} />
            </Field>
            <Field>
              <FieldLabel htmlFor="source-publisher">
                {labels["source.publisher"]}
              </FieldLabel>
              <Input id="source-publisher" name="publisher" />
            </Field>
            <Field>
              <FieldLabel htmlFor="source-url">
                {labels["source.url"]}
              </FieldLabel>
              <Input id="source-url" name="url" type="url" inputMode="url" />
            </Field>
            <Field>
              <FieldLabel htmlFor="source-date">
                {labels["source.date"]}
              </FieldLabel>
              <DatePicker
                id="source-date"
                name="sourceDate"
                locale={locale as Locale}
                placeholder={labels["date.select"] ?? ""}
                clearLabel={labels["date.clear"] ?? ""}
              />
            </Field>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                {labels["action.cancel"]}
              </DialogClose>
              <PendingButton>
                <Plus aria-hidden />
                {labels["source.add"]}
              </PendingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-language publication + preview                                 */
/* ------------------------------------------------------------------ */

export interface ArticleLanguageStatus {
  code: Language;
  title: string | null;
  summary: string | null;
  bodyHtml: string | null;
  state: string;
  method: string;
  publishedAt: string | null;
  scheduledFor: string | null;
  verifiedBy: { name: string | null } | null;
  assignment: ArticleTranslationAssignment | null;
}

export interface ArticleTranslationAssignment {
  id: string;
  state: string;
  translatorEmail: string;
  translatorName: string | null;
  expiresAt: string;
  submittedContent: unknown;
  reviewNote: string | null;
}

const stateBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  verified: "default",
  needs_review: "secondary",
  machine_generated: "secondary",
  draft: "outline",
  rejected: "outline",
};

export function ArticlePublication({
  locale,
  entryId,
  sourceLanguage,
  languages,
  archived,
  labels,
  compact = false,
}: {
  locale: string;
  entryId: string;
  sourceLanguage: Language;
  languages: ArticleLanguageStatus[];
  archived: boolean;
  labels: Labels;
  compact?: boolean;
}) {
  const showActionError = useActionErrorToast();
  const publish = async (formData: FormData) => {
    try {
      await publishArticleLanguage(formData);
      toast.success(
        formData.get("publishAt")
          ? labels["toast.scheduled"]
          : labels["toast.published"],
      );
    } catch (error) {
      showActionError(error, labels["toast.publishError"] ?? "");
    }
  };
  const unpublish = async (formData: FormData) => {
    try {
      await unpublishArticleLanguage(formData);
      toast.success(labels["toast.unpublished"]);
    } catch (error) {
      showActionError(error, labels["toast.actionError"] ?? "");
    }
  };

  return (
    <ul className="grid gap-2.5">
      {languages.map((language) => {
        const authored = Boolean(language.title);
        const published = Boolean(language.publishedAt);
        const scheduled = Boolean(language.scheduledFor);
        const isSource = language.code === sourceLanguage;
        return (
          <li
            key={language.code}
            className={
              compact
                ? "border-line grid min-w-0 gap-3 border-b py-4 first:pt-0 last:border-b-0 last:pb-0"
                : "border-line bg-surface grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-center"
            }
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
              {published ||
              scheduled ||
              language.verifiedBy ||
              language.assignment ? (
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
                  {language.assignment ? (
                    <div className="grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-2">
                      <dt className="text-copy-muted">
                        {labels["translation.translatedBy"]}
                      </dt>
                      <dd className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                        {language.assignment.translatorName ? (
                          <span className="text-ink font-medium">
                            {language.assignment.translatorName}
                          </span>
                        ) : null}
                        <a
                          className="text-brand focus-visible:ring-ring w-fit max-w-full break-all underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2"
                          href={`mailto:${language.assignment.translatorEmail}`}
                          dir="ltr"
                        >
                          {language.assignment.translatorName
                            ? `(${language.assignment.translatorEmail})`
                            : language.assignment.translatorEmail}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </div>
            <div
              className={
                compact
                  ? "grid min-w-0 grid-cols-1 gap-2 [&>button]:min-h-10 [&>button]:w-full [&>button]:justify-center [&>form>button]:min-h-10 [&>form>button]:w-full [&>form>button]:justify-center [&>form]:w-full"
                  : "flex items-center gap-2 sm:justify-end"
              }
            >
              {!isSource &&
              (!language.assignment ||
                ["expired", "rejected", "published"].includes(
                  language.assignment.state,
                )) ? (
                <TranslationRequestDialog
                  locale={locale}
                  entryId={entryId}
                  language={language.code}
                  labels={labels}
                  disabled={archived}
                />
              ) : null}
              {language.assignment?.state === "submitted" ? (
                <TranslationReviewDialog
                  locale={locale}
                  entryId={entryId}
                  language={language.code}
                  assignment={language.assignment}
                  labels={labels}
                />
              ) : null}
              {authored ? (
                <ArticlePreview
                  language={language}
                  sourceLanguage={sourceLanguage}
                  published={published}
                  labels={labels}
                />
              ) : null}
              {published || scheduled ? (
                <form action={unpublish}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="entryId" value={entryId} />
                  <input
                    type="hidden"
                    name="languageCode"
                    value={language.code}
                  />
                  <PendingButton variant="ghost" className="text-danger">
                    {scheduled
                      ? labels["publication.cancelSchedule"]
                      : labels["translation.unpublish"]}
                  </PendingButton>
                </form>
              ) : (
                <ArticlePublicationActions
                  locale={locale}
                  entryId={entryId}
                  language={language.code}
                  authored={authored}
                  archived={archived}
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

function ArticlePublicationActions({
  locale,
  entryId,
  language,
  authored,
  archived,
  labels,
  publish,
}: {
  locale: string;
  entryId: string;
  language: Language;
  authored: boolean;
  archived: boolean;
  labels: Labels;
  publish: (formData: FormData) => Promise<void>;
}) {
  const disabled = !authored || archived;

  return (
    <div className="grid w-full min-w-0 grid-cols-2 gap-2">
      <form action={publish}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="entryId" value={entryId} />
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
        fields={{ locale, entryId, languageCode: language }}
        action={publishArticleLanguage}
        disabled={disabled}
        labels={labels}
      />
    </div>
  );
}

function TranslationRequestDialog({
  locale,
  entryId,
  language,
  labels,
  disabled,
}: {
  locale: string;
  entryId: string;
  language: Language;
  labels: Labels;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const showActionError = useActionErrorToast();
  const request = async (formData: FormData) => {
    try {
      await requestArticleTranslation(formData);
      toast.success(labels["translation.requested"] ?? "");
      setOpen(false);
    } catch (error) {
      showActionError(error, labels["translation.requestError"] ?? "");
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" disabled={disabled} />}
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
        <form action={request} className="grid gap-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="entryId" value={entryId} />
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
            <NativeSelect
              id={`translator-expiry-${language}`}
              name="lifetimeHours"
              defaultValue="72"
            >
              <NativeSelectOption value="24">
                {labels["translation.expiry.24"]}
              </NativeSelectOption>
              <NativeSelectOption value="72">
                {labels["translation.expiry.72"]}
              </NativeSelectOption>
              <NativeSelectOption value="168">
                {labels["translation.expiry.168"]}
              </NativeSelectOption>
            </NativeSelect>
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
  entryId,
  language,
  assignment,
  labels,
}: {
  locale: string;
  entryId: string;
  language: Language;
  assignment: ArticleTranslationAssignment;
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
      await reviewArticleTranslation(formData);
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
          <input type="hidden" name="entryId" value={entryId} />
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

function ArticlePreview({
  language,
  sourceLanguage,
  published,
  labels,
}: {
  language: ArticleLanguageStatus;
  sourceLanguage: Language;
  published: boolean;
  labels: Labels;
}) {
  const rtl = language.code === "ar";
  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="ghost" size="sm" className="gap-1.5" />}
      >
        <Eye className="size-4" aria-hidden />
        {labels["preview.open"]}
      </SheetTrigger>
      <SheetContent
        side={rtl ? "left" : "right"}
        className="w-full overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>
            {format(labels["preview.title"], {
              language: labels[`language.${language.code}`],
            })}
          </SheetTitle>
          <SheetDescription>
            {!published && language.code !== sourceLanguage
              ? format(labels["preview.fallback"], {
                  source: labels[`language.${sourceLanguage}`],
                  target: labels[`language.${language.code}`],
                })
              : language.method === "ai"
                ? format(labels["preview.aiTranslated"], {
                    source: labels[`language.${sourceLanguage}`],
                  })
                : ""}
          </SheetDescription>
        </SheetHeader>
        <article
          className="calais-article-preview grid gap-4 px-4 pb-8"
          dir={rtl ? "rtl" : "ltr"}
        >
          <h2 className="text-2xl font-semibold tracking-tight">
            {language.title}
          </h2>
          {language.summary ? (
            <div>
              <p className="text-copy-muted text-xs font-semibold uppercase tracking-wide">
                {labels["preview.summary"]}
              </p>
              <p className="mt-1 text-base leading-relaxed">
                {language.summary}
              </p>
            </div>
          ) : null}
          {language.bodyHtml ? (
            <div>
              <p className="text-copy-muted text-xs font-semibold uppercase tracking-wide">
                {labels["preview.body"]}
              </p>
              <div
                className="prose-article [&_a]:text-brand mt-1 text-base leading-relaxed [&_a]:underline [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5"
                // Body HTML is sanitized on the server before storage.
                dangerouslySetInnerHTML={{ __html: language.bodyHtml }}
              />
            </div>
          ) : null}
        </article>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Workflow bar                                                       */
/* ------------------------------------------------------------------ */

export function ArticleWorkflowBar({
  locale,
  entryId,
  workflowState,
  archived,
  labels,
}: {
  locale: string;
  entryId: string;
  workflowState: string;
  archived: boolean;
  labels: Labels;
}) {
  const showActionError = useActionErrorToast();
  const run = async (
    action: (formData: FormData) => Promise<void>,
    formData: FormData,
    success: string | undefined,
  ) => {
    try {
      await action(formData);
      toast.success(success ?? "");
    } catch (error) {
      showActionError(error, labels["toast.actionError"] ?? "");
    }
  };

  if (archived) {
    return (
      <form
        action={(formData) =>
          run(restoreArticle, formData, labels["toast.restored"])
        }
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="entryId" value={entryId} />
        <PendingButton variant="secondary">
          <Undo2 aria-hidden />
          {labels["action.restore"]}
        </PendingButton>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {workflowState === "draft" ? (
        <form
          action={(formData) =>
            run(submitArticleForReview, formData, labels["toast.submitted"])
          }
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="entryId" value={entryId} />
          <PendingButton variant="secondary">
            <Send aria-hidden />
            {labels["action.submit"]}
          </PendingButton>
        </form>
      ) : null}
      <AlertDialog>
        <AlertDialogTrigger
          render={<Button variant="ghost" className="text-danger gap-2" />}
        >
          <Archive className="size-4" aria-hidden />
          {labels["action.archive"]}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {labels["action.archiveConfirmTitle"]}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {labels["action.archiveConfirmBody"]}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{labels["action.cancel"]}</AlertDialogCancel>
            <form
              action={(formData) =>
                run(archiveArticle, formData, labels["toast.archived"])
              }
            >
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="entryId" value={entryId} />
              <PendingButton variant="danger" className="w-full">
                {labels["action.archiveConfirm"]}
              </PendingButton>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
