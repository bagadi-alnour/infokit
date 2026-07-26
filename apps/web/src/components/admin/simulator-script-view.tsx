"use client";

import {
  AlertCircle,
  Check,
  ClipboardCopy,
  RotateCcw,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import type { ScriptIssue } from "~/lib/simulator-script";
import { cn } from "~/lib/utils";

/**
 * Text view of the draft graph. Writing steps as lines is much faster than
 * placing and wiring them on the canvas, and it is the only practical way to
 * paste a whole leaflet in at once. Both views edit the same draft.
 */
export function SimulatorScriptView({
  value,
  issues,
  dirty,
  readOnly,
  messages,
  onChange,
  onApply,
  onReset,
}: {
  value: string;
  issues: ScriptIssue[];
  dirty: boolean;
  readOnly: boolean;
  messages: Record<string, string>;
  onChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const lineCount = value.split("\n").length;

  return (
    <div className="grid min-h-0 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <div className="border-line bg-surface flex flex-wrap items-center gap-2 rounded-t-xl border border-b-0 px-3 py-2">
          <Button
            type="button"
            size="sm"
            onClick={onApply}
            disabled={readOnly || issues.length > 0 || !dirty}
          >
            <Wand2 aria-hidden />
            {messages["script.apply"]}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onReset}
            disabled={!dirty}
          >
            <RotateCcw aria-hidden />
            {messages["script.reset"]}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              void navigator.clipboard
                .writeText(value)
                .then(() => toast.success(messages["script.copied"]))
                .catch(() => toast.error(messages["script.copyError"]));
            }}
          >
            <ClipboardCopy aria-hidden />
            {messages["script.copy"]}
          </Button>
          <p className="text-copy-muted ms-auto text-xs tabular-nums">
            {(messages["script.lines"] ?? "").replace(
              "{count}",
              String(lineCount),
            )}
          </p>
        </div>
        <textarea
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          readOnly={readOnly}
          spellCheck={false}
          dir="ltr"
          aria-label={messages["script.editor"]}
          className={cn(
            "border-line bg-surface text-ink focus-visible:ring-brand/30 h-[calc(100dvh-19rem)] min-h-[28rem] w-full resize-none rounded-b-xl border p-4 font-mono text-[13px] leading-relaxed focus-visible:outline-none focus-visible:ring-2",
            "[unicode-bidi:plaintext]",
          )}
        />
      </div>

      <aside className="min-w-0 space-y-4">
        <div className="border-line bg-surface rounded-xl border p-4">
          <h2 className="font-semibold">{messages["script.heading"]}</h2>
          <p className="text-copy-muted mt-1 text-xs leading-relaxed">
            {messages["script.hint"]}
          </p>
          <div className="mt-3">
            {issues.length === 0 ? (
              <div className="bg-ok-soft text-ok flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium">
                <Check className="size-4 shrink-0" aria-hidden />
                {dirty
                  ? messages["script.readyToApply"]
                  : messages["script.inSync"]}
              </div>
            ) : (
              <ul className="space-y-2">
                {issues.slice(0, 12).map((issue, index) => (
                  <li
                    key={`${String(issue.line)}:${String(index)}`}
                    className="bg-warn-soft text-warn flex gap-2 rounded-lg px-3 py-2 text-xs"
                  >
                    <AlertCircle
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden
                    />
                    <span>
                      <span className="font-semibold tabular-nums">
                        {(messages["script.line"] ?? "").replace(
                          "{line}",
                          String(issue.line),
                        )}
                      </span>{" "}
                      {issue.message}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="border-line bg-subtle rounded-xl border p-4">
          <h3 className="text-sm font-semibold">
            {messages["script.cheatsheet"]}
          </h3>
          <pre
            dir="ltr"
            className="text-copy-muted mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed"
          >{`name: Titre interne
summary: Source et raison
reviewed: 2026-07-25
review-due: 2026-10-25

info arrivee @start
  fr: Arrivée en France
  fr.explanation: …
  -> guichet

question procedure @required
  fr: Quelle procédure ?
  - dublin -> fiche_dublin
    fr: Procédure Dublin
  - autre -> resultat @prefer-not-to-say
    fr: Je ne sais pas

result resultat
  fr: Titre du résultat
  fr.result: Texte vérifié.
  | Ligne suivante.
  fr.disclaimer: Information, pas un conseil.`}</pre>
        </div>
      </aside>
    </div>
  );
}
