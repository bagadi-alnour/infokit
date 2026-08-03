"use client";

import { LoaderCircle, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { useId, useRef, useState } from "react";

import type { ListenControlLabels } from "~/components/public/listen-control-copy";
import { ActionButton, SurfaceCard } from "~/components/public/primitives";

type PlaybackState = "idle" | "loading" | "playing" | "paused" | "error";

const playbackRates = [1, 1.25, 1.5] as const;

function clock(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const seconds = Math.floor(value);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * One explicit play action, then familiar media controls. The audio is fetched
 * only after a tap: readers on expensive data never pay for a voice they did
 * not ask for, and nothing autoplays.
 */
export function ListenControl({
  src,
  labels,
}: {
  src: string;
  labels: ListenControlLabels;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadedSrcRef = useRef<string | null>(null);
  const titleId = useId();
  const [state, setState] = useState<PlaybackState>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rateIndex, setRateIndex] = useState(0);

  async function play() {
    const audio = audioRef.current;
    if (!audio) return;
    // Keep the endpoint completely absent from the media element until the
    // reader asks to listen. `preload="none"` is only a browser hint; assigning
    // the URL here is the guarantee that opening a page cannot generate audio.
    if (loadedSrcRef.current !== src) {
      audio.src = src;
      loadedSrcRef.current = src;
    }
    setState("loading");
    try {
      await audio.play();
    } catch {
      setState("error");
    }
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || state === "loading") return;
    if (state === "playing") {
      audio.pause();
      return;
    }
    void play();
  }

  function retry() {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(0);
    setDuration(0);
    audio.load();
    void play();
  }

  function changeRate() {
    const audio = audioRef.current;
    if (!audio) return;
    const nextIndex = (rateIndex + 1) % playbackRates.length;
    setRateIndex(nextIndex);
    audio.playbackRate = playbackRates[nextIndex] ?? 1;
  }

  const actionLabel =
    state === "playing"
      ? labels.pause
      : state === "paused"
        ? labels.resume
        : labels.play;
  const canSeek = duration > 0 && Number.isFinite(duration);

  return (
    <SurfaceCard
      as="section"
      className="flex flex-col gap-4 p-5 md:p-6 print:hidden"
      aria-labelledby={titleId}
    >
      <div className="flex items-start gap-3">
        <span className="bg-brand-soft text-brand-soft-ink flex size-11 shrink-0 items-center justify-center rounded-full">
          <Volume2 className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="text-ink text-xl font-bold">
            {labels.title}
          </h2>
          <p className="text-copy-muted mt-1 leading-relaxed">
            {labels.description}
          </p>
        </div>
      </div>

      <audio
        ref={audioRef}
        preload="none"
        onLoadStart={() => {
          setState("loading");
        }}
        onWaiting={() => {
          setState("loading");
        }}
        onPlaying={() => {
          setState("playing");
        }}
        onPause={(event) => {
          if (!event.currentTarget.ended && state !== "error") {
            setState("paused");
          }
        }}
        onEnded={() => {
          setCurrentTime(0);
          setState("paused");
        }}
        onDurationChange={(event) => {
          setDuration(event.currentTarget.duration || 0);
        }}
        onTimeUpdate={(event) => {
          setCurrentTime(event.currentTarget.currentTime);
        }}
        onError={() => {
          setState("error");
        }}
      />

      {state === "error" ? (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-danger min-w-0 flex-1 font-medium">
            {labels.error}
          </p>
          <ActionButton tone="outline" onClick={retry}>
            <RotateCcw className="size-5" aria-hidden />
            {labels.retry}
          </ActionButton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              tone="solid"
              onClick={togglePlayback}
              disabled={state === "loading"}
              aria-label={state === "loading" ? labels.loading : actionLabel}
            >
              {state === "loading" ? (
                <LoaderCircle className="size-5" aria-hidden />
              ) : state === "playing" ? (
                <Pause className="size-5" fill="currentColor" aria-hidden />
              ) : (
                <Play className="size-5" fill="currentColor" aria-hidden />
              )}
              {state === "loading" ? labels.loading : actionLabel}
            </ActionButton>

            {canSeek ? (
              <ActionButton
                tone="quiet"
                size="compact"
                onClick={changeRate}
                aria-label={`${labels.speed}: ${String(playbackRates[rateIndex])}×`}
              >
                {String(playbackRates[rateIndex])}×
              </ActionButton>
            ) : null}
          </div>

          {canSeek ? (
            <div className="flex items-center gap-3">
              <span className="text-copy-muted w-10 text-sm tabular-nums">
                {clock(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={Math.min(currentTime, duration)}
                aria-label={labels.progress}
                onChange={(event) => {
                  const nextTime = Number(event.currentTarget.value);
                  if (audioRef.current) audioRef.current.currentTime = nextTime;
                  setCurrentTime(nextTime);
                }}
                className="accent-brand h-11 min-w-0 flex-1 cursor-pointer"
              />
              <span className="text-copy-muted w-10 text-end text-sm tabular-nums">
                {clock(duration)}
              </span>
            </div>
          ) : null}
        </div>
      )}

      <p className="text-copy-muted text-sm" role="note">
        {labels.aiDisclosure}
      </p>
    </SurfaceCard>
  );
}
