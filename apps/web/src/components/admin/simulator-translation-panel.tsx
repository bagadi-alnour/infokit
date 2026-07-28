"use client";

import {
  requestSimulatorTranslation,
  reviewSimulatorTranslation,
} from "~/app/[locale]/dashboard/simulator/translation-actions";
import {
  TranslationAssignmentRows,
  type TranslationAssignmentSummary,
} from "~/components/admin/translation-assignment";
import type { EditorialLanguage } from "~/lib/editorial-languages";

export interface SimulatorLanguageStatus {
  code: EditorialLanguage;
  authored: boolean;
  state: string;
  assignment: TranslationAssignmentSummary | null;
}

/**
 * A simulator flow, language by language. The flow is published as a whole, so
 * the rows carry only the translation errand.
 */
export function SimulatorTranslationPanel({
  locale,
  flowId,
  sourceLanguage,
  languages,
  labels,
  disabled = false,
}: {
  locale: EditorialLanguage;
  flowId: string;
  sourceLanguage: EditorialLanguage;
  languages: SimulatorLanguageStatus[];
  labels: Record<string, string>;
  disabled?: boolean;
}) {
  return (
    <TranslationAssignmentRows
      locale={locale}
      ownerField="flowId"
      ownerId={flowId}
      sourceLanguage={sourceLanguage}
      languages={languages}
      labels={labels}
      request={requestSimulatorTranslation}
      review={reviewSimulatorTranslation}
      disabled={disabled}
    />
  );
}
