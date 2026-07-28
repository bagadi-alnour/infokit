"use client";

import { formatMessage } from "@infokit/shared/i18n";
import {
  CheckCircle2,
  MailPlus,
  MoreHorizontal,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { upsertOrganizationPurpose } from "~/app/[locale]/dashboard/organizations/actions";
import {
  requestOrganizationTranslation,
  reviewOrganizationTranslation,
} from "~/app/[locale]/dashboard/organizations/translation-actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { TranslationRequestDialog } from "~/components/admin/language-publication";
import {
  LanguageStatusChip,
  type LanguageChipStatus,
} from "~/components/admin/language-status-chip";
import {
  AssignmentReviewDialog,
  canRequestTranslation,
  isAwaitingReview,
  type TranslationAssignmentSummary,
} from "~/components/admin/translation-assignment";
import { ReadOnlyField } from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Editable,
  EditableArea,
  EditableInput,
  EditableLabel,
  EditablePreview,
} from "~/components/ui/editable";
import { Textarea } from "~/components/ui/textarea";
import {
  editorialTextDirection,
  type EditorialLanguage,
} from "~/lib/editorial-languages";

/**
 * The organisation narrative, one language per row.
 *
 * Same shape as the article and activity editors (`translation-workspace.tsx`):
 * a row says how its language stands, its panel holds the text, and its menu
 * holds everything that language can be asked for. What a profile can be asked
 * for is shorter — it is written and translated, never published per language
 * and never sent through the platform's review chain — so the menu carries the
 * translator errand alone.
 *
 * The three paragraphs read as text and turn into fields where they are clicked,
 * so a panel opened to check the wording is not a wall of input boxes.
 */

type Labels = Record<string, string>;

type NarrativeState =
  "draft" | "machine_generated" | "needs_review" | "verified" | "rejected";

export interface OrganizationNarrativeLanguage {
  code: EditorialLanguage;
  purpose: string;
  goals: string;
  values: string;
  /** Absent until something is written in this language. */
  state: NarrativeState | null;
  /** The narrative moved after this language was translated from it. */
  stale: boolean;
  assignment: TranslationAssignmentSummary | null;
}

/** The three paragraphs, in the order they are read. */
const narrativeFields = [
  { name: "purpose", labelKey: "field.purpose", required: true },
  { name: "goals", labelKey: "field.goals", required: false },
  { name: "values", labelKey: "field.values", required: false },
] as const;

type FieldName = (typeof narrativeFields)[number]["name"];

type Draft = Record<FieldName, string>;

type OpenDialog = { kind: "request" | "review"; code: EditorialLanguage };

function draftFrom(language: OrganizationNarrativeLanguage): Draft {
  return {
    purpose: language.purpose,
    goals: language.goals,
    values: language.values,
  };
}

/**
 * Whether this language has anything to save. Compared trimmed because that is
 * what the action stores — otherwise a stray space would leave the row claiming
 * an unsaved change forever.
 */
function isDirty(draft: Draft, language: OrganizationNarrativeLanguage) {
  return narrativeFields.some(
    (field) => draft[field.name].trim() !== language[field.name].trim(),
  );
}

function countWords(text: string): number {
  const words = text.trim().split(/\s+/u);
  return words[0] === "" ? 0 : words.length;
}

