"use client";

import { Check, FileDown, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ActionButton } from "~/components/public/primitives";
import { cn } from "~/lib/utils";

/**
 * The DOM types say every browser has a clipboard. A page served over plain
 * HTTP has none — which is exactly the phone on a captive-portal Wi-Fi this site
 * is read on — so the property is read back widened before it is trusted.
 */
function clipboard(): Clipboard | undefined {
  return navigator.clipboard;
}

/**
 * The two things a reader does with an activity page once they have read it:
 * hand it to someone else, and keep it.
 *
 * Both need a browser API, so both appear only once the script behind them has
 * run — a control that does nothing is worse than no control, and the page is
 * already complete without them (docs/DESIGN-SYSTEM.md §1, degradation order).
 *
 * Sharing is the device's own sheet where there is one, and the clipboard where
 * there is not; the link is read from the address bar, so nothing about this page
 * has to be handed to the browser twice. "Download PDF" is the browser's own
 * print-to-PDF: the sheet is this page without its chrome (`print:` rules), it
 * is generated on the device, and what a reader saved is never sent anywhere —
 * the same promise the guide's own PDF makes (docs/DESIGN-BRIEF.md §11).
 */
export function ActivityShareActions({
  title,
  labels,
  className,
}: {
  /** The activity's name, offered to the share sheet as the subject. */
  title: string;
  labels: { share: string; copied: string; downloadPdf: string };
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    setReady(true);
    setCanShare(
      typeof navigator.share === "function" ||
        typeof clipboard()?.writeText === "function",
    );
    return () => {
      clearTimeout(resetTimer.current);
    };
  }, []);

  async function share() {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      // A reader who closes the sheet has not failed at anything: dismissal
      // rejects, and there is nothing to tell them about it.
      try {
        await navigator.share({ title, url });
      } catch {
        /* dismissed */
      }
      return;
    }
    const board = clipboard();
    if (!board) return;
    try {
      await board.writeText(url);
      setCopied(true);
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => {
        setCopied(false);
      }, 4000);
    } catch {
      /* the clipboard was refused; the address bar still holds the link */
    }
  }

  if (!ready) return null;

  return (
    <div className={cn("flex flex-wrap gap-3 print:hidden", className)}>
      {canShare ? (
        <ActionButton
          tone="outline"
          onClick={() => {
            void share();
          }}
        >
          {copied ? (
            <Check className="text-ok size-5" aria-hidden />
          ) : (
            <Share2 className="size-5" aria-hidden />
          )}
          <span aria-live="polite">
            {copied ? labels.copied : labels.share}
          </span>
        </ActionButton>
      ) : null}
      <ActionButton
        tone="outline"
        onClick={() => {
          window.print();
        }}
      >
        <FileDown className="size-5" aria-hidden />
        {labels.downloadPdf}
      </ActionButton>
    </div>
  );
}
