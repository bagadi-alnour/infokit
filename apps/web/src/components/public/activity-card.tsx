import type {
  PublicActivityDetail,
  PublicActivityLabels,
  PublicActivityStatus,
  PublicActivitySummary,
} from "@infokit/shared/public-content";
import { Clock, ExternalLink, Languages, MapPin, Users } from "lucide-react";
import type { ReactNode } from "react";

import { ActivityShareActions } from "~/components/public/activity-share";
import {
  Chip,
  FreshnessNote,
  MetaRow,
  StatusPill,
  SurfaceCard,
  cardLink,
  cardShell,
  familyStyles,
  inlineLinkClass,
  statusWord,
} from "~/components/public/primitives";
import { TransitLinkCard } from "~/components/public/transit-links";
import { TaxonomyIcon } from "~/components/taxonomy-icon";
import { cn } from "~/lib/utils";

/**
 * The activity page's own body: status and next time → place → who it is for →
 * schedule → providing association → services. Every field is a row with its
 * own label, because this is the surface a reader arrives at to settle a
 * question rather than to compare (docs/DESIGN-SYSTEM.md §2 rule 3 — the order
 * is a rule, and `ShelfBody` below keeps it under compression).
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
        {/* An activity the platform holds has no association behind it, so the
            row is left out rather than labelled with nobody. */}
        {activity.providers.length > 0 || activity.providerNames.length > 0 ? (
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
        ) : null}
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

/**
 * The status ramp as the rule across the head of an activity card
 * (docs/DESIGN-SYSTEM.md §5). It repeats the status a third time, after the word
 * and the icon in the pill: down a long list it is what lets someone find the
 * open places by eye, without reading every card.
 */
const statusRule: Record<PublicActivityStatus, string> = {
  open: "bg-ok",
  closed: "bg-neutral",
  cancelled: "bg-danger",
  uncertain: "bg-warn",
};

/** The rule itself, so both shapes of the card draw the same 6px band. */
function StatusRule({ status }: { status: PublicActivityStatus }) {
  return <div className={cn("h-1.5 w-full", statusRule[status])} />;
}

/**
 * One activity as a shelf card reads it: the state and how long ago it was
 * checked first, then what it is and who runs it, then where and when, then the
 * services, and last who it is for. The whole card is the link, so the reading
 * order carries no inline anchors that a thumb would have to find inside it —
 * the map and the association's own page are one tap further on, on the activity
 * page itself.
 *
 * `roomy` is the compression rule of §2 rule 3, never a reorder: the wide card
 * has space for the short description and for service names, and the narrow one
 * carries the services as glyphs with their names in the accessible tree.
 */
