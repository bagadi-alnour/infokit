import type {
  PublicSimulatorCollectionLabels,
  PublicSimulatorSummary,
} from "@infokit/shared/public-content";
import { ArrowRight, Languages, Lock, MapPin, ShieldCheck } from "lucide-react";

import { Callout, MetaRow, SurfaceCard } from "~/components/public/primitives";

/**
 * The guide index. Each card is a path the reader can start; the privacy
 * promise is stated once, above the list, because it applies to all of them
 * (docs/DESIGN-SYSTEM.md §1 — answers before atmosphere).
 */
export function PublicSimulatorCollection({
  simulators,
  labels,
}: {
  simulators: PublicSimulatorSummary[];
  labels: PublicSimulatorCollectionLabels;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Callout tone="info" role="note">
        <span className="inline-flex items-start gap-2">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {labels.privacy}
        </span>
      </Callout>

      {simulators.length === 0 ? (
        <SurfaceCard className="p-8 text-center">
          <p className="text-copy-muted text-base">{labels.empty}</p>
        </SurfaceCard>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {simulators.map((simulator) => (
            <SurfaceCard
              as="li"
              key={simulator.id}
              className="focus-within:border-brand hover:border-brand hover:shadow-lift group relative flex flex-col gap-3 p-5 transition-shadow md:p-6"
            >
              <h2 className="font-display text-ink text-xl font-bold leading-snug">
                <a
                  href={simulator.href}
                  className="rounded-control focus-visible:outline-brand after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {simulator.title}
                </a>
              </h2>

              <p className="text-copy-muted text-[0.95rem] leading-relaxed">
                {simulator.summary}
              </p>

              <dl className="border-line mt-auto flex flex-col gap-2 border-t pt-4">
                <MetaRow
                  label={labels.city}
                  icon={<MapPin className="size-3.5" aria-hidden />}
                >
                  {simulator.cityLabel}
                </MetaRow>
                <MetaRow
                  label={labels.sourceLanguage}
                  icon={<Languages className="size-3.5" aria-hidden />}
                >
                  {simulator.sourceLanguageLabel}
                </MetaRow>
                <MetaRow
                  label={labels.lastReviewed}
                  icon={<ShieldCheck className="size-3.5" aria-hidden />}
                >
                  {simulator.lastReviewedLabel}
                </MetaRow>
              </dl>

              <p className="text-brand-deep inline-flex items-center gap-1.5 text-sm font-semibold">
                {labels.open}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                  aria-hidden
                />
              </p>
            </SurfaceCard>
          ))}
        </ul>
      )}
    </div>
  );
}
