import type {
  PublicArticleLabels,
  PublicArticleSummary,
} from "@infokit/shared/public-content";
import { ArrowRight, CalendarDays, Languages } from "lucide-react";

import {
  Callout,
  familyStyles,
  FreshnessNote,
  MetaRow,
} from "~/components/public/primitives";
import { cn } from "~/lib/utils";

/**
 * An editorial index rather than a card grid: every article is one rectangular
 * row, with media given a stable place when it exists. The reading order stays
 * date → title → summary → warnings → owner/freshness, so a warning never hides
 * below secondary metadata (docs/DESIGN-SYSTEM.md §2).
 */
export function PublicArticleCollection({
  articles,
  labels,
}: {
  articles: PublicArticleSummary[];
  labels: PublicArticleLabels;
}) {
  if (articles.length === 0) {
    return (
      <div className="border-line bg-surface border px-6 py-12 text-center">
        <p className="text-copy-muted text-base">{labels.empty}</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-5">
      {articles.map((article) => (
        <li
          key={article.id}
          className={cn(
            "border-line bg-surface group relative grid overflow-hidden border transition-colors",
            article.coverImage &&
              "md:grid-cols-[minmax(15rem,2fr)_minmax(0,3fr)]",
            familyStyles.article.hoverBorder,
          )}
        >
          {article.coverImage ? (
            <div className="bg-subtle border-line relative min-h-48 overflow-hidden border-b md:min-h-full md:border-b-0 md:border-e">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote editorial media, no known intrinsic size */}
              <img
                src={article.coverImage.url}
                alt={
                  article.coverImage.decorative ? "" : article.coverImage.alt
                }
                aria-hidden={article.coverImage.decorative || undefined}
                className="absolute inset-0 size-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.015]"
                loading="lazy"
              />
            </div>
          ) : null}

          <div className="flex min-w-0 flex-col gap-4 p-5 sm:p-6 lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
              <p className="text-copy-muted inline-flex items-center gap-2 text-sm font-semibold">
                <CalendarDays
                  className="text-article size-4 shrink-0"
                  aria-hidden
                />
                {article.articleDateLabel}
              </p>
              <FreshnessNote
                label={labels.lastReviewed}
                value={article.lastReviewedLabel}
                tone={article.unreliable ? "warn" : "ok"}
              />
            </div>

            <h2 className="font-display text-ink max-w-[26ch] text-2xl font-bold leading-tight sm:text-[1.75rem]">
              <a
                href={article.href}
                className="rounded-control focus-visible:outline-brand after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {article.title}
              </a>
            </h2>
            <span className="bg-article h-0.5 w-12" aria-hidden />

            <p className="text-copy-muted max-w-[65ch] text-base leading-relaxed">
              {article.summary}
            </p>

            {article.unreliable ? (
              <Callout tone="warning" role="note" className="p-3 text-sm">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  {labels.unreliable}
                </span>
              </Callout>
            ) : null}

            {article.fallbackUsed ? (
              <p className="text-copy-muted inline-flex items-start gap-1.5 text-sm">
                <Languages className="mt-0.5 size-4 shrink-0" aria-hidden />
                {article.fallbackLabel}
              </p>
            ) : null}

            <div className="border-line mt-auto flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-t pt-4">
              <dl>
                <MetaRow label={labels.publishedBy}>
                  {article.ownerNames.join(", ")}
                </MetaRow>
              </dl>
              <span className="text-article inline-flex items-center gap-1.5 text-sm font-semibold">
                {labels.read}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                  aria-hidden
                />
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Shared by the collection and the article page so the same warning reads the
 * same way in both places.
 */
export function ArticleUnreliableNotice({
  label,
  fromLabel,
}: {
  label: string;
  fromLabel: string;
}) {
  return (
    <Callout tone="warning" role="note" title={label}>
      {fromLabel ? <p>{fromLabel}</p> : null}
    </Callout>
  );
}
