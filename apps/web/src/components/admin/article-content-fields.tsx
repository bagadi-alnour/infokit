"use client";

import type { EditorContent, TranslationStrings } from "@inkpilot/editor";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
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

const languages = editorialLanguageCodes;
type ContentLanguage = EditorialLanguage;

export interface ArticleLanguageContent {
  title: string;
  summary: string;
  bodyHtml: string;
}

export type ArticleContentValue = Record<
  ContentLanguage,
  ArticleLanguageContent
>;

export const emptyArticleContent: ArticleContentValue = {
  fr: { title: "", summary: "", bodyHtml: "" },
  en: { title: "", summary: "", bodyHtml: "" },
  ar: { title: "", summary: "", bodyHtml: "" },
  fa: { title: "", summary: "", bodyHtml: "" },
  prs: { title: "", summary: "", bodyHtml: "" },
  ps: { title: "", summary: "", bodyHtml: "" },
  ckb: { title: "", summary: "", bodyHtml: "" },
  ti: { title: "", summary: "", bodyHtml: "" },
  am: { title: "", summary: "", bodyHtml: "" },
  om: { title: "", summary: "", bodyHtml: "" },
  so: { title: "", summary: "", bodyHtml: "" },
};

/**
 * Authoring fields for every configured editorial language: title,
 * plain-language summary, and a rich body. Body HTML rides along as hidden
 * inputs so the whole thing posts inside a normal server-action form.
 * `sourceLanguage` decides which tab is required and shown first.
 */
export function ArticleContentFields({
  interfaceLocale,
  sourceLanguage,
  initial = emptyArticleContent,
  labels,
}: {
  interfaceLocale: string;
  sourceLanguage: ContentLanguage;
  initial?: ArticleContentValue;
  labels: Record<string, string>;
}) {
  const [content, setContent] = useState<ArticleContentValue>(initial);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = useCallback((key: string) => labels[key] ?? key, [labels]);

  const translations: Partial<TranslationStrings> = {
    "toolbar.bold": label("toolbar.bold"),
    "toolbar.italic": label("toolbar.italic"),
    "toolbar.underline": label("toolbar.underline"),
    "toolbar.strikethrough": label("toolbar.strikethrough"),
    "toolbar.heading2": label("toolbar.heading2"),
    "toolbar.heading3": label("toolbar.heading3"),
    "toolbar.bulletList": label("toolbar.bulletList"),
    "toolbar.orderedList": label("toolbar.orderedList"),
    "toolbar.blockquote": label("toolbar.blockquote"),
    "toolbar.codeBlock": label("toolbar.codeBlock"),
    "toolbar.image": label("toolbar.image"),
    "toolbar.undo": label("toolbar.undo"),
    "toolbar.redo": label("toolbar.redo"),
    "general.placeholder": label("field.bodyPlaceholder"),
  };

  // Hide the image button (media is a separate, rights-gated flow) and give
  // each editor region an accessible name and correct direction.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const adaptEditor = () => {
      for (const toolbar of root.querySelectorAll<HTMLElement>(".wf-toolbar")) {
        toolbar.setAttribute("aria-label", label("toolbar.formattingTools"));
      }
      for (const button of root.querySelectorAll<HTMLButtonElement>(
        ".wf-toolbar-btn",
      )) {
        if (button.getAttribute("aria-label") === label("toolbar.image")) {
          button.hidden = true;
        }
      }
      for (const region of root.querySelectorAll<HTMLElement>(
        "[data-rich-text-language]",
      )) {
        const editor = region.querySelector<HTMLElement>(".ProseMirror");
        if (!editor) continue;
        editor.setAttribute(
          "aria-label",
          region.dataset.editorLabel ?? label("field.body"),
        );
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

  const orderedLanguages = [
    sourceLanguage,
    ...languages.filter((language) => language !== sourceLanguage),
  ];

  return (
    <div ref={rootRef} className="grid gap-3">
      <Tabs defaultValue={sourceLanguage}>
        <TabsList
          variant="line"
          className="group-data-horizontal/tabs:h-auto mb-2 max-w-full flex-wrap justify-start gap-x-1 gap-y-2 pb-1"
        >
          {orderedLanguages.map((language) => (
            <TabsTrigger key={language} value={language} className="flex-none">
              {labels[`language.${language}`]}
              {language === sourceLanguage ? " ★" : ""}
            </TabsTrigger>
          ))}
        </TabsList>
        {orderedLanguages.map((language) => {
          const isSource = language === sourceLanguage;
          const rtl = isRtlEditorialLanguage(language);
          return (
            <TabsContent key={language} value={language} className="grid gap-4">
              <Field>
                <FieldLabel htmlFor={`article-title-${language}`}>
                  {labels["field.title"]}
                </FieldLabel>
                <Input
                  id={`article-title-${language}`}
                  name={`title${language.toUpperCase()}`}
                  dir={rtl ? "rtl" : "ltr"}
                  defaultValue={initial[language].title}
                  required={isSource}
                  minLength={isSource ? 2 : undefined}
                  maxLength={200}
                  autoComplete="off"
                />
                {!isSource ? (
                  <FieldDescription>
                    {labels["language.optional"]}
                  </FieldDescription>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor={`article-summary-${language}`}>
                  {labels["field.summary"]}
                </FieldLabel>
                <Textarea
                  id={`article-summary-${language}`}
                  name={`summary${language.toUpperCase()}`}
                  dir={rtl ? "rtl" : "ltr"}
                  defaultValue={initial[language].summary}
                  rows={2}
                  maxLength={2000}
                />
                <FieldDescription>
                  {labels["field.summaryHint"]}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>{labels["field.body"]}</FieldLabel>
                <div
                  data-rich-text-language={language}
                  data-editor-label={`${label("field.body")} — ${label(`language.${language}`)}`}
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
                    className="calais-rich-text-editor"
                    locale={interfaceLocale}
                    content={{ html: initial[language].bodyHtml }}
                    i18n={{ translations }}
                    placeholder={labels["field.bodyPlaceholder"]}
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
                    onChange={(next: EditorContent) => {
                      setContent((current) => ({
                        ...current,
                        [language]: {
                          ...current[language],
                          bodyHtml: next.html,
                        },
                      }));
                    }}
                  />
                </div>
              </Field>
            </TabsContent>
          );
        })}
      </Tabs>
      {languages.map((language) => (
        <input
          key={`${language}-html`}
          type="hidden"
          name={`body${language.toUpperCase()}Html`}
          value={content[language].bodyHtml}
        />
      ))}
    </div>
  );
}
