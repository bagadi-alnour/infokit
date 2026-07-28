"use client";

import type {
  PublicSimulatorDocument,
  PublicSimulatorLabels,
} from "@infokit/shared/public-simulator";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Lock,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  ActionButton,
  Callout,
  Eyebrow,
  MetaRow,
  SurfaceCard,
} from "~/components/public/primitives";

function formatStep(template: string, step: number) {
  return template.replace("{number}", String(step));
}

/**
 * One decision per screen. Nothing the reader answers leaves this component —
 * no storage, no query string, no analytics — which is why the privacy line is
 * stated on the start card and repeated in the footer.
 */
export function SimulatorExperience({
  document,
  labels,
  lastReviewedLabel,
  reviewDueLabel,
  preview = false,
}: {
  document: PublicSimulatorDocument;
  labels: PublicSimulatorLabels;
  lastReviewedLabel: string;
  reviewDueLabel: string;
  preview?: boolean;
}) {
  const nodes = useMemo(
    () => new Map(document.nodes.map((node) => [node.id, node])),
    [document.nodes],
  );
  const [started, setStarted] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState(document.entryNodeId);
  const [history, setHistory] = useState<string[]>([]);
  const currentNode = nodes.get(currentNodeId);

  function restart() {
    setCurrentNodeId(document.entryNodeId);
    setHistory([]);
    setStarted(true);
  }

  function move(nextNodeId: string | null) {
    if (!nextNodeId || !currentNode) return;
    setHistory((current) => [...current, currentNode.id]);
    setCurrentNodeId(nextNodeId);
  }

  function back() {
    setHistory((current) => {
      const previous = current.at(-1);
      if (previous) setCurrentNodeId(previous);
      return current.slice(0, -1);
    });
  }

  const kindLabel =
    currentNode?.kind === "question"
      ? labels.question
      : currentNode?.kind === "information"
        ? labels.information
        : labels.result;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {preview ? (
        <Callout tone="warning" role="status" title={labels.preview}>
          {labels.previewDetail}
        </Callout>
      ) : null}

      {document.fallbackUsed ? (
        <Callout tone="info" role="status">
          {labels.fallback}
        </Callout>
      ) : null}

      {!started ? (
        // The invitation is the one washed card of the guide family, the same
        // card the index offered — starting a guide looks like choosing it.
        <SurfaceCard className="shadow-lift border-guide bg-guide-wash flex flex-col gap-5 p-6 md:p-8">
          <Eyebrow family="guide">{labels.source}</Eyebrow>
          <h1 className="text-ink text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            {document.title}
          </h1>
          {document.summary ? (
            <p className="text-copy-muted text-lg leading-relaxed">
              {document.summary}
            </p>
          ) : null}

          {/* Plain surface on the washed card: the promise about the answers is
              the quietest thing on the page and the most important. */}
          <div className="bg-surface border-line text-ink rounded-card flex items-start gap-3 border p-4">
            <Lock className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{labels.privacy}</p>
              <p className="mt-1 text-[0.95rem] leading-relaxed">
                {labels.privacyDetail}
              </p>
            </div>
          </div>

          <dl className="border-line flex flex-col gap-2 border-t pt-5">
            <MetaRow
              label={labels.lastReviewed}
              icon={<ShieldCheck className="size-3.5" aria-hidden />}
            >
              {lastReviewedLabel}
            </MetaRow>
            <MetaRow label={labels.reviewDue}>{reviewDueLabel}</MetaRow>
          </dl>

          <ActionButton
            size="large"
            className="self-start"
            onClick={() => {
              setStarted(true);
            }}
          >
            {labels.begin}
            <ArrowRight className="size-5 rtl:rotate-180" aria-hidden />
          </ActionButton>
        </SurfaceCard>
      ) : currentNode ? (
        <SurfaceCard
          key={currentNode.id}
          as="section"
          aria-live="polite"
          className="shadow-lift flex flex-col gap-5 p-6 md:p-8"
        >
          {/* The questions need the quiet, so a step card stays on plain
              surface and carries the family only in the rule that counts. */}
          <div className="border-guide flex items-center justify-between gap-3 border-b pb-4">
            <p className="text-copy-muted text-xs font-bold uppercase tracking-[0.08em]">
              {formatStep(labels.step, history.length + 1)}
            </p>
            <p className="text-eyebrow text-guide">{kindLabel}</p>
          </div>

          <h1 className="text-ink text-2xl font-bold leading-snug md:text-3xl">
            {currentNode.prompt}
          </h1>
          {currentNode.explanation ? (
            <p className="text-copy-muted text-[1.0625rem] leading-relaxed">
              {currentNode.explanation}
            </p>
          ) : null}

          {currentNode.kind === "question" ? (
            <ul className="flex flex-col gap-3">
              {currentNode.options.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    disabled={!option.nextNodeId}
                    onClick={() => {
                      move(option.nextNodeId);
                    }}
                    className="border-line-strong bg-surface text-ink rounded-control hover:border-brand hover:bg-brand-soft focus-visible:outline-brand flex min-h-14 w-full items-center justify-between gap-3 border px-4 text-start text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1">{option.label}</span>
                    <ChevronRight
                      className="text-brand-deep size-5 shrink-0 rtl:rotate-180"
                      aria-hidden
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : currentNode.kind === "information" ? (
            <ActionButton
              size="large"
              className="self-start"
              disabled={!currentNode.nextNodeId}
              onClick={() => {
                move(currentNode.nextNodeId);
              }}
            >
              {labels.continue}
              <ArrowRight className="size-5 rtl:rotate-180" aria-hidden />
            </ActionButton>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="infokit-prose">
                {currentNode.resultBody
                  .split(/\n{2,}/)
                  .map((block) => block.trim())
                  .filter(Boolean)
                  .map((block, index) => (
                    <p key={index}>{block}</p>
                  ))}
              </div>
              {currentNode.disclaimer ? (
                <Callout tone="warning" role="note" title={labels.disclaimer}>
                  {currentNode.disclaimer}
                </Callout>
              ) : null}
              <ActionButton
                tone="outline"
                size="large"
                className="self-start"
                onClick={restart}
              >
                <RotateCcw className="size-5" aria-hidden />
                {labels.startAgain}
              </ActionButton>
            </div>
          )}

          {history.length > 0 && currentNode.kind !== "result" ? (
            <ActionButton
              tone="quiet"
              size="compact"
              className="-mx-2 self-start"
              onClick={back}
            >
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
              {labels.back}
            </ActionButton>
          ) : null}
        </SurfaceCard>
      ) : (
        <SurfaceCard className="flex flex-col items-start gap-4 p-6 md:p-8">
          <h1 className="text-ink text-2xl font-bold">{labels.notAvailable}</h1>
          <ActionButton tone="outline" onClick={restart}>
            <RotateCcw className="size-5" aria-hidden />
            {labels.startAgain}
          </ActionButton>
        </SurfaceCard>
      )}

      <p className="text-copy-muted inline-flex items-center justify-center gap-2 text-center text-sm">
        <Lock className="size-4 shrink-0" aria-hidden />
        {labels.source} · {labels.privacy}
      </p>
    </div>
  );
}