function ShelfBody({
  activity,
  labels,
  roomy,
}: {
  activity: PublicActivitySummary;
  labels: PublicActivityLabels;
  roomy: boolean;
}) {
  return (
    <>
      {/* The state and the age of the check are one line about one moment, so
          they sit on a shared centre line: the pill is the taller of the two and
          the note would otherwise hang off its top edge. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <StatusPill
          status={activity.status}
          label={statusWord(activity.status, labels)}
          detail={activity.nextOpeningLabel}
          className="rounded-full"
        />
        <FreshnessNote
          label={labels.lastVerified}
          value={activity.lastVerifiedLabel}
          dateTime={activity.lastVerifiedIso}
          title={activity.lastVerifiedDateLabel}
          className="text-xs"
        />
      </div>

      <h3
        className={cn(
          "font-display text-ink mt-4 font-bold leading-snug",
          roomy ? "text-xl" : "text-lg",
        )}
      >
        <a
          href={activity.href}
          className={cn(cardLink, "focus-visible:outline-brand")}
        >
          {activity.name}
        </a>
      </h3>
      {/* Most activities are run by an association and say so. Some are the
          platform's own record of a public offering, with no association behind
          them, and naming a provider for those would be an empty promise. */}
      {activity.providerNames.length > 0 ? (
        <p className="text-copy-muted mt-1 text-sm">
          {labels.provider}{" "}
          <span className="text-ink font-medium">
            {activity.providerNames.join(", ")}
          </span>
        </p>
      ) : null}
      {roomy && activity.shortDescription ? (
        <p className="text-copy-muted mt-2 text-[0.95rem] leading-relaxed">
          {activity.shortDescription}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {/* Glyph in the accent, words in the metadata grey (rule 4): where it is
            and when it opens are the two lines a reader scans a shelf by, and
            an icon drawn in the same grey as its own sentence is not a
            way in. */}
        {activity.placeName ? (
          <p className="text-copy-muted inline-flex items-start gap-1.5 text-sm">
            <MapPin className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
            {roomy
              ? activity.address || activity.placeName
              : activity.placeName}
          </p>
        ) : null}
        {/* The week on one line — "Mon–Fri 13:00–17:00" — the same days the
            detail page lays out on a row each, collapsed by the server. */}
        <p className="text-copy-muted inline-flex items-start gap-1.5 text-sm">
          <Clock className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
          {activity.scheduleSummary}
        </p>
      </div>

      {activity.services.length > 0 ? (
        <div className="mt-4 flex-1">
          <p className="text-copy-muted mb-2 text-xs font-bold uppercase tracking-[0.08em]">
            {labels.services}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {activity.services.map((service) =>
              roomy ? (
                <li key={service.id}>
                  <Chip icon={<TaxonomyIcon name={service.icon} size={15} />}>
                    {service.label}
                  </Chip>
                </li>
              ) : (
                <li
                  key={service.id}
                  // The glyph is short-hand for a word the reader can still
                  // get: the name is on the element for a pointer and in the
                  // accessible tree for a screen reader (rule 1).
                  title={service.label}
                  className="bg-brand-soft text-brand-soft-ink rounded-chip flex size-8 items-center justify-center"
                >
                  <TaxonomyIcon name={service.icon} size={16} aria-hidden />
                  <span className="sr-only">{service.label}</span>
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}

      <div className="border-line mt-4 flex flex-col gap-2 border-t pt-3">
        <p className="text-copy-muted text-xs font-medium">
          {activity.audienceLabel}
        </p>
        {activity.fallbackUsed ? (
          <p className="text-copy-muted inline-flex items-start gap-1.5 text-xs leading-relaxed">
            <Languages className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {activity.fallbackLabel}
          </p>
        ) : null}
      </div>
    </>
  );
}

/**
 * The one activity card, in the two shapes the site needs.
 *
 * `stacked` is the shelf card of the home page: three to a row, tall, the
 * services as glyphs. `wide` is the same card turned rectangular for a
 * one-column list, with room for the cover photograph when the record has one
 * — and no empty frame when it does not (AGENTS.md rule 5). A reader who met an
 * activity on the home page and then opened the list is holding the same card,
 * which is the point of it being one component.
 */
export function ActivityCard({
  activity,
  labels,
  layout = "stacked",
}: {
  activity: PublicActivitySummary;
  labels: PublicActivityLabels;
  layout?: "stacked" | "wide";
}) {
  if (layout === "wide") {
    return (
      <SurfaceCard
        as="li"
        className={cn(
          cardShell,
          "overflow-hidden p-0",
          familyStyles.activity.focusBorder,
        )}
      >
        <StatusRule status={activity.status} />
        <div className="flex flex-col sm:flex-row">
          {activity.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote editorial media, no known intrinsic size
            <img
              src={activity.coverImage.url}
              alt={
                activity.coverImage.decorative ? "" : activity.coverImage.alt
              }
              aria-hidden={activity.coverImage.decorative || undefined}
              className="bg-subtle h-44 w-full shrink-0 self-stretch object-cover sm:h-auto sm:w-52 lg:w-64"
              loading="lazy"
            />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col p-5 md:p-6">
            <ShelfBody activity={activity} labels={labels} roomy />
          </div>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard
      as="li"
      className={cn(
        cardShell,
        // The rule is the activity family's one carrier (§5), so the stacked
        // card wears it too — it used to be on the wide card only, which left
        // the shelves that show activities beside other content (the home page,
        // an association's own page) as the one place the ramp went missing.
        "h-full overflow-hidden p-0",
        familyStyles.activity.focusBorder,
      )}
    >
      <StatusRule status={activity.status} />
      <div className="flex flex-1 flex-col p-5">
        <ShelfBody activity={activity} labels={labels} roomy={false} />
      </div>
    </SurfaceCard>
  );
}

/**
 * One activity page. Same order as the card, plus the authored description and
 * the "before you go" guidance, which readers need last — after they know the
 * activity is relevant and open.
 *
 * `location` arrives as a slot rather than being drawn here: the map is Leaflet
 * and its stylesheet, and this module is also the shelf card that the home page
 * and the list draw. Handed in by the one page that wants a map, the map's cost
 * stays on that page.
 */
export function PublicActivityDetailView({
  activity,
  labels,
  location,
}: {
  activity: PublicActivityDetail;
  labels: PublicActivityLabels;
  location?: ReactNode;
}) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
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

        {/* Last on the page, and pushed to the reading edge's far side: a reader
            reaches these only once the answer above them is read, and what they
            do here is pass it on rather than learn anything new. */}
        <ActivityShareActions
          className="justify-end"
          title={activity.name}
          labels={{
            share: labels.share,
            copied: labels.shareCopied,
            downloadPdf: labels.downloadPdf,
          }}
        />
      </div>

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
          {/* The age is what a reader judges the check by, and the date is the
              record of it — the page with the room for both carries both. */}
          <div className="flex flex-col gap-0.5">
            <FreshnessNote
              label={labels.lastVerified}
              value={activity.lastVerifiedLabel}
              dateTime={activity.lastVerifiedIso}
            />
            {activity.lastVerifiedIso ? (
              <p className="text-copy-muted ms-[1.375rem] text-sm">
                {activity.lastVerifiedDateLabel}
              </p>
            ) : null}
          </div>
          {activity.fallbackUsed ? (
            <p className="text-copy-muted inline-flex items-start gap-1.5 text-sm">
              <Languages className="mt-0.5 size-4 shrink-0" aria-hidden />
              {activity.fallbackLabel}
            </p>
          ) : null}
        </SurfaceCard>
        {/* Where it is, drawn rather than promised — the link out to a map used
            to stand here, and a reader had to leave the page to learn whether
            the address was anywhere near them. */}
        {location}
        {/* And how to reach it, under the map for the reader who has just seen
            that it is across town. Written by the association, never guessed
            from the address: this is the one thing on the page nobody can work
            out from a pin. */}
        <TransitLinkCard
          links={activity.transit}
          heading={labels.gettingHere}
        />
      </aside>
    </div>
  );
}
