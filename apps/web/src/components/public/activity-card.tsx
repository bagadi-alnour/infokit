import type {
  PublicActivityDetail,
  PublicActivityLabels,
  PublicActivitySummary,
} from "@infokit/shared/public-content";
import { Clock, ExternalLink, Languages, MapPin, Users } from "lucide-react";

import {
  ActionAnchor,
  Chip,
  FreshnessNote,
  MetaRow,
  StatusPill,
  SurfaceCard,
  inlineLinkClass,
  statusWord,
} from "~/components/public/primitives";
import { TaxonomyIcon } from "~/components/taxonomy-icon";
import { cn } from "~/lib/utils";

/**
 * Every activity — in a list, on a map popup, on its own page — is read in the
 * same order: name → status and next time → place → who it is for → services →
 * providing association → freshness. Readers compare cards by position, so the
 * order is a rule, not a layout preference (docs/DESIGN-SYSTEM.md §2 rule 3).
 */
function ActivityBody({
  activity,
  labels,
}: {
  activity: PublicActivitySummary;
  labels: PublicActivityLabels;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill
          status={activity.status}
          label={statusWord(activity.status, labels)}
          detail={
            activity.status === "closed" ? activity.nextOpeningLabel : undefined
          }
        />
        <Chip icon={<TaxonomyIcon name={activity.categoryIcon} size={15} />}>
          {activity.categoryLabel}
        </Chip>
      </div>

      <dl className="flex flex-col gap-2.5">
        <MetaRow
          label={labels.place}
          icon={<MapPin className="size-3.5" aria-hidden />}
        >
          {activity.mapHref ? (
            <a
              href={activity.mapHref}
              target="_blank"
              rel="noreferrer"
              className={cn(inlineLinkClass, "inline-flex items-center gap-1")}
            >
              {activity.address || activity.placeName}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : (
            activity.address || activity.placeName
          )}
        </MetaRow>
        {labels.audience ? (
          <MetaRow
            label={labels.audience}
            icon={<Users className="size-3.5" aria-hidden />}
          >
            {activity.audienceLabel}
          </MetaRow>
        ) : null}
        <MetaRow
          label={labels.schedule}
          icon={<Clock className="size-3.5" aria-hidden />}
        >
          <span className="flex flex-col gap-0.5">
            {activity.scheduleLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </span>
        </MetaRow>
        <MetaRow label={labels.provider}>
          {activity.providers.length > 0
            ? activity.providers.map((provider, index) => (
                <span key={provider.href}>
                  {index > 0 ? ", " : null}
                  <a href={provider.href} className={inlineLinkClass}>
                    {provider.name}
                  </a>
                </span>
              ))
            : activity.providerNames.join(", ")}
        </MetaRow>
      </dl>

      {activity.services.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-copy-muted text-xs font-bold uppercase tracking-[0.08em]">
            {labels.services}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {activity.services.map((service) => (
              <li key={service.id}>
                <Chip icon={<TaxonomyIcon name={service.icon} size={15} />}>
                  {service.label}
                </Chip>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

/** List card: name is the link, the action repeats it for touch. */
export function ActivityCard({
  activity,
  labels,
}: {
  activity: PublicActivitySummary;
  labels: PublicActivityLabels;
}) {
  return (
    <SurfaceCard
      as="li"
      className="focus-within:border-brand hover:border-brand hover:shadow-lift flex flex-col gap-4 p-5 transition-shadow md:p-6"
    >
      <div className="flex gap-4">
        {activity.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote editorial media, no known intrinsic size
          <img
            src={activity.coverImage.url}
            alt={activity.coverImage.decorative ? "" : activity.coverImage.alt}
            aria-hidden={activity.coverImage.decorative || undefined}
            className="bg-subtle rounded-control hidden size-28 shrink-0 object-cover sm:block"
            loading="lazy"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="font-display text-ink text-lg font-bold leading-snug">
            <a
              href={activity.href}
              className="rounded-control hover:text-brand-deep focus-visible:outline-brand focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {activity.name}
            </a>
          </h3>
          {activity.shortDescription ? (
            <p className="text-copy-muted text-[0.95rem] leading-relaxed">
              {activity.shortDescription}
            </p>
          ) : null}
        </div>
      </div>

      <ActivityBody activity={activity} labels={labels} />

      {activity.fallbackUsed ? (
        <p className="text-copy-muted inline-flex items-start gap-1.5 text-sm">
          <Languages className="mt-0.5 size-4 shrink-0" aria-hidden />
          {activity.fallbackLabel}
        </p>
      ) : null}

      <div className="border-line flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <FreshnessNote
          label={labels.lastVerified}
          value={activity.lastVerifiedLabel}
        />
        <ActionAnchor href={activity.href} tone="outline" size="compact">
          {labels.open}
        </ActionAnchor>
      </div>
    </SurfaceCard>
  );
}

/**
 * One activity page. Same order as the card, plus the authored description and
 * the "before you go" guidance, which readers need last — after they know the
 * activity is relevant and open.
 */
export function PublicActivityDetailView({
  activity,
  labels,
}: {
  activity: PublicActivityDetail;
  labels: PublicActivityLabels;
}) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <SurfaceCard as="article" className="flex flex-col gap-5 p-6 md:p-8">
        <ActivityBody activity={activity} labels={labels} />

        {activity.description ? (
          <div className="infokit-prose border-line border-t pt-5">
            {activity.description
              .split(/\n{2,}/)
              .map((block) => block.trim())
              .filter(Boolean)
              .map((block, index) => (
                <p key={index}>{block}</p>
              ))}
          </div>
        ) : null}

        {activity.instructions && labels.instructions ? (
          <section className="bg-subtle rounded-card border-line flex flex-col gap-2 border p-4">
            <h2 className="text-copy-muted text-xs font-bold uppercase tracking-[0.08em]">
              {labels.instructions}
            </h2>
            <p className="text-ink whitespace-pre-wrap text-[0.95rem] leading-relaxed">
              {activity.instructions}
            </p>
          </section>
        ) : null}
      </SurfaceCard>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
        {activity.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote editorial media, no known intrinsic size
          <img
            src={activity.coverImage.url}
            alt={activity.coverImage.decorative ? "" : activity.coverImage.alt}
            aria-hidden={activity.coverImage.decorative || undefined}
            className="bg-subtle rounded-card border-line w-full border object-cover"
            loading="lazy"
          />
        ) : null}
        <SurfaceCard className="flex flex-col gap-4 p-5">
          <FreshnessNote
            label={labels.lastVerified}
            value={activity.lastVerifiedLabel}
          />
          {activity.mapHref ? (
            <ActionAnchor
              href={activity.mapHref}
              target="_blank"
              rel="noreferrer"
              tone="outline"
              size="block"
            >
              <MapPin className="size-5" aria-hidden />
              {labels.place}
              <ExternalLink className="size-4" aria-hidden />
            </ActionAnchor>
          ) : null}
          {activity.fallbackUsed ? (
            <p className="text-copy-muted inline-flex items-start gap-1.5 text-sm">
              <Languages className="mt-0.5 size-4 shrink-0" aria-hidden />
              {activity.fallbackLabel}
            </p>
          ) : null}
        </SurfaceCard>
      </aside>
    </div>
  );
}
