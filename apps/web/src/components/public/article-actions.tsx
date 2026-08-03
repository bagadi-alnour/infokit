"use client";

import {
  Check,
  Download,
  LoaderCircle,
  Pause,
  Share2,
  Volume2,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { ActionAnchor, ActionButton } from "~/components/public/primitives";

type PlaybackState = "idle" | "loading" | "playing" | "paused" | "error";

const articlePlaybackEvent = "infokit:article-playback";

export interface ArticleActionLabels {
  share: string;
  shareCopied: string;
  listen: string;
  pause: string;
  resume: string;
  loading: string;
  retry: string;
  disclosure: string;
  download: string;
}

/**
 * The three portable actions for an article. Audio is not requested until the
 * reader presses Listen, while Share prefers the device sheet and falls back
 * to copying the article's own link.
 */
export function ArticleActions({
  title,
  href,
  speechHref,
  downloadHref,
  labels,
}: {
  title: string;
  href: string;
  speechHref: string;
  downloadHref: string;
  labels: ArticleActionLabels;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadedSrcRef = useRef<string | null>(null);
  const disclosureId = useId();
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [copied, setCopied] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState>("idle");

  useEffect(() => {
    function pauseForAnotherArticle(event: Event) {
      const audio = audioRef.current;
      if (
        audio &&
        (event as CustomEvent<HTMLAudioElement>).detail !== audio &&
        !audio.paused
      ) {
        audio.pause();
      }
    }

    window.addEventListener(articlePlaybackEvent, pauseForAnotherArticle);
    return () => {
      window.removeEventListener(articlePlaybackEvent, pauseForAnotherArticle);
      clearTimeout(copiedTimer.current);
    };
  }, []);

  function showCopied() {
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => {
      setCopied(false);
    }, 4000);
  }

  async function share() {
    const url = new URL(href, window.location.href).toString();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
      } catch {
        // Closing the device share sheet is not an error.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      showCopied();
      return;
    } catch {
      // Plain HTTP and restricted browsers may not expose Clipboard.
    }

    window.location.assign(
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
    );
  }

  async function play() {
    const audio = audioRef.current;
    if (!audio) return;
    if (loadedSrcRef.current !== speechHref) {
      audio.src = speechHref;
      loadedSrcRef.current = speechHref;
    }
    setPlayback("loading");
    try {
      await audio.play();
      window.dispatchEvent(
        new CustomEvent<HTMLAudioElement>(articlePlaybackEvent, {
          detail: audio,
        }),
      );
    } catch {
      setPlayback("error");
    }
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || playback === "loading") return;
    if (playback === "playing") {
      audio.pause();
      return;
    }
    if (playback === "error") {
      audio.load();
    }
    void play();
  }

  const listenLabel =
    playback === "loading"
      ? labels.loading
      : playback === "playing"
        ? labels.pause
        : playback === "paused"
          ? labels.resume
          : playback === "error"
            ? labels.retry
            : labels.listen;

  return (
    <div className="relative z-10 flex flex-wrap items-center gap-2 print:hidden">
      <audio
        ref={audioRef}
        preload="none"
        onLoadStart={() => {
          setPlayback("loading");
        }}
        onWaiting={() => {
          setPlayback("loading");
        }}
        onPlaying={() => {
          setPlayback("playing");
        }}
        onPause={(event) => {
          if (!event.currentTarget.ended && playback !== "error") {
            setPlayback("paused");
          }
        }}
        onEnded={() => {
          setPlayback("idle");
        }}
        onError={() => {
          setPlayback("error");
        }}
      />

      <ActionButton
        tone="outline"
        size="compact"
        onClick={() => {
          void share();
        }}
      >
        {copied ? (
          <Check className="text-ok size-4" aria-hidden />
        ) : (
          <Share2 className="size-4" aria-hidden />
        )}
        <span aria-live="polite">
          {copied ? labels.shareCopied : labels.share}
        </span>
      </ActionButton>

      <ActionButton
        tone="outline"
        size="compact"
        onClick={togglePlayback}
        disabled={playback === "loading"}
        aria-label={listenLabel}
        aria-describedby={disclosureId}
        title={labels.disclosure}
      >
        {playback === "loading" ? (
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
        ) : playback === "playing" ? (
          <Pause className="size-4" fill="currentColor" aria-hidden />
        ) : (
          <Volume2 className="size-4" aria-hidden />
        )}
        <span aria-live="polite">{listenLabel}</span>
      </ActionButton>
      <span id={disclosureId} className="sr-only">
        {labels.disclosure}
      </span>

      <ActionAnchor href={downloadHref} tone="outline" size="compact" download>
        <Download className="size-4" aria-hidden />
        {labels.download}
      </ActionAnchor>
    </div>
  );
}
