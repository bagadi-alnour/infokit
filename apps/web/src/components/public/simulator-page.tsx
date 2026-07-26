import type { PublicLocale } from "@infokit/shared/i18n";
import type { PageCatalog } from "@infokit/shared/i18n/catalogs";
import type {
  PublicSimulatorDocument,
  PublicSimulatorLabels,
} from "@infokit/shared/public-simulator";

import { PublicSiteShell } from "~/components/public/public-site-shell";
import { SimulatorExperience } from "~/components/public/simulator-experience";

function formatDate(
  value: string | null,
  locale: PublicLocale,
  unavailable: string,
) {
  if (!value) return unavailable;
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
    new Date(value),
  );
}

/**
 * Server wrapper: resolves labels and dates, then hands the walk to the client
 * component. The published route and the editor preview share this shell so a
 * preview cannot look friendlier than what readers get.
 */
export function SimulatorPage({
  locale,
  document,
  messages,
  navigationMessages,
  preview = false,
}: {
  locale: PublicLocale;
  document: PublicSimulatorDocument;
  messages: PageCatalog<"public-simulator">;
  navigationMessages: PageCatalog<"public-content">;
  preview?: boolean;
}) {
  const labels: PublicSimulatorLabels = {
    brand: messages["simulator.brand"],
    privacy: messages["simulator.privacy"],
    privacyDetail: messages["simulator.privacyDetail"],
    source: messages["simulator.source"],
    lastReviewed: messages["simulator.lastReviewed"],
    reviewDue: messages["simulator.reviewDue"],
    notAvailable: messages["simulator.notAvailable"],
    fallback: messages["simulator.fallback"],
    preview: messages["simulator.preview"],
    previewDetail: messages["simulator.previewDetail"],
    begin: messages["simulator.begin"],
    continue: messages["simulator.continue"],
    back: messages["simulator.back"],
    startAgain: messages["simulator.startAgain"],
    step: messages["simulator.step"],
    question: messages["simulator.question"],
    information: messages["simulator.information"],
    result: messages["simulator.result"],
    disclaimer: messages["simulator.disclaimer"],
  };
  const route = preview
    ? `/simulator/preview/${document.flowId}`
    : `/simulator/${document.slug}`;

  return (
    <PublicSiteShell
      locale={locale}
      currentPath={route}
      messages={navigationMessages}
      width="reading"
    >
      <SimulatorExperience
        document={document}
        labels={labels}
        lastReviewedLabel={formatDate(
          document.lastReviewedAt,
          locale,
          messages["simulator.notAvailable"],
        )}
        reviewDueLabel={formatDate(
          document.reviewDueAt,
          locale,
          messages["simulator.notAvailable"],
        )}
        preview={preview}
      />
    </PublicSiteShell>
  );
}
