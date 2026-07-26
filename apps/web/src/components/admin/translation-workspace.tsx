"use client";

import type { EditorContent, TranslationStrings } from "@inkpilot/editor";
import {
  BadgeCheck,
  Check,
  CircleDashed,
  LoaderCircle,
  Send,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { proposeTranslation } from "~/app/[locale]/dashboard/ai-translation-actions";
import { verifyTranslation } from "~/app/[locale]/dashboard/translation-actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { TooltipHint } from "~/components/admin/tooltip-hint";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import {
  editorialLanguageCodes,
  isRtlEditorialLanguage,
  type EditorialLanguage,
} from "~/lib/editorial-languages";
import { cn } from "~/lib/utils";

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
 * How one language reads at a glance. Ordering matters: an unsaved change
 * outranks whatever the database still believes, and staleness outranks a
 * verification that no longer describes the current source.
 */
type ChipStatus =
  | "source"
  | "empty"
  | "generated"
  | "edited"
  | "stale"
  | "verified"
  | "ai"
  | "review"
  | "rejected"
  | "draft";

const statusTone: Record<ChipStatus, string> = {
  source: "border-brand/40 bg-brand-soft text-brand",
  empty: "border-line text-copy-muted",
  generated: "border-brand/40 bg-brand-soft text-brand",
  edited: "border-warn/40 bg-warn-soft text-warn",
  stale: "border-warn/50 bg-warn-soft text-warn",
  verified: "border-ok/40 bg-ok-soft text-ok",
  ai: "border-brand/30 bg-brand-soft/60 text-brand",
  review: "border-warn/40 bg-warn-soft text-warn",
  rejected: "border-danger/40 bg-danger-soft text-danger",
  draft: "border-line text-copy-muted",
};

/** A glyph carries the state for anyone who cannot separate these hues. */
const statusGlyph: Record<ChipStatus, string> = {
  source: "★",
  empty: "○",
  generated: "◐",
  edited: "●",
  stale: "!",
  verified: "✓",
  ai: "◐",
  review: "◑",
  rejected: "✕",
  draft: "◌",
};

