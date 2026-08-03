"use client";

// See activity-translations-editor.tsx: the editor's chrome travels with it.
import "@inkpilot/editor/styles.css";

import type { EditorContent, TranslationStrings } from "@inkpilot/editor";
import {
  BadgeCheck,
  Check,
  CircleDashed,
  Globe,
  LoaderCircle,
  MailCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { proposeTranslation } from "~/app/[locale]/dashboard/ai-translation-actions";
import { verifyTranslation } from "~/app/[locale]/dashboard/translation-actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import {
  LanguageActionsMenu,
  type LanguageMenuAbilities,
  type LanguageMenuActions,
  type TranslationRequestStatus,
} from "~/components/admin/language-actions-menu";
import {
  LanguageAccordion,
  LanguageAccordionItem,
} from "~/components/admin/language-accordion";
import type { LanguageChipStatus } from "~/components/admin/language-status-chip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  editorialLanguageCodes,
  editorialTextDirection,
  type EditorialLanguage,
} from "~/lib/editorial-languages";
import {
  reviewPending,
  type LanguageReviewStage,
  type ReviewEntityKind,
} from "~/lib/language-review";

const InkpilotEditor = dynamic(
  async () => (await import("@inkpilot/editor")).Editor,
  {
    ssr: false,
    loading: () => <div className="bg-subtle h-48 animate-pulse rounded-lg" />,
  },
);

export type TranslationEntityKind =
  | "editorial_entry"
  | "activity"
  | "public_event"
  | "simulator_flow"
  | "organization_profile"
  | "place"
  | "service";

type SavedState =
  "draft" | "machine_generated" | "needs_review" | "verified" | "rejected";

export interface WorkspaceTranslation {
  title: string;
  /** Present where the entity carries a plain-language summary: an article. */
  summary?: string;
  html: string;
  text: string;
  /** Cover-image alternative text for this language, when the entity has one. */
  altText?: string;
  state?: SavedState;
  method?: "human" | "ai" | "ai_then_human_review";
  verifiedByName?: string | null;
  /** True when the source moved after this language was last checked. */
  stale?: boolean;
}

/**
 * Alternative text is part of the content a reader receives, so it is part of
 * what gets translated. The source value stays owned by the form that uploads
 * the image — it gates the upload — and the workspace carries the ten target
 * languages beside the title and body they belong to.
 */
export interface WorkspaceImageAlt {
  /** Live source-language alt text, owned by the parent form. */
  source: string;
}

/**
 * What each language posts as. Two families of forms feed this workspace and
 * they name their fields differently — an activity posts `name_en`, an article
 * posts `titleEN` — so the naming is a parameter rather than a second component.
 */
export interface WorkspaceFieldNames {
  title: string;
  summary?: string;
  bodyHtml: string;
  bodyText?: string;
  altText?: string;
  /** Carries the signature proving this text came from the machine. */
  proposal?: string;
}

/** How activities have always posted, and the default for anything like them. */
export function activityFieldNames(
  language: EditorialLanguage,
): WorkspaceFieldNames {
  return {
    title: `name_${language}`,
    bodyHtml: `description_${language}_html`,
    bodyText: `description_${language}_text`,
    altText: `image_alt_${language}`,
    proposal: `translation_proposal_${language}`,
  };
}

/** How articles post: an uppercased suffix, and a summary beside the body. */
export function articleFieldNames(
  language: EditorialLanguage,
): WorkspaceFieldNames {
  const upper = language.toUpperCase();
  return {
    title: `title${upper}`,
    summary: `summary${upper}`,
    bodyHtml: `body${upper}Html`,
    proposal: `translation_proposal_${language}`,
  };
}

/** Where one language stands on the server — not in the form. */
export interface WorkspaceLanguageWorkflow {
  /** A row for this language exists. */
  saved: boolean;
  published: boolean;
  scheduled: boolean;
  reviewStage: LanguageReviewStage;
  /**
   * An outside translator has sent their work back and nobody has read it yet.
   * Together with a machine draft, this is the case the "mark verified" button
   * exists for: somebody else wrote these words.
   */
  submitted?: boolean;
  /**
   * A translator request still waiting on its translator. Present, this language
   * is in somebody's hands: the menu says who has it and since when instead of
   * offering to send it to a second person.
   */
  translationRequest?: TranslationRequestStatus | null;
}

