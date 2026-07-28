import type {
  PublicArticleDetail,
  PublicArticleLabels,
} from "@infokit/shared/public-content";
import { CalendarDays, Languages, ShieldCheck, Users } from "lucide-react";

import { ArticleUnreliableNotice } from "~/components/public/article-collection";
import {
  Callout,
  Eyebrow,
  MetaRow,
  SurfaceCard,
} from "~/components/public/primitives";

/**
 * Editorial bodies are stored as plain text (the revision's `plainText`), so
 * paragraphs are the only structure we can trust. Splitting on blank lines is
 * deliberate: no HTML is injected into the page from authored content.
 */
function paragraphs(body: string) {
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

/**
 * One article, one column. Warnings sit above the body, ownership and freshness
 * below it — the reader should know how much to trust the text before reading
 * it, and who to ask afterwards (docs/DESIGN-SYSTEM.md §2).
 */
export function PublicArticleDetailView({
  article,
  labels,
  eyebrow,
}: {
  article: PublicArticleDetail;
  labels: PublicArticleLabels;
  /** Section name, e.g. "Practical information". */
  eyebrow: string;
}) {
  const blocks = paragraphs(article.body);

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <Eyebrow family="article">{eyebrow}</Eyebrow>
        <h1 className="text-ink text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          {article.title}
        </h1>
        {/* The same plum rule the card carries, so the piece is recognisably
            the thing that was clicked. */}
        <span className="bg-article h-0.5 w-12 rounded-full" aria-hidden />
        <p className="text-copy-muted max-w-prose text-lg leading-relaxed">
          {article.summary}
        </p>
        <p className="text-copy-muted border-line inline-flex items-center gap-2 border-t pt-4 text-sm font-semibold">
          <CalendarDays className="size-4" aria-hidden />
          {article.articleDateLabel}
        </p>
      </header>

      {article.unreliable ? (
        <ArticleUnreliableNotice
          label={labels.unreliable}
          fromLabel={article.unreliableFromLabel}
        />
      ) : null}

      {article.fallbackUsed ? (
        <Callout tone="info" role="status">
          <span className="inline-flex items-start gap-2">
            <Languages className="mt-0.5 size-4 shrink-0" aria-hidden />
            {article.fallbackLabel}
          </span>
        </Callout>
      ) : null}

      {article.coverImage ? (
        <figure className="m-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote editorial media, no known intrinsic size */}
          <img
            src={article.coverImage.url}
            alt={article.coverImage.decorative ? "" : article.coverImage.alt}
            aria-hidden={article.coverImage.decorative || undefined}
            className="bg-subtle rounded-card border-line w-full border object-cover"
            loading="lazy"
          />
          {article.coverImage.decorative ? null : (
            <figcaption className="text-copy-muted mt-2 text-sm">
              {article.coverImage.alt}
            </figcaption>
          )}
        </figure>
      ) : null}

      <div className="infokit-prose">
        {blocks.map((block, index) => (
          <p key={index}>{block}</p>
        ))}
      </div>

      <SurfaceCard className="bg-subtle p-5 md:p-6">
        <dl className="flex flex-col gap-3">
          <MetaRow
            label={labels.publishedBy}
            icon={<Users className="size-3.5" aria-hidden />}
          >
            {article.ownerNames.join(", ")}
          </MetaRow>
          <MetaRow
            label={labels.lastReviewed}
            icon={<ShieldCheck className="size-3.5" aria-hidden />}
          >
            {article.lastReviewedLabel}
          </MetaRow>
        </dl>
      </SurfaceCard>
    </article>
  );
}