type LanguageValue = {
  title: string;
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
  onRequestTranslation,
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
   * Override how a translation is requested. The default reaches the
   * assignment dialog the page already renders, so the form that emails an
   * outside translator exists in exactly one place.
   */
  onRequestTranslation?: (language: EditorialLanguage) => void;
  /** Extra source-pane fields owned by the parent form. */
  children?: React.ReactNode;
}) {
  const showActionError = useActionErrorToast();
  const [values, setValues] = useState(() => initialValues(initial));
  const targetLanguages = useMemo(
    () => editorialLanguageCodes.filter((code) => code !== sourceLanguage),
    [sourceLanguage],
  );
  const [activeTarget, setActiveTarget] = useState<EditorialLanguage>(
    () => targetLanguages[0] ?? "en",
  );
  const [busy, setBusy] = useState<EditorialLanguage | null>(null);
  const [batchRemaining, setBatchRemaining] = useState(0);
  /** Remounts an editor when its content is replaced from outside. */
  const [revision, setRevision] = useState<Record<string, number>>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const label = useCallback((key: string) => labels[key] ?? key, [labels]);

  const source = values[sourceLanguage];
  const active = values[activeTarget];

  /**
   * Requesting a translation emails an outside translator, so the rail does not
   * own that form — it opens the one the assignment panel already renders for
   * this language. The trigger is absent while the record is unsaved, and on
   * any page without the panel, so say why instead of failing silently.
   */
  const requestTranslation = useCallback(
    (language: EditorialLanguage) => {
      if (onRequestTranslation) {
        onRequestTranslation(language);
        return;
      }
      const trigger = document.getElementById(
        `request-translation-${language}`,
      );
      if (!trigger) {
        toast.info(label("request.unavailable"));
        return;
      }
      trigger.scrollIntoView({ block: "center" });
      trigger.click();
    },
    [label, onRequestTranslation],
  );

  const statusOf = useCallback(
    (language: EditorialLanguage): ChipStatus => {
      if (language === sourceLanguage) return "source";
      const value = values[language];
      if (!value.title.trim()) return "empty";
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
    [sourceLanguage, values],
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
        request.set("sourceBodyHtml", source.html);
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
          altText: proposal.altText ?? "",
          signature: proposal.signature,
          dirty: true,
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
      source.html,
      source.title,
      sourceLanguage,
    ],
  );

  /**
   * Fill every language that has no text yet. Chips update as each returns, so
   * a ten-language sweep reads as progress rather than one long freeze.
   */
  const generateMissing = useCallback(async () => {
    const pending = targetLanguages.filter(
      (language) => !values[language].title.trim(),
    );
    if (pending.length === 0) {
      toast.info(label("ai.nothingMissing"));
      return;
    }
    setBatchRemaining(pending.length);
    let failed = 0;
    for (const language of pending) {
      setActiveTarget(language);
      const ok = await generate(language);
      if (!ok) failed += 1;
      setBatchRemaining((remaining) => remaining - 1);
    }
    if (failed === 0) toast.success(label("ai.batchDone"));
  }, [generate, label, targetLanguages, values]);

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
          isRtlEditorialLanguage(
            region.dataset.richTextLanguage as EditorialLanguage,
          )
            ? "rtl"
            : "ltr",
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

  const activeStatus = statusOf(activeTarget);
  const busyHere = busy === activeTarget;
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
              name={`name_${sourceLanguage}`}
              dir={isRtlEditorialLanguage(sourceLanguage) ? "rtl" : "ltr"}
              value={source.title}
              onChange={(event) => {
                patch(sourceLanguage, {
                  title: event.target.value,
                  dirty: true,
                });
              }}
              required
              minLength={2}
              maxLength={150}
            />
          </Field>
          <Field>
            <FieldLabel>{label("description")}</FieldLabel>
            {renderEditor(
              sourceLanguage,
              source,
              label("descriptionPlaceholder"),
            )}
            <FieldDescription>{label("descriptionHint")}</FieldDescription>
          </Field>
          {children}
        </div>

        <aside
          aria-label={label("rail.heading")}
          className="border-line bg-subtle/40 @3xl:sticky @3xl:top-20 @3xl:max-h-[calc(100vh-6rem)] @3xl:overflow-y-auto min-w-0 rounded-xl border p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{label("rail.heading")}</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                !aiEnabled || busy !== null || batching || !source.title.trim()
              }
              title={aiEnabled ? undefined : label("ai.unavailable")}
              onClick={() => {
                void generateMissing();
              }}
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
            </Button>
          </div>
          <p className="text-copy-muted mt-1 text-xs">{label("rail.hint")}</p>
          {/* Without a provider, every generate button is a 500 waiting to
           * happen; say so once, at the top, instead of on each failure. */}
          {aiEnabled ? null : (
            <p className="border-warn/40 bg-warn-soft text-warn mt-2 flex gap-2 rounded-lg border p-2.5 text-xs">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{label("ai.unavailable")}</span>
            </p>
          )}

          {/* Every language at a glance; the pane below shows one of them. */}
          <div
            role="tablist"
            aria-label={label("rail.languages")}
            className="mt-3 flex flex-wrap gap-1.5"
          >
            {editorialLanguageCodes.map((language) => {
              const status = statusOf(language);
              const isSource = language === sourceLanguage;
              const selected = !isSource && language === activeTarget;
              const chipLabel = `${label(`language.${language}`)} — ${label(`status.${status}`)}`;
              return (
                // The chip shows a glyph and two letters, so its name lives in
                // the tooltip. `aria-disabled` rather than `disabled` for the
                // source language: a disabled button fires no hover, and the
                // one chip an editor is most likely to point at would then be
                // the only one that stays silent.
                <TooltipHint key={language} label={chipLabel}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-disabled={isSource}
                    aria-label={chipLabel}
                    onClick={() => {
                      if (!isSource) setActiveTarget(language);
                    }}
                    className={cn(
                      "focus-visible:ring-brand/50 flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2",
                      statusTone[status],
                      isSource
                        ? "cursor-default"
                        : "hover:border-brand/50 cursor-pointer",
                      selected && "ring-brand/60 ring-2",
                    )}
                  >
                    <span aria-hidden>{statusGlyph[status]}</span>
                    {/* The ISO code stays legible in every interface language,
                     * and 11 endonyms would not fit the strip. */}
                    <span>{language.toUpperCase()}</span>
                  </button>
                </TooltipHint>
              );
            })}
          </div>

          <Separator className="my-3" />

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="grid">
                <span className="text-sm font-semibold">
                  {label(`language.${activeTarget}`)}
                </span>
                <span className="text-copy-muted text-xs">
                  {label(`status.${activeStatus}`)}
                  {active.verifiedByName && activeStatus === "verified"
                    ? ` · ${active.verifiedByName}`
                    : ""}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
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
                  onClick={() => {
                    void generate(activeTarget);
                  }}
                >
                  {busyHere ? (
                    <LoaderCircle className="animate-spin" aria-hidden />
                  ) : (
                    <Sparkles aria-hidden />
                  )}
                  {active.title.trim()
                    ? label("ai.regenerate")
                    : label("ai.generate")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!entityId}
                  title={
                    entityId ? undefined : label("request.needsSavedSource")
                  }
                  onClick={() => {
                    requestTranslation(activeTarget);
                  }}
                >
                  <Send aria-hidden />
                  {label("request.action")}
                </Button>
              </div>
            </div>

            {/* Why this language is or is not trustworthy right now. */}
            {activeStatus === "stale" ? (
              <p className="border-warn/40 bg-warn-soft text-warn flex gap-2 rounded-lg border p-2.5 text-xs">
                <TriangleAlert
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden
                />
                <span>{label("status.staleHint")}</span>
              </p>
            ) : null}
            {activeStatus === "generated" || activeStatus === "ai" ? (
              <p className="border-brand/30 bg-brand-soft/60 text-brand flex gap-2 rounded-lg border p-2.5 text-xs">
                <CircleDashed
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden
                />
                <span>{label("status.aiHint")}</span>
              </p>
            ) : null}

            <Field>
              <FieldLabel htmlFor={`title-${activeTarget}`}>
                {label("title")}
              </FieldLabel>
              <Input
                id={`title-${activeTarget}`}
                dir={isRtlEditorialLanguage(activeTarget) ? "rtl" : "ltr"}
                value={active.title}
                onChange={(event) => {
                  patch(activeTarget, {
                    title: event.target.value,
                    dirty: true,
                  });
                }}
                maxLength={150}
              />
              <FieldDescription>{label("optional")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>{label("description")}</FieldLabel>
              {renderEditor(
                activeTarget,
                active,
                label("descriptionPlaceholder"),
              )}
            </Field>
            {/* Alt text is only worth translating once the source has one. */}
            {imageAlt?.source.trim() ? (
              <Field>
                <FieldLabel htmlFor={`image-alt-${activeTarget}`}>
                  {label("imageAlt")}
                </FieldLabel>
                <Input
                  id={`image-alt-${activeTarget}`}
                  dir={isRtlEditorialLanguage(activeTarget) ? "rtl" : "ltr"}
                  value={active.altText}
                  onChange={(event) => {
                    patch(activeTarget, {
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

            {canVerify ? (
              <Button
                type="button"
                variant={activeStatus === "verified" ? "outline" : "default"}
                size="sm"
                disabled={
                  !entityId ||
                  busy !== null ||
                  batching ||
                  active.dirty ||
                  !active.title.trim() ||
                  activeStatus === "verified"
                }
                title={active.dirty ? label("verify.saveFirst") : undefined}
                onClick={() => {
                  void verify(activeTarget);
                }}
              >
                {activeStatus === "verified" ? (
                  <BadgeCheck aria-hidden />
                ) : (
                  <Check aria-hidden />
                )}
                {activeStatus === "verified"
                  ? label("verify.already")
                  : label("verify.action")}
              </Button>
            ) : null}
            {active.dirty && activeStatus !== "verified" ? (
              <p className="text-copy-muted text-xs">
                {label("verify.saveFirst")}
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      {/*
        Every language's text travels with the form, including the ones not on
        screen, so switching chips never silently drops work. `translation_
        proposal_*` carries the signature that lets the server distinguish
        untouched machine output from output an editor has edited.
      */}
      {editorialLanguageCodes.flatMap((language) => {
        const value = values[language];
        const fields = [
          <input
            key={`${language}-html`}
            type="hidden"
            name={`description_${language}_html`}
            value={value.html}
          />,
          <input
            key={`${language}-text`}
            type="hidden"
            name={`description_${language}_text`}
            value={value.text}
          />,
        ];
        if (language !== sourceLanguage) {
          fields.push(
            <input
              key={`${language}-name`}
              type="hidden"
              name={`name_${language}`}
              value={value.title}
            />,
          );
        }
        if (imageAlt) {
          fields.push(
            <input
              key={`${language}-alt`}
              type="hidden"
              name={`image_alt_${language}`}
              value={
                language === sourceLanguage ? imageAlt.source : value.altText
              }
            />,
          );
        }
        if (value.signature) {
          fields.push(
            <input
              key={`${language}-proposal`}
              type="hidden"
              name={`translation_proposal_${language}`}
              value={value.signature}
            />,
          );
        }
        return fields;
      })}
    </div>
  );
}