export function OrganizationNarrativeEditor({
  locale,
  organizationId,
  sourceLanguage,
  languages,
  labels,
  hasSource,
  canWrite,
  canRequest,
  canReview,
}: {
  locale: EditorialLanguage;
  organizationId: string;
  sourceLanguage: EditorialLanguage;
  languages: readonly OrganizationNarrativeLanguage[];
  labels: Labels;
  /** No source version sealed yet: nothing can be handed to a translator. */
  hasSource: boolean;
  /** False on a record this actor may read but not maintain. */
  canWrite: boolean;
  /** Handing a language to a translator is its own permission. */
  canRequest: boolean;
  /** So is accepting what comes back onto the record. */
  canReview: boolean;
}) {
  const showActionError = useActionErrorToast();
  const label = (key: string) => labels[key] ?? key;
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      languages.map((language) => [language.code, draftFrom(language)]),
    ),
  );
  /**
   * The source language starts expanded: nothing can be translated before it
   * exists, so it is the row with something to do on an empty profile.
   */
  const [open, setOpen] = useState<string[]>([sourceLanguage]);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);

  const draftOf = (language: OrganizationNarrativeLanguage): Draft =>
    drafts[language.code] ?? draftFrom(language);
  const patch = (code: string, field: FieldName, value: string) => {
    setDrafts((current) => {
      const draft = current[code] ?? { purpose: "", goals: "", values: "" };
      return { ...current, [code]: { ...draft, [field]: value } };
    });
  };

  const source = languages.find((language) => language.code === sourceLanguage);
  /**
   * A translator receives the sealed source version, and saving is what seals
   * it. So an unsaved source narrative blocks every errand, whichever row the
   * errand is started from.
   */
  const sourceDirty = source ? isDirty(draftOf(source), source) : false;
  const sourceDraft = source ? draftOf(source) : null;
  const sourceWordCount = sourceDraft
    ? countWords(
        `${sourceDraft.purpose} ${sourceDraft.goals} ${sourceDraft.values}`,
      )
    : 0;

  const statusOf = (language: OrganizationNarrativeLanguage) => {
    if (language.code === sourceLanguage) return "source" as LanguageChipStatus;
    const draft = draftOf(language);
    if (!draft.purpose.trim()) return "empty" as LanguageChipStatus;
    if (isDirty(draft, language)) return "edited" as LanguageChipStatus;
    if (language.stale) return "stale" as LanguageChipStatus;
    switch (language.state) {
      case "verified":
        return "verified" as LanguageChipStatus;
      case "machine_generated":
        return "ai" as LanguageChipStatus;
      case "needs_review":
        return "review" as LanguageChipStatus;
      case "rejected":
        return "rejected" as LanguageChipStatus;
      default:
        return "draft" as LanguageChipStatus;
    }
  };

  /** One language's text, saved on its own so the others keep their drafts. */
  const save = async (formData: FormData) => {
    try {
      await upsertOrganizationPurpose(formData);
      toast.success(label("narrative.saved"));
    } catch (error) {
      showActionError(error, label("narrative.saveError"));
    }
  };

  /**
   * Everything this language can be asked for. The source language is asked for
   * nothing — it is the text the others are made from — and a reader with no
   * write access is offered no errands at all, so neither carries a menu.
   */
  const renderMenu = (language: OrganizationNarrativeLanguage) => {
    if (!canWrite || language.code === sourceLanguage) return null;
    const requestable =
      canRequest &&
      canRequestTranslation({
        isSource: false,
        assignment: language.assignment,
        hasSource,
        disabled: !canWrite,
      });
    const reviewable =
      canReview && isAwaitingReview(language.assignment) && language.assignment;
    /** Why the errand above is refused, before it is tried. */
    const hint = !hasSource
      ? label("translation.needsSource")
      : requestable && sourceDirty
        ? label("language.saveFirst")
        : null;
    if (!requestable && !reviewable && !hint) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={formatMessage(label("language.actionsFor"), {
                language: label(`language.${language.code}`),
              })}
            />
          }
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {requestable || hint ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel>{label("language.writeIt")}</DropdownMenuLabel>
              {requestable ? (
                <DropdownMenuItem
                  disabled={sourceDirty}
                  onClick={() => {
                    setDialog({ kind: "request", code: language.code });
                  }}
                >
                  <MailPlus aria-hidden />
                  {label("translation.request")}
                </DropdownMenuItem>
              ) : null}
              {hint ? (
                /* A sentence wraps; the items above do not. Without a width of
                 * its own it would set the menu's. */
                <p
                  role="presentation"
                  className="text-copy-muted max-w-52 px-1.5 py-1 text-xs"
                >
                  {hint}
                </p>
              ) : null}
            </DropdownMenuGroup>
          ) : null}
          {reviewable ? (
            <>
              {requestable || hint ? <DropdownMenuSeparator /> : null}
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {label("language.haveItRead")}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    setDialog({ kind: "review", code: language.code });
                  }}
                >
                  <CheckCircle2 aria-hidden />
                  {label("translation.review")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const dialogLanguage = dialog
    ? languages.find((language) => language.code === dialog.code)
    : undefined;

  return (
    <>
      <Accordion
        value={open}
        onValueChange={(next) => {
          setOpen(next as string[]);
        }}
      >
        {languages.map((language) => {
          const draft = draftOf(language);
          const status = statusOf(language);
          const dirty = isDirty(draft, language);
          const isSource = language.code === sourceLanguage;
          const dir = editorialTextDirection(language.code);
          const assignment = language.assignment;
          const menu = renderMenu(language);
          return (
            <AccordionItem key={language.code} value={language.code}>
              <div className="flex min-w-0 items-center gap-1">
                <AccordionTrigger className="min-w-0 flex-1 gap-2">
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <LanguageStatusChip status={status} code={language.code} />
                    <span className="min-w-0 truncate">
                      {label(`language.${language.code}`)}
                    </span>
                    <span className="text-copy-muted truncate text-xs font-normal">
                      {label(`status.${status}`)}
                    </span>
                    {assignment ? (
                      <span
                        className={
                          assignment.state === "submitted"
                            ? "text-warn shrink-0 text-xs font-normal"
                            : "text-copy-muted shrink-0 text-xs font-normal"
                        }
                      >
                        {label(`translation.state.${assignment.state}`)}
                      </span>
                    ) : null}
                  </span>
                </AccordionTrigger>
                {menu ? <div className="shrink-0">{menu}</div> : null}
              </div>
              {/* `h-auto` overrides the panel's measured height: base-ui
               * measures once, at open, and a field opened for editing is
               * taller than the text it replaced. */}
              <AccordionContent className="h-auto">
                <div className="grid gap-3">
                  <p className="text-copy-muted min-w-0 text-xs">
                    {assignment
                      ? `${formatMessage(label("translation.active"), {
                          email:
                            assignment.translatorName ??
                            assignment.translatorEmail,
                        })} · ${assignment.expiresAt}`
                      : isSource && !hasSource
                        ? label("translation.needsSource")
                        : canWrite
                          ? label("narrative.editHint")
                          : ""}
                  </p>

                  {status === "stale" ? (
                    <p className="border-warn/40 bg-warn-soft text-warn flex gap-2 rounded-lg border p-2.5 text-xs">
                      <TriangleAlert
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden
                      />
                      <span>{label("status.staleHint")}</span>
                    </p>
                  ) : null}

                  {canWrite ? (
                    <form action={save} className="grid gap-3">
                      <input type="hidden" name="locale" value={locale} />
                      <input
                        type="hidden"
                        name="organizationId"
                        value={organizationId}
                      />
                      <input
                        type="hidden"
                        name="languageCode"
                        value={language.code}
                      />
                      {narrativeFields.map((field) => (
                        <Editable
                          key={field.name}
                          name={field.name}
                          value={draft[field.name]}
                          onValueChange={(next) => {
                            patch(language.code, field.name, next);
                          }}
                          placeholder={label("narrative.placeholder")}
                          dir={dir}
                          required={field.required}
                          className="gap-1.5"
                        >
                          <EditableLabel className="text-copy-muted text-xs font-semibold uppercase tracking-wide">
                            {label(field.labelKey)}
                            {field.required ? null : (
                              <span className="ms-1 font-normal normal-case tracking-normal">
                                ({label("optional")})
                              </span>
                            )}
                          </EditableLabel>
                          <EditableArea className="block w-full">
                            <EditablePreview className="border-line/50 hover:border-line hover:bg-subtle/60 min-h-9 w-full text-clip whitespace-pre-wrap rounded-lg border-dashed px-2.5 py-2 text-sm" />
                            <EditableInput
                              className="min-h-16 rounded-lg px-2.5 py-2 text-sm"
                              render={<Textarea rows={3} />}
                            />
                          </EditableArea>
                        </Editable>
                      ))}
                      <div className="flex flex-wrap items-center gap-3">
                        <PendingButton variant="secondary" disabled={!dirty}>
                          {label("console.save")}
                        </PendingButton>
                        {dirty ? (
                          <span className="text-warn text-xs">
                            {label("language.saveFirst")}
                          </span>
                        ) : null}
                      </div>
                    </form>
                  ) : (
                    <div className="grid gap-3">
                      {narrativeFields.map((field) => (
                        <ReadOnlyField
                          key={field.name}
                          label={label(field.labelKey)}
                          value={language[field.name]}
                          dir={dir}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Dialogs are siblings of the rows: the menu that opened one has closed
       * by the time it is on screen. Keyed by language so the address typed for
       * one language never turns up in another's form. */}
      {dialogLanguage ? (
        <TranslationRequestDialog
          key={`request-${dialogLanguage.code}`}
          action={requestOrganizationTranslation}
          locale={locale}
          ownerField="organizationId"
          ownerId={organizationId}
          language={dialogLanguage.code}
          labels={labels}
          wordCount={sourceWordCount}
          open={dialog?.kind === "request"}
          onOpenChange={(next) => {
            if (!next) setDialog(null);
          }}
        />
      ) : null}
      {dialogLanguage?.assignment ? (
        <AssignmentReviewDialog
          key={`review-${dialogLanguage.code}`}
          action={reviewOrganizationTranslation}
          locale={locale}
          ownerField="organizationId"
          ownerId={organizationId}
          assignmentId={dialogLanguage.assignment.id}
          language={dialogLanguage.code}
          labels={labels}
          open={dialog?.kind === "review"}
          onOpenChange={(next) => {
            if (!next) setDialog(null);
          }}
        />
      ) : null}
    </>
  );
}
