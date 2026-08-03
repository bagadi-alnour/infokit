"use client";

import { Archive, CheckCircle2, ClipboardCheck, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  archiveBasicInformation,
  confirmBasicInformation,
  publishBasicInformationLanguage,
  reorderBasicInformation,
  restoreBasicInformation,
  saveBasicInformation,
  unpublishBasicInformationLanguage,
} from "~/app/[locale]/dashboard/basics/actions";
import { requestArticleTranslation } from "~/app/[locale]/dashboard/articles/translation-actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import type { LanguageMenuAbilities } from "~/components/admin/language-actions-menu";
import { IconPicker } from "~/components/admin/icon-picker";
import { SearchableSelect } from "~/components/admin/searchable-select";
import {
  articleFieldNames,
  TranslationWorkspace,
  type WorkspaceTranslation,
  type WorkspaceWorkflow,
} from "~/components/admin/translation-workspace";
import { taxonomyIconNames } from "~/components/taxonomy-icon";
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
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SelectField } from "~/components/ui/select-field";
import {
  basicInformationReaches,
  basicInformationReviewIntervals,
  BASIC_INFORMATION_REVIEW_DAYS,
} from "~/lib/basic-information";
import type { EditorialLanguage } from "~/lib/editorial-languages";
import type { LanguageReviewStage } from "~/lib/language-review";

type Language = EditorialLanguage;
type Labels = Record<string, string>;

/** One row of a picker: the id that posts, and the words that name it. */
export interface BasicInformationOptionRow {
  id: string;
  label: string;
}

/** Where one language of a contact stands, and what it currently says. */
export interface BasicInformationLanguageStatus {
  code: Language;
  /** A row for this language exists in the current revision. */
  saved: boolean;
  title: string | null;
  /** The sentence saying when to use the number — the whole of the body. */
  summary: string | null;
  state: NonNullable<WorkspaceTranslation["state"]>;
  method: NonNullable<WorkspaceTranslation["method"]>;
  /** Who this language is still waiting on before it may face the public. */
  reviewStage: LanguageReviewStage;
  publishedAt: string | null;
  scheduledFor: string | null;
  verifiedBy: { name: string | null } | null;
}

/** The contact's own fields, as the record currently holds them. */
export interface BasicInformationDetailValues {
  icon: string;
  priority: number;
  emergency: boolean;
  /** Whose phone rings, and therefore which public block draws this tile. */
  operator: "state" | "association";
  categoryId: string | null;
  dial: string | null;
  reach: string | null;
  dialInstead: string | null;
  answeredByOrganizationId: string | null;
}

/* ------------------------------------------------------------------ */
/* Content editor                                                     */
/* ------------------------------------------------------------------ */

/**
 * The whole record in one posting form, exactly as the articles editor does it:
 * `TranslationWorkspace` owns the eleven languages, the cards below own the
 * digits, and one Save at the bottom posts all of it to
 * `saveBasicInformation` — which reads the number and the words together
 * because a changed number invalidates every language's review.
 */
