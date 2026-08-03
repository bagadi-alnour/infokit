import { ImageOff, Info } from "lucide-react";

import type { AssignmentContext } from "~/server/translation/assignment-context";

/**
 * What the words are about, beside the words: the picture the record is
 * published under and the labels it already carries.
 *
 * Every label here is already in the translator's own language — a tag and a
 * service are catalogue rows the platform translates centrally — so the panel
 * says so plainly and offers nothing to type. Handed the same labels as fields,
 * a translator would produce a second wording for a term that already has one,
 * and the record would then disagree with itself.
 */
export function TranslatorContextPanel({
  context,
  direction,
  labels,
}: {
  context: AssignmentContext;
  /** The target language's direction: these labels are in that language. */
  direction: "ltr" | "rtl";
  labels: Record<string, string>;
}) {
  const groups = (
    [
      ["translator.contextCategories", context.categories],
      ["translator.contextServices", context.services],
      ["translator.contextTags", context.tags],
    ] as const
  ).filter(([, values]) => values.length > 0);

  return (
    <section
      aria-label={labels["translator.context"]}
      className="border-line bg-subtle/40 mb-6 rounded-xl border p-4"
    >
      <p className="text-copy-muted flex items-start gap-2 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{labels["translator.contextHint"]}</span>
      </p>
      <div className="mt-4 grid gap-5 sm:grid-cols-[14rem_minmax(0,1fr)]">
        {context.cover ? (
          <figure className="min-w-0">
            {/* An ordinary <img>: the URL is a short-lived signed link to the
             * asset bucket, which the image optimiser cannot cache anyway. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={context.cover.url}
              alt={context.cover.altText ?? ""}
              className="border-line max-h-48 w-full rounded-lg border object-cover"
            />
            {context.cover.altText ? (
              <figcaption className="text-copy-muted mt-1.5 text-xs">
                {context.cover.altText}
              </figcaption>
            ) : null}
          </figure>
        ) : (
          <p className="border-line text-copy-muted grid min-h-24 place-items-center gap-1 rounded-lg border border-dashed p-3 text-center text-xs">
            <ImageOff className="mx-auto size-4" aria-hidden />
            {labels["translator.contextNoImage"]}
          </p>
        )}
        <dl className="grid min-w-0 content-start gap-3" dir={direction}>
          {groups.map(([labelKey, values]) => (
            <div key={labelKey} className="min-w-0">
              <dt className="text-copy-muted text-xs font-medium uppercase tracking-wide">
                {labels[labelKey]}
              </dt>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {values.map((value) => (
                  <span
                    key={value}
                    className="border-line bg-surface rounded-full border px-2.5 py-0.5 text-xs font-medium"
                  >
                    {value}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
