"use client";

import type { EditorContent, TranslationStrings } from "@inkpilot/editor";
import { LoaderCircle, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { proposeActivityTranslation } from "~/app/[locale]/dashboard/activities/ai-translation-actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  editorialLanguageCodes,
  isRtlEditorialLanguage,
  type EditorialLanguage,
} from "~/lib/editorial-languages";

const InkpilotEditor = dynamic(
  async () => (await import("@inkpilot/editor")).Editor,
  {
    ssr: false,
    loading: () => <div className="bg-subtle h-48 animate-pulse rounded-lg" />,
  },
);

type ContentValue = Pick<EditorContent, "html" | "text">;

export interface ActivityInitialTranslation {
  name: string;
  html: string;
  text: string;
  method?: "human" | "ai" | "ai_then_human_review";
}

const emptyContent = Object.fromEntries(
  editorialLanguageCodes.map((language) => [language, { html: "", text: "" }]),
) as Record<EditorialLanguage, ContentValue>;

export function ActivityTranslationsEditor({
  activityId,
  interfaceLocale,
  sourceLanguage = "fr",
  initial,
  labels,
}: {
  activityId?: string;
  interfaceLocale: string;
  sourceLanguage?: EditorialLanguage;
  /** Seed the fields when editing an existing activity; omit to start empty. */
  initial?: Partial<Record<EditorialLanguage, ActivityInitialTranslation>>;
  labels: Record<string, string>;
}) {
  const showActionError = useActionErrorToast();
  const orderedLanguages = [
    sourceLanguage,
    ...editorialLanguageCodes.filter((item) => item !== sourceLanguage),
  ];
  const [content, setContent] = useState<
    Record<EditorialLanguage, ContentValue>
  >(() =>
    initial
      ? (Object.fromEntries(
          editorialLanguageCodes.map((language) => [
            language,
            {
              html: initial[language]?.html ?? "",
              text: initial[language]?.text ?? "",
            },
          ]),
        ) as Record<EditorialLanguage, ContentValue>)
      : emptyContent,
  );
  const [names, setNames] = useState<Record<EditorialLanguage, string>>(
    () =>
      Object.fromEntries(
        editorialLanguageCodes.map((language) => [
          language,
          initial?.[language]?.name ?? "",
        ]),
      ) as Record<EditorialLanguage, string>,
  );
  const [methods, setMethods] = useState<
    Record<EditorialLanguage, "human" | "ai" | "ai_then_human_review">
  >(
    () =>
      Object.fromEntries(
        editorialLanguageCodes.map((language) => [
          language,
          initial?.[language]?.method ?? "human",
        ]),
      ) as Record<EditorialLanguage, "human" | "ai" | "ai_then_human_review">,
  );
  const [activeLanguage, setActiveLanguage] =
    useState<EditorialLanguage>(sourceLanguage);
  const [editorRevision, setEditorRevision] = useState<
    Record<EditorialLanguage, number>
  >(
    () =>
      Object.fromEntries(
        editorialLanguageCodes.map((language) => [language, 0]),
      ) as Record<EditorialLanguage, number>,
  );
  const [generatingLanguage, setGeneratingLanguage] =
    useState<EditorialLanguage | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = useCallback((key: string) => labels[key] ?? key, [labels]);
  const proposeTranslation = async (language: EditorialLanguage) => {
    if (!activityId) return;
    setGeneratingLanguage(language);
    try {
      const request = new FormData();
      request.set("locale", interfaceLocale);
      request.set("activityId", activityId);
      request.set("targetLanguageCode", language);
      const proposal = await proposeActivityTranslation(request);
      setNames((current) => ({ ...current, [language]: proposal.title }));
      setContent((current) => ({
        ...current,
        [language]: { html: proposal.html, text: proposal.text },
      }));
      setMethods((current) => ({ ...current, [language]: "ai" }));
      setEditorRevision((current) => ({
        ...current,
        [language]: current[language] + 1,
      }));
    } catch (error) {
      showActionError(error, label("aiError"));
    } finally {
      setGeneratingLanguage(null);
    }
  };

  const translations: Partial<TranslationStrings> = {
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
  };

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
      for (const editorRegion of root.querySelectorAll<HTMLElement>(
        "[data-rich-text-language]",
      )) {
        const editor = editorRegion.querySelector<HTMLElement>(".ProseMirror");
        if (!editor) continue;
        editor.setAttribute(
          "aria-label",
          editorRegion.dataset.editorLabel ?? label("description"),
        );
        editor.setAttribute(
          "dir",
          isRtlEditorialLanguage(
            editorRegion.dataset.richTextLanguage as EditorialLanguage,
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

  return (
    <div ref={rootRef}>
      <div className="mb-3">
        <h3 className="font-semibold">{labels.translations}</h3>
        <p className="text-copy-muted mt-1 text-xs">{labels.translationHint}</p>
      </div>
      <Tabs
        value={activeLanguage}
        onValueChange={(value) => {
          setActiveLanguage(value as EditorialLanguage);
        }}
      >
        <div className="mb-2 overflow-x-auto pb-1">
          <TabsList
            variant="line"
            className="group-data-horizontal/tabs:h-auto w-max min-w-full justify-start gap-x-1 pb-1"
          >
            {orderedLanguages.map((language) => (
              <TabsTrigger
                key={language}
                value={language}
                className="flex-none"
              >
                {label(`language.${language}`)}
                {language === sourceLanguage ? " ★" : ""}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {orderedLanguages.map((language) => {
          const isSource = language === sourceLanguage;
          const canPropose =
            Boolean(activityId) &&
            !isSource &&
            names[language].trim() === "" &&
            content[language].text.trim() === "";
          return (
            <TabsContent key={language} value={language} className="grid gap-4">
              {canPropose ? (
                <div className="border-brand/30 bg-brand-soft/50 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                  <p className="text-copy-muted text-xs">{label("aiHint")}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={generatingLanguage !== null}
                    onClick={() => {
                      void proposeTranslation(language);
                    }}
                  >
                    {generatingLanguage === language ? (
                      <LoaderCircle className="animate-spin" aria-hidden />
                    ) : (
                      <Sparkles aria-hidden />
                    )}
                    {generatingLanguage === language
                      ? label("aiWorking")
                      : label("aiPropose")}
                  </Button>
                </div>
              ) : null}
              <Field>
                <FieldLabel htmlFor={`activity-title-${language}`}>
                  {labels.title}
                </FieldLabel>
                <Input
                  id={`activity-title-${language}`}
                  name={`name_${language}`}
                  dir={isRtlEditorialLanguage(language) ? "rtl" : "ltr"}
                  value={names[language]}
                  onChange={(event) => {
                    setNames((current) => ({
                      ...current,
                      [language]: event.target.value,
                    }));
                    setMethods((current) => ({
                      ...current,
                      [language]:
                        current[language] === "ai"
                          ? "ai_then_human_review"
                          : current[language],
                    }));
                  }}
                  required={isSource}
                  minLength={isSource ? 2 : undefined}
                  maxLength={150}
                />
                {!isSource ? (
                  <FieldDescription>{labels.optional}</FieldDescription>
                ) : null}
              </Field>
              <Field>
                <FieldLabel>{labels.description}</FieldLabel>
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
                    key={`${language}-${String(editorRevision[language])}`}
                    className="calais-rich-text-editor"
                    locale={interfaceLocale}
                    content={{ html: content[language].html }}
                    i18n={{ translations }}
                    placeholder={labels.descriptionPlaceholder}
                    theme={{
                      mode: "auto",
                      preset: "minimal",
                      colors: {
                        primary: "var(--calais-accent)",
                        secondary: "var(--calais-surface-subtle)",
                        accent: "var(--calais-accent-soft)",
                        background: "var(--calais-surface)",
                        foreground: "var(--calais-ink)",
                        border: "var(--calais-border)",
                        muted: "var(--calais-surface-subtle)",
                        mutedForeground: "var(--calais-text-muted)",
                        error: "var(--calais-danger)",
                        warning: "var(--calais-warning)",
                        success: "var(--calais-success)",
                      },
                    }}
                    onChange={(nextContent) => {
                      setContent((current) => ({
                        ...current,
                        [language]: {
                          html: nextContent.html,
                          text: nextContent.text,
                        },
                      }));
                      setMethods((current) => ({
                        ...current,
                        [language]:
                          current[language] === "ai"
                            ? "ai_then_human_review"
                            : current[language],
                      }));
                    }}
                  />
                </div>
                <FieldDescription>{labels.descriptionHint}</FieldDescription>
              </Field>
            </TabsContent>
          );
        })}
      </Tabs>
      {editorialLanguageCodes.flatMap((language) => [
        <input
          key={`${language}-method`}
          type="hidden"
          name={`translation_method_${language}`}
          value={methods[language]}
        />,
        <input
          key={`${language}-html`}
          type="hidden"
          name={`description_${language}_html`}
          value={content[language].html}
        />,
        <input
          key={`${language}-text`}
          type="hidden"
          name={`description_${language}_text`}
          value={content[language].text}
        />,
      ])}
    </div>
  );
}
