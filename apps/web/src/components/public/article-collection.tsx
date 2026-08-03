import type {
  PublicArticleLabels,
  PublicArticleSummary,
} from "@infokit/shared/public-content";
import { ArrowRight, Languages } from "lucide-react";

import { Callout, familyStyles } from "~/components/public/primitives";
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
            "border-line-4 rounded-card group relative flex flex-col overflow-hidden border transition-colors",
            article.coverImage && "md:grid md:grid-cols-[minmax(0,1fr)_11rem]",
            familyStyles.article.hoverBorder,
          )}
        >
          <div className="order-last flex min-w-0 flex-col gap-3 p-5 sm:p-6 md:order-first">
            <p className="text-article text-sm font-semibold">
              {article.articleDateLabel}
            </p>

            <h2 className="font-display text-ink max-w-[36ch] text-2xl font-bold leading-tight sm:text-[1.75rem]">
              <a
                href={article.href}
                className="rounded-control focus-visible:outline-brand after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {article.title}
              </a>
            </h2>
            <span className="bg-article h-0.5 w-12" aria-hidden />

            <p className="text-copy-muted line-clamp-3 max-w-[68ch] text-base leading-relaxed">
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

            <div className="mt-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-2">
              <dl className="text-copy-muted flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                <div className="inline-flex items-baseline gap-1.5">
                  <dt className="text-ink font-semibold">
                    {labels.publishedBy}
                  </dt>
                  <dd>{article.ownerNames.join(", ")}</dd>
                </div>
                <div className="before:bg-line inline-flex items-baseline gap-1.5 before:me-1.5 before:size-1 before:shrink-0 before:rounded-full before:content-['']">
                  <dt className="text-ink font-semibold">
                    {labels.lastReviewed}
                  </dt>
                  <dd>
                    {article.lastReviewedIso ? (
                      <time
                        dateTime={article.lastReviewedIso}
                        title={article.lastReviewedDateLabel}
                      >
                        {article.lastReviewedLabel}
                      </time>
                    ) : (
                      article.lastReviewedLabel
                    )}
                  </dd>
                </div>
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

          {article.coverImage ? (
            <div className="border-line bg-subtle rounded-control order-first m-5 mb-0 aspect-[4/3] overflow-hidden border sm:m-6 sm:mb-0 md:order-last md:mb-6 md:ms-0 md:aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote editorial media, no known intrinsic size */}
              <img
                src={article.coverImage.url}
                alt={
                  article.coverImage.decorative ? "" : article.coverImage.alt
                }
                aria-hidden={article.coverImage.decorative || undefined}
                className="size-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.025]"
                loading="lazy"
              />
            </div>
          ) : null}
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