/**
 * The server-side life of every language, and what this actor may do to it.
 * Absent on a screen that only authors text — a simulator flow, a place — and
 * the accordion then carries no menu at all.
 */
export interface WorkspaceWorkflow {
  /** The hidden field the record posts as: `entryId`, `activityId`. */
  ownerField: string;
  languages: Partial<Record<EditorialLanguage, WorkspaceLanguageWorkflow>>;
  /** `aiEnabled` comes from the workspace's own prop. */
  abilities: Omit<LanguageMenuAbilities, "aiEnabled">;
  actions: Omit<LanguageMenuActions, "generate">;
  /** True on an archived record: every action would be refused. */
  frozen?: boolean;
}

type LanguageValue = {
  title: string;
  summary: string;
  html: string;
  text: string;
  altText: string;
  /** Set when this server generated the current text; proves provenance. */
  signature: string | null;
  savedState: SavedState | null;
  savedMethod: "human" | "ai" | "ai_then_human_review" | null;
  verifiedByName: string | null;
  stale: boolean;
  dirty: boolean;
};

function initialValues(
  initial: Partial<Record<EditorialLanguage, WorkspaceTranslation>> | undefined,
): Record<EditorialLanguage, LanguageValue> {
  return Object.fromEntries(
    editorialLanguageCodes.map((language) => {
      const seed = initial?.[language];
      return [
        language,
        {
          title: seed?.title ?? "",
          summary: seed?.summary ?? "",
          html: seed?.html ?? "",
          text: seed?.text ?? "",
          altText: seed?.altText ?? "",
          signature: null,
          savedState: seed?.state ?? null,
          savedMethod: seed?.method ?? null,
          verifiedByName: seed?.verifiedByName ?? null,
          stale: seed?.stale ?? false,
          dirty: false,
        } satisfies LanguageValue,
      ];
    }),
  ) as Record<EditorialLanguage, LanguageValue>;
}

/** Only these two kinds have a review chain and a per-language publication. */
function reviewKindOf(kind: TranslationEntityKind): ReviewEntityKind | null {
  return kind === "editorial_entry" || kind === "activity" ? kind : null;
}

function countWords(text: string): number {
  const words = text.trim().split(/\s+/u);
  return words[0] === "" ? 0 : words.length;
}

