"use client";

import { formatMessage, type Locale } from "@infokit/shared/i18n";
import {
  Archive,
  CheckCircle2,
  Eye,
  Plus,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
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
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import type { LanguageMenuAbilities } from "~/components/admin/language-actions-menu";
import {
  LanguageStateSummary,
  TranslationReviewDialog,
  type TranslationSubmission,
} from "~/components/admin/language-publication";
import { SearchableMultiSelect } from "~/components/admin/searchable-select";
import { isAwaitingReview } from "~/components/admin/translation-assignment";
import {
  articleFieldNames,
  TranslationWorkspace,
  type WorkspaceTranslation,
  type WorkspaceWorkflow,
} from "~/components/admin/translation-workspace";
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
import { SelectField } from "~/components/ui/select-field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";
import {
  editorialTextDirection,
  type EditorialLanguage,
} from "~/lib/editorial-languages";
import type { LanguageReviewStage } from "~/lib/language-review";

type Language = EditorialLanguage;
type Labels = Record<string, string>;

/* ------------------------------------------------------------------ */
/* Content editor                                                     */
/* ------------------------------------------------------------------ */

export function ArticleEditorForm({
  locale,
  entryId,
  organizationId,
  sourceLanguage,
  articleDate,
  featured,
  tags,
  initialTagIds,
  languages,
  archived,
  abilities,
  aiEnabled,
  canVerify,
  returnPath,
  media,
  downloads,
  labels,
  editorLabels,
}: {
  locale: string;
  entryId: string;
  /** The association answering for the entry, when one does. */
  organizationId?: string;
  sourceLanguage: Language;
  articleDate: string | null;
  featured: boolean;
  tags: { value: string; label: string; description?: string }[];
  initialTagIds: string[];
  /** Every language: its saved text, and where it stands on the server. */
  languages: ArticleLanguageStatus[];
  archived: boolean;
  abilities: Omit<LanguageMenuAbilities, "aiEnabled">;
  /** False when the deployment has no translation provider configured. */
  aiEnabled: boolean;
  canVerify: boolean;
  /** Dashboard path to revalidate after a per-language action. */
  returnPath: string;
  /** The cover image, laid out below both editor columns. */
  media?: React.ReactNode;
  /** The downloadable documents, laid out beside the tags field. */
  downloads?: React.ReactNode;
  labels: Labels;
  /** The workspace's own vocabulary; see `~/lib/workspace-labels`. */
  editorLabels: Labels;
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

  /**
   * What each language's pane opens with. A language nobody has written yet
   * seeds nothing, so an empty row stays empty rather than posting a blank
   * title the save path would read as an authored language.
   */
  const initial = useMemo(() => {
    const seeds: Partial<Record<Language, WorkspaceTranslation>> = {};
    for (const language of languages) {
      if (!language.saved) continue;
      seeds[language.code] = {
        title: language.title ?? "",
        summary: language.summary ?? "",
        html: language.bodyHtml ?? "",
        text: language.plainText ?? "",
        state: language.state,
        method: language.method,
        verifiedByName: language.verifiedBy?.name ?? null,
      };
    }
    return seeds;
  }, [languages]);

  /**
   * The per-language menu's world: publication, review stage, and the three
   * actions it can fire. Every one of them re-checks on the server — this only
   * decides what is worth offering.
   */
  const workflow = useMemo<WorkspaceWorkflow>(
    () => ({
      ownerField: "entryId",
      languages: Object.fromEntries(
        languages.map((language) => [
          language.code,
          {
            saved: language.saved,
            published: Boolean(language.publishedAt),
            scheduled: Boolean(language.scheduledFor),
            reviewStage: language.reviewStage,
            // Words an outside translator sent back and nobody has read yet.
            submitted: isAwaitingReview(language.assignment),
          },
        ]),
      ),
      abilities,
      actions: {
        requestTranslation: requestArticleTranslation,
        publish: publishArticleLanguage,
        unpublish: unpublishArticleLanguage,
      },
      frozen: archived,
    }),
    [abilities, archived, languages],
  );

  return (
    <form action={submit} className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="entryId" value={entryId} />
      <TranslationWorkspace
        entityKind="editorial_entry"
        entityId={entryId}
        organizationId={organizationId}
        interfaceLocale={locale}
        sourceLanguage={sourceLanguage}
        initial={initial}
        labels={editorLabels}
        names={articleFieldNames}
        fields={{ summary: true }}
        canVerify={canVerify}
        aiEnabled={aiEnabled}
        returnPath={returnPath}
        workflow={workflow}
        media={media}
      />
      {/* Tags and the downloadable documents side by side: both are things
       * attached to the article rather than words in it, and each is short
       * enough that stacking them only adds scrolling. Keyed to this row's own
       * width, which the console's sidebar narrows. */}
      <div className="@container">
        <div className="@xl:grid-cols-2 grid items-start gap-4">
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
              <p className="text-copy-muted text-sm">
                {labels["field.tagsEmpty"]}
              </p>
            )}
            <FieldDescription>{labels["field.tagsHint"]}</FieldDescription>
          </Field>
          {downloads}
        </div>
      </div>
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
  /** A row for this language exists in the current revision. */
  saved: boolean;
  title: string | null;
  summary: string | null;
  bodyHtml: string | null;
  /** The body as plain text — what a translator is quoted a word count on. */
  plainText: string | null;
  state: NonNullable<WorkspaceTranslation["state"]>;
  method: NonNullable<WorkspaceTranslation["method"]>;
  /** Who this language is still waiting on before it may face the public. */
  reviewStage: LanguageReviewStage;
  publishedAt: string | null;
  scheduledFor: string | null;
  verifiedBy: { name: string | null } | null;
  assignment: ArticleTranslationAssignment | null;
}

export type ArticleTranslationAssignment = TranslationSubmission;

/**
 * What is left to say about a language once its own menu carries the actions:
 * how far along it is, the article as a reader would receive it, and a
 * translator's submission waiting to be accepted.
 *
 * Publishing, scheduling, unpublishing and inviting a translator all live in
 * the accordion beside the text they act on — offering them twice would mean
 * two controls for one decision. Reviewing what an outside translator sent back
 * is not one of those: it is reading someone else's words, so it stays here.
 */
export function ArticleTranslationInbox({
  locale,
  entryId,
  sourceLanguage,
  languages,
  labels,
}: {
  locale: string;
  entryId: string;
  sourceLanguage: Language;
  languages: ArticleLanguageStatus[];
  labels: Labels;
}) {
  // A language with neither text nor a translator has nothing to report; its
  // row in the accordion already says it is empty.
  const rows = languages.filter(
    (language) => language.saved || language.assignment,
  );
  if (rows.length === 0) {
    return (
      <p className="text-copy-muted text-sm">{labels["translation.missing"]}</p>
    );
  }
  return (
    <div className="grid min-w-0 gap-4">
      <ArticlePreviewLauncher
        sourceLanguage={sourceLanguage}
        languages={languages}
        labels={labels}
      />
      <ul className="grid gap-2.5">
        {rows.map((language) => (
          <li
            key={language.code}
            className="border-line grid min-w-0 gap-3 border-b py-4 first:pt-0 last:border-b-0 last:pb-0"
          >
            <LanguageStateSummary
              language={language}
              authored={language.saved}
              sourceLanguage={sourceLanguage}
              labels={labels}
            />
            {isAwaitingReview(language.assignment) && language.assignment ? (
              <TranslationReviewDialog
                action={reviewArticleTranslation}
                locale={locale}
                ownerField="entryId"
                ownerId={entryId}
                language={language.code}
                assignment={language.assignment}
                labels={labels}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One preview button for the whole article: it asks which language to read
 * before it opens.
 *
 * A button per language turned the card into a column of near-identical
 * controls, and reading is one intention — the language is a parameter of it,
 * not a different action. Only languages with text are offered, so the choice
 * can never lead to an empty sheet.
 */
function ArticlePreviewLauncher({
  sourceLanguage,
  languages,
  labels,
}: {
  sourceLanguage: Language;
  languages: ArticleLanguageStatus[];
  labels: Labels;
}) {
  const readable = languages.filter((language) => language.saved);
  const [asking, setAsking] = useState(false);
  const [choice, setChoice] = useState<Language>(
    readable.find((language) => language.code === sourceLanguage)?.code ??
      readable[0]?.code ??
      sourceLanguage,
  );
  /** Set when the sheet is open, so closing it does not reopen the question. */
  const [reading, setReading] = useState<Language | null>(null);
  const fieldId = useId();

  const fallback = readable[0];
  if (!fallback) return null;
  const chosen =
    readable.find((language) => language.code === reading) ?? fallback;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit gap-1.5"
        onClick={() => {
          setAsking(true);
        }}
      >
        <Eye className="size-4" aria-hidden />
        {labels["preview.open"]}
      </Button>
      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{labels["preview.chooseTitle"]}</DialogTitle>
            <DialogDescription>
              {labels["preview.chooseHint"]}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={fieldId}>
              {labels["preview.chooseLabel"]}
            </FieldLabel>
            <SelectField
              id={fieldId}
              value={choice}
              onValueChange={(value) => {
                setChoice(value as Language);
              }}
            >
              {readable.map((language) => (
                <option key={language.code} value={language.code}>
                  {labels[`language.${language.code}`] ?? language.code}
                </option>
              ))}
            </SelectField>
          </Field>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              {labels["action.cancel"]}
            </DialogClose>
            <Button
              type="button"
              onClick={() => {
                setAsking(false);
                setReading(choice);
              }}
            >
              <Eye aria-hidden />
              {labels["preview.read"]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ArticlePreview
        language={chosen}
        sourceLanguage={sourceLanguage}
        published={Boolean(chosen.publishedAt)}
        open={reading !== null}
        onOpenChange={(next) => {
          if (!next) setReading(null);
        }}
        labels={labels}
      />
    </>
  );
}

function ArticlePreview({
  language,
  sourceLanguage,
  published,
  open,
  onOpenChange,
  labels,
}: {
  language: ArticleLanguageStatus;
  sourceLanguage: Language;
  published: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: Labels;
}) {
  /* The sheet opens from the side the language is read from. */
  const dir = editorialTextDirection(language.code);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={dir === "rtl" ? "left" : "right"}
        className="w-full overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>
            {formatMessage(labels["preview.title"] ?? "", {
              language: labels[`language.${language.code}`] ?? "",
            })}
          </SheetTitle>
          <SheetDescription>
            {!published && language.code !== sourceLanguage
              ? formatMessage(labels["preview.fallback"] ?? "", {
                  source: labels[`language.${sourceLanguage}`] ?? "",
                  target: labels[`language.${language.code}`] ?? "",
                })
              : language.method === "ai"
                ? formatMessage(labels["preview.aiTranslated"] ?? "", {
                    source: labels[`language.${sourceLanguage}`] ?? "",
                  })
                : ""}
          </SheetDescription>
        </SheetHeader>
        <article
          className="infokit-article-preview grid gap-4 px-4 pb-8"
          dir={dir}
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
  canArchive,
  labels,
}: {
  locale: string;
  entryId: string;
  workflowState: string;
  archived: boolean;
  /**
   * Whether archiving is available at all: only for whoever wrote the article,
   * and only once nothing of it is published. Decided on the server, and offered
   * nowhere else — a button that answers with an error is not an explanation.
   */
  canArchive: boolean;
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
      {canArchive ? (
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
      ) : null}
    </div>
  );
}
