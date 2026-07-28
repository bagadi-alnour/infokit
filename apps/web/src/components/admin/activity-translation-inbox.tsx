"use client";

import { reviewActivityTranslation } from "~/app/[locale]/dashboard/activities/translation-actions";
import {
  LanguageStateSummary,
  TranslationReviewDialog,
  type TranslationSubmission,
} from "~/components/admin/language-publication";
import { isAwaitingReview } from "~/components/admin/translation-assignment";
import type { EditorialLanguage } from "~/lib/editorial-languages";
import type { LanguageReviewStage } from "~/lib/language-review";

type Labels = Record<string, string>;

export type ActivityTranslationAssignment = TranslationSubmission;

export type ActivityLanguageStatus = {
  code: EditorialLanguage;
  name: string | null;
  state: string;
  method: string;
  /** Who this language is still waiting on before it may face the public. */
  reviewStage: LanguageReviewStage;
  publishedAt: string | null;
  scheduledFor: string | null;
  verifiedBy: { name: string | null } | null;
  assignment: ActivityTranslationAssignment | null;
};

/**
 * What is left to say about a language once its own menu carries the actions:
 * how far along it is, and a translator's submission waiting to be accepted.
 *
 * Publishing, scheduling, unpublishing and inviting a translator all live in
 * the accordion beside the text they act on — offering them twice would mean
 * two controls for one decision. Reading what an outside translator sent back
 * is not one of those, so it stays here.
 */
export function ActivityTranslationInbox({
  locale,
  activityId,
  sourceLanguage,
  languages,
  labels,
}: {
  locale: string;
  activityId: string;
  sourceLanguage: EditorialLanguage;
  languages: ActivityLanguageStatus[];
  labels: Labels;
}) {
  // A language with neither text nor a translator has nothing to report; its
  // row in the accordion already says it is empty.
  const rows = languages.filter(
    (language) => Boolean(language.name) || language.assignment !== null,
  );
  if (rows.length === 0) {
    return (
      <p className="text-copy-muted text-sm">{labels["translation.missing"]}</p>
    );
  }
  return (
    <ul className="grid gap-2.5">
      {rows.map((language) => (
        <li
          key={language.code}
          className="border-line grid min-w-0 gap-3 border-b py-4 first:pt-0 last:border-b-0 last:pb-0"
        >
          <LanguageStateSummary
            language={language}
            authored={Boolean(language.name)}
            sourceLanguage={sourceLanguage}
            labels={labels}
          />
          {isAwaitingReview(language.assignment) && language.assignment ? (
            <TranslationReviewDialog
              action={reviewActivityTranslation}
              locale={locale}
              ownerField="activityId"
              ownerId={activityId}
              language={language.code}
              assignment={language.assignment}
              labels={labels}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
