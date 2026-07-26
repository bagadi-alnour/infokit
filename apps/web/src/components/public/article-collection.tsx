import type {
  PublicArticleLabels,
  PublicArticleSummary,
} from "@infokit/shared/public-content";
import { ArrowRight, CalendarDays, Languages } from "lucide-react";

import {
  Callout,
  FreshnessNote,
  MetaRow,
  SurfaceCard,
} from "~/components/public/primitives";

/**
 * Article cards in a fixed reading order: date → title → summary → owner →
 * freshness → warnings. A card never hides a warning below a fold, because the
 * warning is the reason the reader should slow down (docs/DESIGN-SYSTEM.md §2).
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
      <SurfaceCard className="p-8 text-center">
        <p className="text-copy-muted text-base">{labels.empty}</p>
      </SurfaceCard>
    );
  }

  return (
    <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {articles.map((article) => (
        <SurfaceCard
          as="li"
          key={article.id}
          className="focus-within:border-brand hover:border-brand hover:shadow-lift group relative flex flex-col overflow-hidden transition-shadow"
        >
          {article.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote editorial media, no known intrinsic size
            <img
              src={article.coverImage.url}
              alt={article.coverImage.decorative ? "" : article.coverImage.alt}
              aria-hidden={article.coverImage.decorative || undefined}
              className="bg-subtle aspect-[16/9] w-full object-cover"
              loading="lazy"
            />
          ) : null}

          <div className="flex flex-1 flex-col gap-3 p-5 md:p-6">
            <p className="text-copy-muted inline-flex items-center gap-1.5 text-sm font-semibold">
              <CalendarDays className="size-4" aria-hidden />
              {article.articleDateLabel}
            </p>

            <h2 className="font-display text-ink text-xl font-bold leading-snug">
              <a
                href={article.href}
                className="rounded-control focus-visible:outline-brand after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {article.title}
              </a>
            </h2>

            <p className="text-copy-muted text-[0.95rem] leading-relaxed">
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
                {labels.fallback}
              </p>
            ) : null}

            <dl className="border-line mt-auto flex flex-col gap-2 border-t pt-4">
              <MetaRow label={labels.publishedBy}>
                {article.ownerNames.join(", ")}
              </MetaRow>
            </dl>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <FreshnessNote
                label={labels.lastReviewed}
                value={article.lastReviewedLabel}
                tone={article.unreliable ? "warn" : "ok"}
              />
              <span className="text-brand-deep inline-flex items-center gap-1.5 text-sm font-semibold">
                {labels.read}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                  aria-hidden
                />
              </span>
            </div>
          </div>
        </SurfaceCard>
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
