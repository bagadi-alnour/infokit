import type { PublicLocale } from "@calais/shared/i18n";
import type { PageCatalog } from "@calais/shared/i18n/catalogs";
import {
  PublicSimulatorExperience,
  type PublicSimulatorDocument,
  type PublicSimulatorLabels,
} from "@calais/ui";
import Link from "next/link";

import { PublicPreferences } from "~/components/public/public-preferences";
import { localizedPath } from "~/i18n/routing";

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
  const navigation = [
    ["/", navigationMessages["public.nav.home"]],
    ["/simulator", navigationMessages["public.nav.guide"]],
    ["/activities", navigationMessages["public.nav.activities"]],
    ["/articles", navigationMessages["public.nav.articles"]],
  ] as const;

  return (
    <PublicSimulatorExperience
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
      headerActions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <nav
            aria-label={navigationMessages["public.nav.label"]}
            className="order-2 flex max-w-full gap-1 overflow-x-auto lg:order-none"
          >
            {navigation.map(([path, label]) => (
              <Link
                key={path}
                href={localizedPath(path, locale)}
                aria-current={path === "/simulator" ? "page" : undefined}
                className="text-copy-muted hover:bg-brand-soft hover:text-brand focus-visible:ring-brand rounded-control aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand min-h-11 shrink-0 px-3 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
              >
                {label}
              </Link>
            ))}
          </nav>
          <PublicPreferences
            locale={locale}
            currentPath={route}
            languageLabel={navigationMessages["public.languages"]}
            themeLabel={navigationMessages["public.theme"]}
          />
        </div>
      }
    />
  );
}
