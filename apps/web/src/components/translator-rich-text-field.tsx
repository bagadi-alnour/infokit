"use client";

// See translation-workspace.tsx: the editor's chrome travels with it.
import "@inkpilot/editor/styles.css";

import type { EditorContent, TranslationStrings } from "@inkpilot/editor";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

const InkpilotEditor = dynamic(
  async () => (await import("@inkpilot/editor")).Editor,
  {
    ssr: false,
    loading: () => <div className="bg-subtle h-64 animate-pulse rounded-lg" />,
  },
);

/**
 * The translator's body field, when the text they were sent is rich text.
 *
 * A source written with headings, lists and links has to come back with them:
 * asked for the same article in a plain box, a translator either loses the
 * structure or hand-writes markup nobody asked them for. So the field they get
 * matches the field it was written in — the same editor the newsroom used,
 * mirrored for the language they are writing.
 *
 * Only the markup travels. The plain-text rendering is derived on the server
 * from what arrives (`sanitizeRichText`), because a browser is free to send any
 * pair of html and text it likes and only one of the two is the content.
 */
export function TranslatorRichTextField({
  name,
  locale,
  direction,
  defaultHtml,
  placeholder,
  labels,
}: {
  /** The form field the markup posts as. */
  name: string;
  locale: string;
  direction: "ltr" | "rtl";
  /** A draft this translator already saved, reopened. */
  defaultHtml: string;
  placeholder: string;
  /** The editor's own vocabulary, in the interface language. */
  labels: Record<string, string>;
}) {
  const [html, setHtml] = useState(defaultHtml);

  const translations: Partial<TranslationStrings> = useMemo(
    () => ({
      "toolbar.bold": labels.bold ?? "Bold",
      "toolbar.italic": labels.italic ?? "Italic",
      "toolbar.underline": labels.underline ?? "Underline",
      "toolbar.strikethrough": labels.strikethrough ?? "Strikethrough",
      "toolbar.heading1": labels.heading1 ?? "Heading 1",
      "toolbar.heading2": labels.heading2 ?? "Heading 2",
      "toolbar.heading3": labels.heading3 ?? "Heading 3",
      "toolbar.bulletList": labels.bulletList ?? "Bulleted list",
      "toolbar.orderedList": labels.orderedList ?? "Numbered list",
      "toolbar.blockquote": labels.blockquote ?? "Quote",
      "toolbar.codeBlock": labels.codeBlock ?? "Code",
      "toolbar.undo": labels.undo ?? "Undo",
      "toolbar.redo": labels.redo ?? "Redo",
      "general.placeholder": placeholder,
    }),
    [labels, placeholder],
  );

  return (
    <div
      dir={direction}
      data-translator-body=""
      className="border-line overflow-hidden rounded-lg border"
      /* An image dropped into a translation would be an upload nobody
       * reviewed, on a page with no account behind it. */
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
        className="infokit-rich-text-editor"
        locale={locale}
        content={{ html }}
        i18n={{ translations }}
        placeholder={placeholder}
        theme={{
          mode: "auto",
          preset: "minimal",
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
        }}
        onChange={(next: EditorContent) => {
          setHtml(next.html);
        }}
      />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