/**
 * Wrap a plain sentence as the one paragraph the generator expects, for an
 * entity with no rich-text body. Escaped because an editor's own words are
 * untrusted markup: the server sanitizes what comes back, and a stray `<` on the
 * way out should stay a `<` rather than open a tag.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function TranslationWorkspace({
  entityKind,
  entityId,
  organizationId,
  interfaceLocale,
  sourceLanguage,
  initial,
  labels,
  returnPath,
  canVerify = false,
  aiEnabled = true,
  imageAlt,
  fields,
  names = activityFieldNames,
  workflow,
  formId,
  media,
  children,
}: {
  entityKind: TranslationEntityKind;
  /** Absent on the creation form: nothing is saved yet. */
  entityId?: string;
  organizationId?: string;
  interfaceLocale: string;
  sourceLanguage: EditorialLanguage;
  initial?: Partial<Record<EditorialLanguage, WorkspaceTranslation>>;
  labels: Record<string, string>;
  /** Dashboard path to revalidate after a verification. */
  returnPath?: string;
  canVerify?: boolean;
  /**
   * False when the deployment has no translation provider configured. The
   * buttons then say so instead of firing a request that can only fail.
   */
  aiEnabled?: boolean;
  /** Present when the entity carries a cover image whose alt text translates. */
  imageAlt?: WorkspaceImageAlt;
  /**
   * Which fields this entity has in every language.
   *
   * `body: false` is for an entity whose whole text is a label and a sentence —
   * a basic-information tile, where the sentence saying when to dial a number is
   * the content and there is no article behind it. The rich-text editor is then
   * not rendered at all rather than rendered and ignored: an editor offered a
   * formatting toolbar reasonably assumes what they write in it is kept.
   */
  fields?: { summary?: boolean; body?: boolean };
  /** What each language posts as; activities by default. */
  names?: (language: EditorialLanguage) => WorkspaceFieldNames;
  /** Per-language publication and review, folded into each language's menu. */
  workflow?: WorkspaceWorkflow;
  /** Associates editor fields with a form rendered outside this workspace. */
  formId?: string;
  /**
   * Anything that belongs to the record as a whole rather than to one language —
   * the photo and its attachments. It follows the translation panel in the
   * inline-end column and stays out of the source column's reading order.
   */
  media?: React.ReactNode;
  /** Extra source-pane fields owned by the parent form. */
  children?: React.ReactNode;
}) {
  const showActionError = useActionErrorToast();
  const [values, setValues] = useState(() => initialValues(initial));
  const targetLanguages = useMemo(
    () => editorialLanguageCodes.filter((code) => code !== sourceLanguage),
    [sourceLanguage],
  );
  /**
   * Which language's panel is open. The first target language starts expanded:
   * the source is already spelled out in the pane beside it, so the row below
   * it is the first one with anything left to do.
   */
  const [open, setOpen] = useState<EditorialLanguage[]>(() => {
    const first = targetLanguages[0];
    return first ? [first] : [];
  });
  const [busy, setBusy] = useState<EditorialLanguage | null>(null);
  const [batchRemaining, setBatchRemaining] = useState(0);
  const [confirmMissingOpen, setConfirmMissingOpen] = useState(false);
  /** Remounts an editor when its content is replaced from outside. */
  const [revision, setRevision] = useState<Record<string, number>>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const label = useCallback((key: string) => labels[key] ?? key, [labels]);

  const source = values[sourceLanguage];
  const hasSummary = fields?.summary ?? false;
  const hasBody = fields?.body ?? true;
  const reviewKind = reviewKindOf(entityKind);
  const sourceWordCount = useMemo(
    () => countWords(`${source.title} ${source.summary} ${source.text}`),
    [source.summary, source.text, source.title],
  );

  const statusOf = useCallback(
    (language: EditorialLanguage): LanguageChipStatus => {
      if (language === sourceLanguage) return "source";
      const value = values[language];
      /**
       * A body-less entity needs both halves before the language counts as
       * started: its save path stores a language only when it has the label
       * *and* the sentence, so a chip reading "draft" over half a tile would be
       * describing work that is not going to be written down.
       */
      if (!value.title.trim() || (!hasBody && !value.summary.trim())) {
        return "empty";
      }
      if (value.dirty) return value.signature ? "generated" : "edited";
      if (value.stale) return "stale";
      switch (value.savedState) {
        case "verified":
          return "verified";
        case "machine_generated":
          return "ai";
        case "needs_review":
          return "review";
        case "rejected":
          return "rejected";
        default:
          return "draft";
      }
    },
    [hasBody, sourceLanguage, values],
  );

  const patch = useCallback(
    (language: EditorialLanguage, next: Partial<LanguageValue>) => {
      setValues((current) => ({
        ...current,
        [language]: { ...current[language], ...next },
      }));
    },
    [],
  );

  /**
   * Generate one language from whatever the source pane currently holds — the
   * saved source on an existing record, the unsaved draft during creation.
   */
  const generate = useCallback(
    async (language: EditorialLanguage) => {
      setBusy(language);
      try {
        const request = new FormData();
        request.set("locale", interfaceLocale);
        request.set("entityKind", entityKind);
        if (entityId) request.set("entityId", entityId);
        if (organizationId) request.set("organizationId", organizationId);
        request.set("targetLanguageCode", language);
        request.set("sourceLanguageCode", sourceLanguage);
        request.set("sourceTitle", source.title);
        /**
         * A body-less entity sends its summary as the payload to translate,
         * because that sentence *is* its text — a basic-information tile's
         * "when to use this number". The generator only ever translates a title
         * and a body, so the sentence travels as the body and comes back as one;
         * `applyProposal` below puts it back where it belongs.
         */
        request.set(
          "sourceBodyHtml",
          hasBody ? source.html : `<p>${escapeHtml(source.summary)}</p>`,
        );
        // Alt text travels with the payload it describes, so one request
        // returns a caption written by whoever wrote the surrounding text.
        if (imageAlt?.source.trim()) {
          request.set("sourceAltText", imageAlt.source);
        }
        const proposal = await proposeTranslation(request);
        patch(language, {
          title: proposal.title,
          html: proposal.html,
          text: proposal.text,
          // The translated sentence lands in the field the editor actually
          // reads. `html` still travels on save as the witness the signature
          // was taken over (see the basics action's `provenancePayload`).
          ...(hasBody ? {} : { summary: proposal.text }),
          altText: proposal.altText ?? "",
          signature: proposal.signature,
          savedState: proposal.saved ? "machine_generated" : null,
          savedMethod: proposal.saved ? "ai" : null,
          verifiedByName: null,
          stale: false,
          dirty: !proposal.saved,
        });
        setRevision((current) => ({
          ...current,
          [language]: (current[language] ?? 0) + 1,
        }));
        return true;
      } catch (error) {
        showActionError(error, label("ai.error"));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [
      entityId,
      entityKind,
      imageAlt?.source,
      interfaceLocale,
      label,
      organizationId,
      patch,
      showActionError,
      hasBody,
      source.html,
      source.summary,
      source.title,
      sourceLanguage,
    ],
  );

  /**
   * Fill every language that has no text yet. Each language's row updates as it
   * returns, so a ten-language sweep reads as progress rather than one freeze.
   */
  const generateMissing = useCallback(async () => {
    // "Missing" is the same question the chip asks, so a tile whose label was
    // filled in but whose sentence was not is still waiting to be written.
    const pending = targetLanguages.filter(
      (language) => statusOf(language) === "empty",
    );
    if (pending.length === 0) {
      toast.info(label("ai.nothingMissing"));
      return;
    }
    setBatchRemaining(pending.length);
    let failed = 0;
    for (const language of pending) {
      const ok = await generate(language);
      if (!ok) failed += 1;
      setBatchRemaining((remaining) => remaining - 1);
    }
    if (failed === 0) toast.success(label("ai.batchDone"));
  }, [generate, label, statusOf, targetLanguages]);

  const verify = useCallback(
    async (language: EditorialLanguage) => {
      if (!entityId) return;
      setBusy(language);
      try {
        const request = new FormData();
        request.set("locale", interfaceLocale);
        request.set("entityKind", entityKind);
        request.set("entityId", entityId);
        request.set("languageCode", language);
        if (returnPath) request.set("returnPath", returnPath);
        await verifyTranslation(request);
        patch(language, {
          savedState: "verified",
          stale: false,
          verifiedByName: label("verify.you"),
        });
        toast.success(label("verify.done"));
      } catch (error) {
        showActionError(error, label("verify.error"));
      } finally {
        setBusy(null);
      }
    },
    [
      entityId,
      entityKind,
      interfaceLocale,
      label,
      patch,
      returnPath,
      showActionError,
    ],
  );

  const translations: Partial<TranslationStrings> = useMemo(
    () => ({
      "toolbar.bold": label("bold"),
      "toolbar.italic": label("italic"),
      "toolbar.underline": label("underline"),
      "toolbar.strikethrough": label("strikethrough"),
      "toolbar.heading1": label("heading1"),
      "toolbar.heading2": label("heading2"),
      "toolbar.heading3": label("heading3"),
      "toolbar.bulletList": label("bulletList"),
      "toolbar.orderedList": label("orderedList"),
      "toolbar.blockquote": label("blockquote"),
      "toolbar.codeBlock": label("codeBlock"),
      "toolbar.image": label("image"),
      "toolbar.undo": label("undo"),
      "toolbar.redo": label("redo"),
      "general.placeholder": label("descriptionPlaceholder"),
    }),
    [label],
  );

  // The editor renders its own chrome, so direction and labels are applied to
  // the mounted DOM rather than passed as props.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const adaptEditor = () => {
      for (const toolbar of root.querySelectorAll<HTMLElement>(".wf-toolbar")) {
        toolbar.setAttribute("aria-label", label("formattingTools"));
      }
      for (const button of root.querySelectorAll<HTMLButtonElement>(
        ".wf-toolbar-btn",
      )) {
        if (button.getAttribute("aria-label") === label("image")) {
          button.hidden = true;
        }
      }
      for (const region of root.querySelectorAll<HTMLElement>(
        "[data-rich-text-language]",
      )) {
        const editor = region.querySelector<HTMLElement>(".ProseMirror");
        if (!editor) continue;
        editor.setAttribute("aria-label", region.dataset.editorLabel ?? "");
        editor.setAttribute(
          "dir",
          editorialTextDirection(
            region.dataset.richTextLanguage as EditorialLanguage,
          ),
        );
      }
    };
    adaptEditor();
    const observer = new MutationObserver(adaptEditor);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
    };
  }, [label]);

  const editorTheme = {
    mode: "auto" as const,
    preset: "minimal" as const,
    colors: {
      primary: "var(--infokit-accent)",
      secondary: "var(--infokit-surface-subtle)",
      accent: "var(--infokit-accent-soft)",
      background: "var(--infokit-surface)",
      foreground: "var(--infokit-ink)",
      border: "var(--infokit-border)",
      muted: "var(--infokit-surface-subtle)",
      mutedForeground: "var(--infokit-text-muted)",
      error: "var(--infokit-danger)",
      warning: "var(--infokit-warning)",
      success: "var(--infokit-success)",
    },
  };

  const renderEditor = (
    language: EditorialLanguage,
    value: LanguageValue,
    placeholder: string,
  ) => (
    <div
      data-rich-text-language={language}
      data-editor-label={`${label("description")} — ${label(`language.${language}`)}`}
      className="border-line overflow-hidden rounded-lg border"
      onPasteCapture={(event) => {
        if (
          [...event.clipboardData.items].some((item) =>
            item.type.startsWith("image/"),
          )
        ) {
          event.preventDefault();
        }
      }}
      onDropCapture={(event) => {
        if (
          [...event.dataTransfer.files].some((file) =>
            file.type.startsWith("image/"),
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <InkpilotEditor
        key={`${language}-${String(revision[language] ?? 0)}`}
        className="infokit-rich-text-editor"
        locale={interfaceLocale}
        content={{ html: value.html }}
        i18n={{ translations }}
        placeholder={placeholder}
        theme={editorTheme}
        onChange={(next: EditorContent) => {
          patch(language, {
            html: next.html,
            text: next.text,
            dirty: true,
          });
        }}
      />
    </div>
  );

  /**
   * The menu for one language. Before the first save there is no workflow to
   * offer — nothing has an id for a translator to open or a reviewer to read —
   * and the only thing a language can be asked for is its machine draft, so the
   * source language then has no menu at all.
   */
  const renderMenu = (language: EditorialLanguage) => {
    if (!reviewKind) return null;
    if (!workflow && language === sourceLanguage) return null;
    const value = values[language];
    const server = workflow?.languages[language];
    return (
      <LanguageActionsMenu
        target={{
          entityKind: reviewKind,
          entityId,
          ownerField: workflow?.ownerField ?? "",
          locale: interfaceLocale,
          returnPath,
        }}
        abilities={{
          canPublish: false,
          canTeamValidate: false,
          canPlatformVerify: false,
          canInvite: false,
          canGiveAccess: false,
          ...workflow?.abilities,
          aiEnabled,
        }}
        state={{
          code: language,
          isSource: language === sourceLanguage,
          hasText: Boolean(value.title.trim()),
          saved: server?.saved ? true : value.savedState !== null,
          dirty: value.dirty,
          published: server?.published ?? false,
          scheduled: server?.scheduled ?? false,
          reviewStage: server?.reviewStage ?? "none",
          wordCount: sourceWordCount,
          translationRequest: server?.translationRequest ?? null,
        }}
        actions={{
          ...workflow?.actions,
          generate:
            language === sourceLanguage
              ? undefined
              : () => {
                  void generate(language);
                },
        }}
        labels={labels}
        disabled={workflow?.frozen ?? false}
      />
    );
  };

  const batching = batchRemaining > 0;

  return (
    <div
      ref={rootRef}
      data-translation-workspace=""
      className="@container min-w-0"
    >
      {/* Source on the inline-start side, translations on the inline-end side.
       * Both are logical, so the whole workspace mirrors when an editor runs
       * the console in Arabic. The split is keyed to the space this component
       * actually has, not the viewport, because it sits inside a create card in
       * one place and a full-width editor pane in another. */}
      <div className="@3xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] @6xl:grid-cols-[minmax(0,1fr)_minmax(0,40rem)] grid min-w-0 gap-5">
        <div className="grid min-w-0 content-start gap-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{label("source.heading")}</h3>
            <span className="border-brand/40 bg-brand-soft text-brand rounded-full border px-2 py-0.5 text-[11px] font-medium">
              {label(`language.${sourceLanguage}`)}
            </span>
          </div>
          <Field>
            <FieldLabel htmlFor={`title-${sourceLanguage}`}>
              {label("title")}
            </FieldLabel>
            <Input
              id={`title-${sourceLanguage}`}
              name={names(sourceLanguage).title}
              form={formId}
              dir={editorialTextDirection(sourceLanguage)}
              value={source.title}
              onChange={(event) => {
                patch(sourceLanguage, {
                  title: event.target.value,
                  dirty: true,
                });
              }}
              required
              minLength={2}
              maxLength={200}
            />
          </Field>
          {hasSummary ? (
            <Field>
              <FieldLabel htmlFor={`summary-${sourceLanguage}`}>
                {label("summary")}
              </FieldLabel>
              <Textarea
                id={`summary-${sourceLanguage}`}
                name={names(sourceLanguage).summary}
                form={formId}
                dir={editorialTextDirection(sourceLanguage)}
                value={source.summary}
                onChange={(event) => {
                  patch(sourceLanguage, {
                    summary: event.target.value,
                    dirty: true,
                  });
                }}
                rows={hasBody ? 2 : 3}
                maxLength={2000}
                /* Where there is no body, this sentence is the content: an
                 * entry with a label and nothing else says nothing. */
                required={!hasBody}
              />
              <FieldDescription>{label("summaryHint")}</FieldDescription>
            </Field>
          ) : null}
          {hasBody ? (
            <Field>
              <FieldLabel>{label("description")}</FieldLabel>
              {renderEditor(
                sourceLanguage,
                source,
                label("descriptionPlaceholder"),
              )}
              <FieldDescription>{label("descriptionHint")}</FieldDescription>
            </Field>
          ) : null}
          {children}
        </div>

        {/* The record's own media follows the translation work: it belongs to
         * the record as a whole and is the next decision in this column. */}
        <div className="grid min-w-0 content-start gap-5">
          {/* A heading over a list, not a panel around one. Each language is
           * already a card of its own, and wrapping eleven cards in a twelfth
           * put a border inside a border with nothing between them to
           * separate. */}
          <section aria-label={label("rail.heading")} className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{label("rail.heading")}</h3>
              <AlertDialog
                open={confirmMissingOpen}
                onOpenChange={setConfirmMissingOpen}
              >
                <AlertDialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        !aiEnabled ||
                        busy !== null ||
                        batching ||
                        !source.title.trim()
                      }
                      title={aiEnabled ? undefined : label("ai.unavailable")}
                    />
                  }
                >
                  {batching ? (
                    <LoaderCircle className="animate-spin" aria-hidden />
                  ) : (
                    <Sparkles aria-hidden />
                  )}
                  {batching
                    ? label("ai.batchRunning").replace(
                        "{count}",
                        String(batchRemaining),
                      )
                    : label("ai.generateMissing")}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {label("ai.generateMissingConfirmTitle")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {label("ai.generateMissingConfirmDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      {label("ai.generateMissingCancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      type="button"
                      onClick={() => {
                        setConfirmMissingOpen(false);
                        void generateMissing();
                      }}
                    >
                      <Sparkles aria-hidden />
                      {label("ai.generateMissingConfirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <p className="text-copy-muted mt-1 text-xs">{label("rail.hint")}</p>
            {/* Without a provider, every generate button is a 500 waiting to
             * happen; say so once, at the top, instead of on each failure. */}
            {aiEnabled ? null : (
              <p className="border-warn/40 bg-warn-soft text-warn mt-2 flex gap-2 rounded-lg border p-2.5 text-xs">
                <TriangleAlert
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden
                />
                <span>{label("ai.unavailable")}</span>
              </p>
            )}

            {/*
            One row per language, in the order the platform lists them, so a
            language is always in the same place. Only the open panel mounts an
            editor — the text of the other ten travels in hidden inputs below,
            so nothing typed is ever lost to a collapsed row.
          */}
            <LanguageAccordion
              value={open}
              onValueChange={(next) => {
                setOpen(next as EditorialLanguage[]);
              }}
              className="mt-3"
            >
              {editorialLanguageCodes.map((language) => {
                const value = values[language];
                const status = statusOf(language);
                const isSource = language === sourceLanguage;
                const server = workflow?.languages[language];
                const stage = server?.reviewStage ?? "none";
                const languageName = label(`language.${language}`);
                const fieldNames = names(language);
                /**
                 * Somebody other than the editor in front of the screen wrote
                 * this — the machine, or an outside translator who has sent their
                 * work back. Those are the two cases worth confirming, so the
                 * "mark verified" button is offered for them and nothing else:
                 * countersigning one's own typing says nothing to a reader.
                 */
                const writtenElsewhere =
                  status === "generated" ||
                  status === "ai" ||
                  value.savedMethod === "ai" ||
                  value.savedMethod === "ai_then_human_review" ||
                  (server?.submitted ?? false);
                return (
                  <LanguageAccordionItem
                    key={language}
                    code={language}
                    name={languageName}
                    status={status}
                    statusLabel={label(`status.${status}`)}
                    busy={busy === language}
                    note={
                      isSource
                        ? label("source.inPane")
                        : status === "verified" && value.verifiedByName
                          ? `${label("verify.by")} ${value.verifiedByName}`
                          : ""
                    }
                    actions={renderMenu(language)}
                    notes={
                      <>
                        {server?.published ? (
                          <span className="text-ok inline-flex shrink-0 items-center gap-1 text-xs font-normal">
                            <Globe className="size-3" aria-hidden />
                            {label("workflow.live")}
                          </span>
                        ) : server?.scheduled ? (
                          <span className="text-brand shrink-0 text-xs font-normal">
                            {label("workflow.scheduled")}
                          </span>
                        ) : null}
                        {reviewPending(stage) ? (
                          <span className="text-warn shrink-0 text-xs font-normal">
                            {label(
                              stage === "team_requested"
                                ? "workflow.withTeam"
                                : "workflow.withPlatform",
                            )}
                          </span>
                        ) : stage === "platform_verified" &&
                          !server?.published &&
                          !server?.scheduled ? (
                          <span className="text-ok shrink-0 text-xs font-normal">
                            {label("workflow.cleared")}
                          </span>
                        ) : stage === "changes_requested" ? (
                          <span className="text-danger shrink-0 text-xs font-normal">
                            {label("workflow.changesRequested")}
                          </span>
                        ) : null}
                        {/* The row says the errand is out; the menu behind it
                         * says to whom and since when. */}
                        {server?.translationRequest ? (
                          <span className="text-copy-muted inline-flex shrink-0 items-center gap-1 text-xs font-normal">
                            <MailCheck className="size-3" aria-hidden />
                            {label("translation.requestedLabel")}
                          </span>
                        ) : null}
                      </>
                    }
                  >
                    {isSource ? null : (
                      <>
                        {/* Why this language is or is not trustworthy. */}
                        {status === "stale" ? (
                          <p className="border-warn/40 bg-warn-soft text-warn flex gap-2 rounded-lg border p-2.5 text-xs">
                            <TriangleAlert
                              className="mt-0.5 size-3.5 shrink-0"
                              aria-hidden
                            />
                            <span>{label("status.staleHint")}</span>
                          </p>
                        ) : null}
                        {status === "generated" || status === "ai" ? (
                          <p className="border-brand/30 bg-brand-soft/60 text-brand flex gap-2 rounded-lg border p-2.5 text-xs">
                            <CircleDashed
                              className="mt-0.5 size-3.5 shrink-0"
                              aria-hidden
                            />
                            <span>{label("status.aiHint")}</span>
                          </p>
                        ) : null}

                        <Field>
                          <FieldLabel htmlFor={`title-${language}`}>
                            {label("title")}
                          </FieldLabel>
                          <Input
                            id={`title-${language}`}
                            dir={editorialTextDirection(language)}
                            value={value.title}
                            onChange={(event) => {
                              patch(language, {
                                title: event.target.value,
                                dirty: true,
                              });
                            }}
                            maxLength={200}
                          />
                          <FieldDescription>
                            {label("optional")}
                          </FieldDescription>
                        </Field>
                        {hasSummary ? (
                          <Field>
                            <FieldLabel htmlFor={`summary-${language}`}>
                              {label("summary")}
                            </FieldLabel>
                            <Textarea
                              id={`summary-${language}`}
                              dir={editorialTextDirection(language)}
                              value={value.summary}
                              onChange={(event) => {
                                patch(language, {
                                  summary: event.target.value,
                                  dirty: true,
                                });
                              }}
                              rows={2}
                              maxLength={2000}
                            />
                          </Field>
                        ) : null}
                        {hasBody ? (
                          <Field>
                            <FieldLabel>{label("description")}</FieldLabel>
                            {renderEditor(
                              language,
                              value,
                              label("descriptionPlaceholder"),
                            )}
                          </Field>
                        ) : null}
                        {/* Alt text is worth translating once the source
                         * image has one. */}
                        {imageAlt?.source.trim() && fieldNames.altText ? (
                          <Field>
                            <FieldLabel htmlFor={`image-alt-${language}`}>
                              {label("imageAlt")}
                            </FieldLabel>
                            <Input
                              id={`image-alt-${language}`}
                              dir={editorialTextDirection(language)}
                              value={value.altText}
                              onChange={(event) => {
                                patch(language, {
                                  altText: event.target.value,
                                  dirty: true,
                                });
                              }}
                              maxLength={500}
                            />
                            <FieldDescription>
                              {label("imageAltSource")}: {imageAlt.source}
                            </FieldDescription>
                          </Field>
                        ) : null}

                        {canVerify &&
                        (writtenElsewhere || status === "verified") ? (
                          <Button
                            type="button"
                            variant={
                              status === "verified" ? "outline" : "default"
                            }
                            size="sm"
                            className="w-fit"
                            disabled={
                              !entityId ||
                              busy !== null ||
                              batching ||
                              value.dirty ||
                              !value.title.trim() ||
                              status === "verified"
                            }
                            title={
                              value.dirty
                                ? label("verify.saveFirst")
                                : undefined
                            }
                            onClick={() => {
                              void verify(language);
                            }}
                          >
                            {status === "verified" ? (
                              <BadgeCheck aria-hidden />
                            ) : (
                              <Check aria-hidden />
                            )}
                            {status === "verified"
                              ? label("verify.already")
                              : label("verify.action")}
                          </Button>
                        ) : null}
                        {value.dirty && status !== "verified" ? (
                          <p className="text-copy-muted text-xs">
                            {label("verify.saveFirst")}
                          </p>
                        ) : null}
                      </>
                    )}
                  </LanguageAccordionItem>
                );
              })}
            </LanguageAccordion>
          </section>
          {media ? <div className="min-w-0">{media}</div> : null}
        </div>
      </div>

      {/*
        Every language's text travels with the form, including the ones whose
        panel is collapsed, so opening and closing a row never silently drops
        work. `proposal` carries the signature that lets the server distinguish
        untouched machine output from output an editor has since edited.
      */}
      {editorialLanguageCodes.flatMap((language) => {
        const value = values[language];
        const fieldNames = names(language);
        const isSource = language === sourceLanguage;
        const posted: React.ReactNode[] = [
          <input
            key={`${language}-html`}
            type="hidden"
            name={fieldNames.bodyHtml}
            form={formId}
            value={value.html}
          />,
        ];
        if (fieldNames.bodyText) {
          posted.push(
            <input
              key={`${language}-text`}
              type="hidden"
              name={fieldNames.bodyText}
              form={formId}
              value={value.text}
            />,
          );
        }
        // The source language's title and summary are visible inputs in the
        // pane on the left, posting under these same names already.
        if (!isSource) {
          posted.push(
            <input
              key={`${language}-title`}
              type="hidden"
              name={fieldNames.title}
              form={formId}
              value={value.title}
            />,
          );
          if (hasSummary && fieldNames.summary) {
            posted.push(
              <input
                key={`${language}-summary`}
                type="hidden"
                name={fieldNames.summary}
                form={formId}
                value={value.summary}
              />,
            );
          }
        }
        if (imageAlt && fieldNames.altText) {
          posted.push(
            <input
              key={`${language}-alt`}
              type="hidden"
              name={fieldNames.altText}
              form={formId}
              value={isSource ? imageAlt.source : value.altText}
            />,
          );
        }
        if (value.signature && fieldNames.proposal) {
          posted.push(
            <input
              key={`${language}-proposal`}
              type="hidden"
              name={fieldNames.proposal}
              form={formId}
              value={value.signature}
            />,
          );
        }
        return posted;
      })}
    </div>
  );
}