export function BasicInformationEditorForm({
  formId,
  locale,
  entryId,
  organizationId,
  sourceLanguage,
  detail,
  categories,
  organizations,
  languages,
  archived,
  abilities,
  aiEnabled,
  canVerify,
  returnPath,
  aside,
  labels,
  saveLabels,
  editorLabels,
}: {
  formId: string;
  locale: string;
  entryId: string;
  /** The association answering for the entry, when one does. */
  organizationId?: string;
  sourceLanguage: Language;
  detail: BasicInformationDetailValues;
  categories: BasicInformationOptionRow[];
  organizations: BasicInformationOptionRow[];
  /** Every language: its saved text, and where it stands on the server. */
  languages: BasicInformationLanguageStatus[];
  archived: boolean;
  abilities: Omit<LanguageMenuAbilities, "aiEnabled">;
  /** False when the deployment has no translation provider configured. */
  aiEnabled: boolean;
  canVerify: boolean;
  /** Dashboard path to revalidate after a per-language action. */
  returnPath: string;
  /** Freshness and history, shown beside the translation panel. */
  aside?: React.ReactNode;
  labels: Labels;
  saveLabels: { save: string; saved: string; saveError: string };
  /** The workspace's own vocabulary; see `~/lib/workspace-labels`. */
  editorLabels: Labels;
}) {
  const copy = (key: string) => labels[key] ?? key;
  const showActionError = useActionErrorToast();
  const [dial, setDial] = useState(detail.dial ?? "");
  const [reach, setReach] = useState(detail.reach ?? "voice");
  const [dialInstead, setDialInstead] = useState(detail.dialInstead ?? "");
  const [categoryId, setCategoryId] = useState(detail.categoryId ?? "");
  const [answeredBy, setAnsweredBy] = useState(
    detail.answeredByOrganizationId ?? "",
  );
  const hasDial = dial.trim() !== "";

  useEffect(() => {
    // Both halves of the pair move together, as on the create form: a tile with
    // no number cannot carry a reach or a fallback, and the database check
    // refuses the combination for every writer.
    if (!hasDial && dialInstead !== "") setDialInstead("");
  }, [dialInstead, hasDial]);

  const submit = async (formData: FormData) => {
    try {
      await saveBasicInformation(formData);
      toast.success(saveLabels.saved);
    } catch (error) {
      showActionError(error, saveLabels.saveError);
    }
  };

  /**
   * What each language's pane opens with. A language nobody has written yet
   * seeds nothing, so an empty row stays empty rather than posting a blank
   * label the save path would read as an authored language.
   */
  const initial: Partial<Record<Language, WorkspaceTranslation>> =
    Object.fromEntries(
      languages
        .filter((language) => language.saved)
        .map((language) => [
          language.code,
          {
            title: language.title ?? "",
            summary: language.summary ?? "",
            html: "",
            text: "",
            state: language.state,
            method: language.method,
            verifiedByName: language.verifiedBy?.name ?? null,
          } satisfies WorkspaceTranslation,
        ]),
    );

  /**
   * The per-language menu's world. Translation requests ride the article
   * action: an assignment is keyed by `editorial_entry` and this kind is one, so
   * an outside translator gets the same one-off link with no second lifecycle
   * to keep in step.
   */
  const workflow: WorkspaceWorkflow = {
    ownerField: "entryId",
    languages: Object.fromEntries(
      languages.map((language) => [
        language.code,
        {
          saved: language.saved,
          published: Boolean(language.publishedAt),
          scheduled: Boolean(language.scheduledFor),
          reviewStage: language.reviewStage,
        },
      ]),
    ),
    abilities,
    actions: {
      requestTranslation: requestArticleTranslation,
      publish: publishBasicInformationLanguage,
      unpublish: unpublishBasicInformationLanguage,
    },
    frozen: archived,
  };

  return (
    <div className="grid gap-5">
      <TranslationWorkspace
        entityKind="editorial_entry"
        entityId={entryId}
        organizationId={organizationId}
        interfaceLocale={locale}
        sourceLanguage={sourceLanguage}
        initial={initial}
        labels={editorLabels}
        names={articleFieldNames}
        // No body: the whole text of a contact is its label and the sentence
        // saying when to use it, and a language is only publishable with both.
        fields={{ summary: true, body: false }}
        canVerify={canVerify}
        aiEnabled={aiEnabled}
        returnPath={returnPath}
        workflow={workflow}
        formId={formId}
        media={aside}
      >
        <div className="@container mt-1">
          <div className="@xl:grid-cols-2 grid items-start gap-4">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-base">
                  {copy("detail.number")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Field>
                  <FieldLabel htmlFor="basics-dial">
                    {copy("field.dial")}
                  </FieldLabel>
                  <Input
                    id="basics-dial"
                    name="dial"
                    form={formId}
                    dir="ltr"
                    inputMode="tel"
                    autoComplete="off"
                    maxLength={40}
                    value={dial}
                    onChange={(event) => {
                      setDial(event.target.value);
                    }}
                    placeholder={copy("field.dialPlaceholder")}
                  />
                  <FieldDescription>{copy("field.dialHint")}</FieldDescription>
                </Field>
                {/* How a number is reached only exists while there is a number,
                 * and a fallback only exists for a number that is displayed. */}
                {hasDial ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="basics-reach">
                        {copy("field.reach")}
                      </FieldLabel>
                      <SelectField
                        id="basics-reach"
                        name="reach"
                        form={formId}
                        value={reach}
                        onValueChange={setReach}
                        required
                      >
                        {basicInformationReaches.map((value) => (
                          <option key={value} value={value}>
                            {copy(`reach.${value}`)}
                          </option>
                        ))}
                      </SelectField>
                      <FieldDescription>
                        {copy("field.reachHint")}
                      </FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="basics-dial-instead">
                        {copy("field.dialInstead")}
                      </FieldLabel>
                      <Input
                        id="basics-dial-instead"
                        name="dialInstead"
                        form={formId}
                        dir="ltr"
                        inputMode="tel"
                        autoComplete="off"
                        maxLength={40}
                        value={dialInstead}
                        onChange={(event) => {
                          setDialInstead(event.target.value);
                        }}
                        placeholder={copy("field.dialPlaceholder")}
                      />
                      <FieldDescription>
                        {copy("field.dialInsteadHint")}
                      </FieldDescription>
                    </Field>
                  </>
                ) : (
                  /* Both halves of the pair travel with the number. Posted as
                   * hidden inputs rather than left unmounted, because the save
                   * path reads them unconditionally and an absent `reach` on a
                   * tile that still has one would keep the old value. */
                  <>
                    <input type="hidden" name="reach" value="" form={formId} />
                    <input
                      type="hidden"
                      name="dialInstead"
                      value=""
                      form={formId}
                    />
                  </>
                )}
                <Field>
                  {/* A title rather than a label: the picker's trigger is a
                   * popover button carrying its own accessible name, and a
                   * `<label>` has nothing to point `htmlFor` at. */}
                  <FieldTitle>{copy("field.icon")}</FieldTitle>
                  <IconPicker
                    name="icon"
                    form={formId}
                    icons={taxonomyIconNames}
                    defaultValue={detail.icon}
                    ariaLabel={copy("field.icon")}
                    searchLabel={copy("icon.search")}
                    emptyLabel={copy("icon.empty")}
                  />
                  <FieldDescription>{copy("field.iconHint")}</FieldDescription>
                </Field>
                {/* Which of the two public blocks this tile is drawn in. A
                    select rather than a checkbox: "run by an association" and
                    "run by the State" are two named answers, and a tick box
                    would make one of them the unlabelled absence of the other
                    on a question the public page states out loud. */}
                <Field>
                  <FieldTitle>{copy("field.operator")}</FieldTitle>
                  <SelectField
                    name="operator"
                    form={formId}
                    defaultValue={detail.operator}
                    aria-label={copy("field.operator")}
                  >
                    <option value="state">
                      {copy("field.operator.state")}
                    </option>
                    <option value="association">
                      {copy("field.operator.association")}
                    </option>
                  </SelectField>
                  <FieldDescription>
                    {copy("field.operatorHint")}
                  </FieldDescription>
                </Field>
                <label className="border-line bg-subtle flex items-start gap-3 rounded-lg border p-3 text-sm">
                  <Checkbox
                    name="emergency"
                    form={formId}
                    className="mt-0.5"
                    defaultChecked={detail.emergency}
                  />
                  <span>
                    <span className="font-medium">
                      {copy("field.emergency")}
                    </span>
                    <span className="text-copy-muted mt-0.5 block text-xs">
                      {copy("field.emergencyHint")}
                    </span>
                  </span>
                </label>
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-base">
                  {copy("detail.overview")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {/* Who picks the phone up, which is not the same question as who
                 * answers for the number being right: a platform-owned tile can
                 * still print an association's line. Ownership itself is not
                 * editable here — moving custody is not a field on a form. */}
                <Field>
                  <FieldLabel htmlFor="basics-answered-by">
                    {copy("field.answeredBy")}
                  </FieldLabel>
                  <SearchableSelect
                    id="basics-answered-by"
                    name="answeredByOrganizationId"
                    form={formId}
                    options={[
                      { value: "", label: copy("field.answeredBy.none") },
                      ...organizations.map((organization) => ({
                        value: organization.id,
                        label: organization.label,
                      })),
                    ]}
                    value={answeredBy}
                    onValueChange={setAnsweredBy}
                    label={copy("field.answeredBy")}
                    placeholder={copy("field.answeredByPlaceholder")}
                    emptyLabel={copy("noMatch")}
                  />
                  <FieldDescription>
                    {copy("field.answeredByHint")}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="basics-category">
                    {copy("field.category")}
                  </FieldLabel>
                  <SearchableSelect
                    id="basics-category"
                    name="categoryId"
                    form={formId}
                    options={[
                      { value: "", label: copy("field.category.none") },
                      ...categories.map((category) => ({
                        value: category.id,
                        label: category.label,
                      })),
                    ]}
                    value={categoryId}
                    onValueChange={setCategoryId}
                    label={copy("field.category")}
                    placeholder={copy("field.categoryPlaceholder")}
                    emptyLabel={copy("noMatch")}
                  />
                  <FieldDescription>
                    {copy("field.categoryHint")}
                  </FieldDescription>
                </Field>
                {/* The number's own position. The whole block is reordered from
                 * the list, which is the surface where the sequence is legible;
                 * this stays because the save path reads it, and a single tile
                 * sometimes needs nudging without touching the rest. */}
                <Field>
                  <FieldLabel htmlFor="basics-priority">
                    {copy("field.priority")}
                  </FieldLabel>
                  <Input
                    id="basics-priority"
                    name="priority"
                    form={formId}
                    type="number"
                    min={0}
                    max={999}
                    inputMode="numeric"
                    defaultValue={String(detail.priority)}
                  />
                  <FieldDescription>
                    {copy("field.priorityHint")}
                  </FieldDescription>
                </Field>
              </CardContent>
            </Card>
          </div>
        </div>
      </TranslationWorkspace>
      {/* One posting form for the whole record: every control above carries
       * `form={formId}`, so the words, the digits and the icon arrive in the one
       * call `saveBasicInformation` expects — it reads the number and the text
       * together, because a number that moved is a number nobody has verified. */}
      <form id={formId} action={submit} className="grid justify-items-end">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="entryId" value={entryId} />
        <PendingButton>
          <CheckCircle2 aria-hidden />
          {saveLabels.save}
        </PendingButton>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Freshness                                                          */
/* ------------------------------------------------------------------ */

/**
 * "I have just checked this number and it still answers."
 *
 * The one action the whole kind is built around, and the reason it is its own
 * form rather than a field on the editor: confirming a number is not editing it,
 * and an editor who has just rung a line should not have to save the words to
 * record that. It posts to `confirmBasicInformation`, which moves the check date
 * and pushes the next one out by the interval chosen here.
 */
export function BasicInformationFreshnessForm({
  locale,
  entryId,
  reviewIntervalDays = BASIC_INFORMATION_REVIEW_DAYS,
  lastCheckedLabel,
  dueLabel,
  overdue,
  disabled = false,
  labels,
}: {
  locale: string;
  entryId: string;
  /** The interval the select opens on: what was chosen last time. */
  reviewIntervalDays?: number;
  /** "Last checked 4 Mar 2026", or the never-checked sentence. */
  lastCheckedLabel: string;
  /** "To check again by …" / "Overdue since …", when there is a date. */
  dueLabel: string | null;
  overdue: boolean;
  /** True on an archived contact: the action would be refused. */
  disabled?: boolean;
  labels: Labels;
}) {
  const copy = (key: string) => labels[key] ?? key;
  const showActionError = useActionErrorToast();
  const [interval, setInterval] = useState(String(reviewIntervalDays));
  const submit = async (formData: FormData) => {
    try {
      await confirmBasicInformation(formData);
      toast.success(copy("toast.confirmed"));
    } catch (error) {
      showActionError(error, copy("toast.actionError"));
    }
  };

  return (
    <form action={submit} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="entryId" value={entryId} />
      <div className="grid gap-1 text-sm">
        <span className="font-medium">{lastCheckedLabel}</span>
        {dueLabel ? (
          <span
            className={overdue ? "text-warn font-medium" : "text-copy-muted"}
          >
            {dueLabel}
          </span>
        ) : null}
      </div>
      <Field>
        <FieldLabel htmlFor="basics-review-interval">
          {copy("field.reviewInterval")}
        </FieldLabel>
        <SelectField
          id="basics-review-interval"
          name="reviewIntervalDays"
          value={interval}
          onValueChange={setInterval}
          disabled={disabled}
        >
          {basicInformationReviewIntervals.map((days) => (
            <option key={days} value={String(days)}>
              {copy(`interval.${String(days)}`)}
            </option>
          ))}
        </SelectField>
        <FieldDescription>{copy("field.reviewIntervalHint")}</FieldDescription>
      </Field>
      <FieldDescription>{copy("freshness.confirmHint")}</FieldDescription>
      <div className="flex justify-end">
        <PendingButton variant="secondary" disabled={disabled}>
          <ClipboardCheck aria-hidden />
          {copy("freshness.confirmAction")}
        </PendingButton>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Workflow bar                                                       */
/* ------------------------------------------------------------------ */

/**
 * Archive and restore, on the record itself. There is no "submit for review"
 * button: a contact is cleared one language at a time from the accordion, and
 * the review chain belongs to the language rather than to the number.
 */
export function BasicInformationWorkflowBar({
  locale,
  entryId,
  archived,
  canArchive,
  labels,
}: {
  locale: string;
  entryId: string;
  archived: boolean;
  /**
   * Only once nothing of it is published: what the public was told stays true
   * until someone takes it down, so the way out runs through the per-language
   * unpublish first. Decided on the server.
   */
  canArchive: boolean;
  labels: Labels;
}) {
  const copy = (key: string) => labels[key] ?? key;
  const showActionError = useActionErrorToast();
  const run = async (
    action: (formData: FormData) => Promise<void>,
    formData: FormData,
    success: string,
  ) => {
    try {
      await action(formData);
      toast.success(success);
    } catch (error) {
      showActionError(error, copy("toast.actionError"));
    }
  };

  if (archived) {
    return (
      <form
        action={(formData) =>
          run(restoreBasicInformation, formData, copy("toast.restored"))
        }
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="entryId" value={entryId} />
        <PendingButton variant="secondary">
          <Undo2 aria-hidden />
          {copy("action.restore")}
        </PendingButton>
      </form>
    );
  }

  if (!canArchive) return null;

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="ghost" className="text-danger gap-2" />}
      >
        <Archive className="size-4" aria-hidden />
        {copy("action.archive")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {copy("action.archiveConfirmTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {copy("action.archiveConfirmBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{copy("action.cancel")}</AlertDialogCancel>
          <form
            action={(formData) =>
              run(archiveBasicInformation, formData, copy("toast.archived"))
            }
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="entryId" value={entryId} />
            <PendingButton variant="danger" className="w-full">
              {copy("action.archiveConfirm")}
            </PendingButton>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Order of the block                                                 */
/* ------------------------------------------------------------------ */

/**
 * The order readers meet the numbers in, moved one step at a time.
 *
 * `priority` is a field on each record, but the decision it encodes is about the
 * block as a whole — 112 above a volunteer line, not beside it — so it is edited
 * here, as a sequence, and posted in one call. Move buttons rather than
 * drag-and-drop: this list is a handful of rows, and a keyboard has to be able
 * to do it.
 */
export function BasicInformationOrderForm({
  locale,
  entries,
  labels,
}: {
  locale: string;
  /** Non-archived contacts, in their current order. */
  entries: { id: string; title: string; emergency: boolean }[];
  labels: Labels;
}) {
  const copy = (key: string) => labels[key] ?? key;
  const showActionError = useActionErrorToast();
  const [order, setOrder] = useState(entries);

  const move = (index: number, delta: number) => {
    const next = [...order];
    const target = index + delta;
    const moved = next[index];
    const swapped = next[target];
    if (!moved || !swapped) return;
    next[index] = swapped;
    next[target] = moved;
    setOrder(next);
  };

  const submit = async (formData: FormData) => {
    try {
      await reorderBasicInformation(formData);
      toast.success(copy("order.saved"));
    } catch (error) {
      showActionError(error, copy("order.saveError"));
    }
  };

  return (
    <form action={submit} className="grid gap-3">
      <input type="hidden" name="locale" value={locale} />
      <ol className="grid gap-2">
        {order.map((entry, index) => (
          <li
            key={entry.id}
            className="border-line bg-subtle flex items-center gap-3 rounded-lg border px-3 py-2"
          >
            <input type="hidden" name="entryIds" value={entry.id} />
            <span className="text-copy-muted w-5 text-xs tabular-nums">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {entry.title}
            </span>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={copy("order.up")}
                disabled={index === 0}
                onClick={() => {
                  move(index, -1);
                }}
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={copy("order.down")}
                disabled={index === order.length - 1}
                onClick={() => {
                  move(index, 1);
                }}
              >
                ↓
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex justify-end">
        <PendingButton variant="secondary">{copy("order.save")}</PendingButton>
      </div>
    </form>
  );
}
