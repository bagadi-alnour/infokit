import type {
  PublicActivityLabels,
  PublicActivitySummary,
} from "@infokit/shared/public-content";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Languages,
  Lock,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  UserRoundX,
  WifiOff,
} from "lucide-react";

import { ActivityCard } from "~/components/public/activity-card";
import { HomeSearch } from "~/components/public/home-search";
import {
  ActionLink,
  cardLink,
  familyStyles,
  liftCard,
  SurfaceCard,
} from "~/components/public/primitives";
import { TaxonomyIcon } from "~/components/taxonomy-icon";
import type { SearchSuggestionGroup } from "~/lib/search-suggestions";
import { cn } from "~/lib/utils";
import type {
  AssociationRoute,
  BasicInformationRoute,
  ServiceRoute,
  UrgentRoute,
} from "~/server/content/public-basics-payload";

export interface HomeLabels {
  /** The hero: what this is, what it answers, and how to search it. */
  eyebrow: string;
  title: string;
  description: string;
  search: string;
  searchPlaceholder: string;
  /** The chip that drops every filter, after the kinds of help. */
  allNeeds: string;
  /** The one line on the photo, for a reader who cannot yet name their need. */
  guideTeaser: string;
  /** The shortest-routes band: the numbers to press, then water and a shower. */
  urgent: string;
  urgentBody: string;
  /** The open-now band, and the link to the unfiltered list. */
  openNow: string;
  openNowBody: string;
  allActivities: string;
  /** The services band. */
  services: string;
  servicesBody: string;
  /** "{count} activities" — the one counted phrase, translated everywhere. */
  activityCount: string;
  /** The word on a card's "how many · open it" line. */
  published: string;
  /** The guide: the one route for someone who cannot yet name what they need. */
  guideEyebrow: string;
  newHere: string;
  newHereBody: string;
  newHereAction: string;
  guidePrivate: string;
  /** The two slower ways on beside it. */
  articles: string;
  articlesDescription: string;
  agenda: string;
  agendaDescription: string;
  /** The associations band: who is behind everything above it. */
  associations: string;
  associationsBody: string;
  /** The closing promise, and the four things it rests on. */
  trust: string;
  trustBody: string;
  reliability: string;
  reliabilityDescription: string;
  trustOffline: string;
  trustOfflineBody: string;
  trustLanguages: string;
  trustLanguagesBody: string;
  trustAnonymous: string;
  trustAnonymousBody: string;
}

/**
 * A band the width of the window whose words keep the page column: the negative
 * margin makes the section exactly 100vw wide and the matching padding puts the
 * content back on the column at every width. Both percentages resolve against
 * the same containing block, so the two cancel. The shell clips the x axis, so
 * the bleed cannot raise a horizontal scrollbar (public-site-shell.tsx).
 */
const bleed = "mx-[calc(50%-50vw)] px-[calc(50vw-50%)]";

/** A washed band: the fill and the two hairlines that separate it from canvas. */
const washedBand = cn(bleed, "border-line bg-subtle border-y");

const bandHeading =
  "font-display text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl";

/** The 48px square that carries a tile's glyph. Shape only — callers tint it. */
const iconTile =
  "rounded-control inline-flex size-12 shrink-0 items-center justify-center";

/** The pill an opening wears: a small filled label above a heading. */
const badgePill =
  "bg-brand-soft text-brand-soft-ink inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold";

/**
 * The home page reads top to bottom as urgency descends: what this is and how to
 * search it, then the shortest routes to press now, then what is open, then the
 * services behind it, then the guide and the slower ways on, then who publishes
 * it all, and last the promise that says how far to trust any of it.
 *
 * Each band says one thing, and a band with nothing published behind it
 * disappears rather than render an empty shelf (AGENTS.md rule 5). Colour stays
 * on one element per surface (docs/DESIGN-SYSTEM.md §5): the emergency call is
 * the only red, the guide panel the only filled accent, and the reading and
 * agenda cards each carry their family on their glyph tile alone.
 */
export function PublicHomeExperience({
  labels,
  links,
  counts,
  suggestions,
  urgent,
  basics,
  services,
  openNow,
  activityLabels,
  associations,
}: {
  labels: HomeLabels;
  links: {
    activities: string;
    articles: string;
    events: string;
    guide: string;
  };
  counts: { articles: number; events: number; guides: number };
  /** What the search box can offer as the reader types, in their language. */
  suggestions: SearchSuggestionGroup[];
  /** The two or three shortest routes on the page, under the masthead. */
  urgent: UrgentRoute[];
  basics: BasicInformationRoute[];
  services: ServiceRoute[];
  /** The few activities open at this hour — empty closes the band. */
  openNow: PublicActivitySummary[];
  activityLabels: PublicActivityLabels;
  associations: AssociationRoute[];
}) {
  const activityCount = (count: number) =>
    labels.activityCount.replace("{count}", String(count));

  const trust = [
    {
      Icon: ShieldCheck,
      title: labels.reliability,
      body: labels.reliabilityDescription,
    },
    {
      Icon: WifiOff,
      title: labels.trustOffline,
      body: labels.trustOfflineBody,
    },
    {
      Icon: Languages,
      title: labels.trustLanguages,
      body: labels.trustLanguagesBody,
    },
    {
      Icon: UserRoundX,
      title: labels.trustAnonymous,
      body: labels.trustAnonymousBody,
    },
  ];

  return (
    <>
      {/* The masthead runs the width of the window, and its negative top margin
          cancels the shell's padding so the band meets the bar above it. */}
      <section className={cn(bleed, "border-line -mt-8 border-b md:-mt-12")}>
        <div className="grid items-center gap-12 py-12 md:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            {/* No date on the masthead: a page-wide "last verified" is the one
                freshness claim that answers nothing — it is the newest check in
                the corpus, not a check on what the reader is about to read. Each
                card carries its own, which is where a claim about a single
                answer belongs (docs/DESIGN-SYSTEM.md §1). */}
            <p className={badgePill}>
              <Sparkles className="size-3.5" aria-hidden />
              {labels.eyebrow}
            </p>

            <h1 className="font-display text-ink mt-5 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              {labels.title}
            </h1>

            <p className="text-copy-muted mt-5 max-w-2xl text-pretty text-lg leading-relaxed">
              {labels.description}
            </p>

            {/* Still a plain GET form to the activity list — the reader's words
                arrive as `?q=`, which the list seeds its own search box from —
                and the published words are offered as they type. The matching
                happens in the browser against an index delivered with the page,
                so nothing typed here is sent anywhere (rule 7). */}
            <HomeSearch
              action={links.activities}
              groups={suggestions}
              labels={{
                search: labels.search,
                placeholder: labels.searchPlaceholder,
              }}
            />

            {/* The kinds of help that are actually published, then the chip that
                drops the filter. A category with nothing behind it is never
                offered, so no chip can open an empty list. */}
            {basics.length > 0 ? (
              <ul className="mt-5 flex flex-wrap gap-2">
                {basics.map((route) => (
                  <li key={route.code}>
                    <ActionLink
                      href={route.href}
                      tone="outline"
                      size="compact"
                      className="rounded-full font-medium"
                    >
                      <TaxonomyIcon
                        name={route.icon}
                        size={18}
                        className="text-brand-deep"
                      />
                      {route.label}
                    </ActionLink>
                  </li>
                ))}
                <li>
                  <ActionLink
                    href={links.activities}
                    tone="soft"
                    size="compact"
                    className="rounded-full font-semibold"
                  >
                    {labels.allNeeds}
                    <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                  </ActionLink>
                </li>
              </ul>
            ) : null}
          </div>

          {/* The photograph carries no information — it says who the site is
              for, and the page reads exactly the same when images never arrive
              (rule 3), so it is decorative and stays out of the reading order.
              The one card on top of it is the guide, for a reader who cannot yet
              name what they need. */}
          <div className="relative">
            <div className="border-line rounded-panel shadow-float relative aspect-[4/3] overflow-hidden border">
              {/* eslint-disable-next-line @next/next/no-img-element -- one static asset served from /public; Next's optimiser is off in this app */}
              <img
                src="/hero-calais.webp"
                alt=""
                width={1024}
                height={1024}
                className="bg-subtle size-full object-cover"
              />
              <span
                className="from-ink/25 absolute inset-0 bg-gradient-to-t to-transparent"
                aria-hidden
              />
            </div>

            {/* The teaser hangs off the bottom edge of the photograph rather
                than sitting inside it: a card that overlaps the frame reads as
                one more thing on the page, and half of it below the frame reads
                as something lifted off the picture. */}
            {counts.guides > 0 ? (
              <div className="border-line bg-surface/95 rounded-card shadow-lift absolute -bottom-10 end-4 start-4 border p-4 backdrop-blur sm:end-auto sm:start-6 sm:max-w-xs">
                <p className="text-ink text-sm font-semibold">
                  {labels.guideTeaser}
                </p>
                <ActionLink
                  href={links.guide}
                  tone="soft"
                  size="compact"
                  className="mt-2 rounded-full font-semibold"
                >
                  {labels.newHereAction}
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </ActionLink>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* The three shortest routes on the page: the call for danger, the call for
          a bed tonight, and the way to water and a shower. Nothing here is a new
          fact — each card is a door, and the third one opens a filter on what is
          published rather than making a claim of its own. */}
      {urgent.length > 0 ? (
        <section aria-labelledby="urgent" className="py-12 md:py-14">
          <div className="max-w-2xl">
            <h2 id="urgent" className={cn(bandHeading, "text-ink")}>
              {labels.urgent}
            </h2>
            <p className="text-copy-muted mt-2 text-pretty leading-relaxed">
              {labels.urgentBody}
            </p>
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {urgent.map((route) => (
              <li key={route.code}>
                <a
                  href={route.href}
                  className={cn(
                    "bg-surface border-line rounded-card shadow-ring group flex h-full items-start gap-4 border p-5 transition-all hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2",
                    route.danger
                      ? "hover:border-danger focus-visible:outline-danger"
                      : "hover:border-brand focus-visible:outline-brand",
                  )}
                >
                  <span
                    className={cn(
                      iconTile,
                      route.danger
                        ? "bg-danger-soft text-danger"
                        : "bg-brand-soft text-brand-deep",
                    )}
                    aria-hidden
                  >
                    <TaxonomyIcon name={route.icon} size={24} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-display text-ink font-bold leading-tight">
                        {route.title}
                      </span>
                      <ChevronRight
                        className="text-copy-muted size-5 shrink-0 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                    <span className="text-copy-muted mt-1 block text-sm leading-relaxed">
                      {route.hint}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* What a reader can walk to right now. Nothing open at this hour closes
          the band: an "open now" heading over a list of closed places would be
          the one thing this site cannot afford to get wrong. */}
      {openNow.length > 0 ? (
        <section aria-labelledby="open-now" className={washedBand}>
          <div className="py-12 md:py-14">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
              <div className="max-w-2xl">
                <h2 id="open-now" className={cn(bandHeading, "text-ink")}>
                  {labels.openNow}
                </h2>
                <p className="text-copy-muted mt-2 text-pretty leading-relaxed">
                  {labels.openNowBody}
                </p>
              </div>
              <ActionLink
                href={links.activities}
                tone="outline"
                className="rounded-full"
              >
                {labels.allActivities}
                <ArrowRight className="size-5 rtl:rotate-180" aria-hidden />
              </ActionLink>
            </div>

            <ul className="mt-8 grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
              {openNow.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  labels={activityLabels}
                />
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* The second axis of the same set: one tile per service that is actually
          offered, each opening the list already filtered to it. */}
      {services.length > 0 ? (
        <section aria-labelledby="services" className="py-12 md:py-14">
          <div className="max-w-2xl">
            <h2 id="services" className={cn(bandHeading, "text-ink")}>
              {labels.services}
            </h2>
            <p className="text-copy-muted mt-2 text-pretty leading-relaxed">
              {labels.servicesBody}
            </p>
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {services.map((service) => (
              <li key={service.id}>
                <a
                  href={service.href}
                  className="bg-surface border-line rounded-card shadow-ring hover:border-brand focus-visible:outline-brand group flex h-full flex-col items-start gap-3 border p-5 transition-all hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <span
                    className={cn(
                      iconTile,
                      "bg-brand-soft text-brand-deep group-hover:bg-brand group-hover:text-brand-ink transition-colors",
                    )}
                    aria-hidden
                  >
                    <TaxonomyIcon name={service.icon} size={24} />
                  </span>
                  <span>
                    <span className="font-display text-ink block font-bold leading-tight">
                      {service.label}
                    </span>
                    <span className="text-copy-muted mt-0.5 block text-sm">
                      {activityCount(service.count)}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* The guide is the route for a reader who cannot yet name what they need,
          and the one filled panel on the page: nothing else competes with it. */}
      {counts.guides > 0 ? (
        <section aria-labelledby="guide" className="py-6 md:py-8">
          <div className="bg-brand text-brand-ink rounded-panel relative overflow-hidden px-6 py-12 sm:px-12">
            <div className="relative z-10 max-w-2xl">
              <p className={cn(badgePill, "bg-brand-ink/15 text-brand-ink")}>
                <MessagesSquare className="size-3.5" aria-hidden />
                {labels.guideEyebrow}
              </p>
              <h2
                id="guide"
                className="font-display mt-4 text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
              >
                {labels.newHere}
              </h2>
              <p className="text-brand-ink/85 mt-4 text-pretty text-lg leading-relaxed">
                {labels.newHereBody}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                <ActionLink
                  href={links.guide}
                  tone="soft"
                  size="large"
                  className="rounded-full px-8 text-base"
                >
                  {labels.newHereAction}
                  <ArrowRight className="size-5 rtl:rotate-180" aria-hidden />
                </ActionLink>
                <p className="text-brand-ink/85 inline-flex items-center gap-2 text-sm font-medium">
                  <Lock className="size-4" aria-hidden />
                  {labels.guidePrivate}
                </p>
              </div>
            </div>

            <span
              className="bg-brand-ink/10 pointer-events-none absolute -end-16 -top-16 size-64 rounded-full"
              aria-hidden
            />
            <span
              className="bg-brand-ink/10 pointer-events-none absolute -bottom-20 end-24 size-48 rounded-full"
              aria-hidden
            />
          </div>
        </section>
      ) : null}

      {/* The slower ways on, each wearing its own family on its glyph tile. */}
      {counts.articles > 0 || counts.events > 0 ? (
        <div className="grid gap-5 pb-12 pt-6 md:grid-cols-2 md:pb-14 md:pt-8">
          {counts.articles > 0 ? (
            <SurfaceCard
              as="section"
              className={cn(
                liftCard,
                "group gap-4 p-6",
                familyStyles.article.hoverBorder,
              )}
            >
              <span
                className={cn(
                  iconTile,
                  familyStyles.article.wash,
                  familyStyles.article.text,
                )}
                aria-hidden
              >
                <BookOpen className="size-6" />
              </span>
              <h2 className="font-display text-ink text-xl font-bold leading-snug">
                <a
                  href={links.articles}
                  className={cn(cardLink, "focus-visible:outline-article")}
                >
                  {labels.articles}
                </a>
              </h2>
              <p className="text-copy-muted flex-1 leading-relaxed">
                {labels.articlesDescription}
              </p>
              <p className="text-ink inline-flex items-center gap-2 text-sm font-semibold">
                {counts.articles} · {labels.published}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                  aria-hidden
                />
              </p>
            </SurfaceCard>
          ) : null}

          {counts.events > 0 ? (
            <SurfaceCard
              as="section"
              className={cn(
                liftCard,
                "group gap-4 p-6",
                familyStyles.event.hoverBorder,
              )}
            >
              <span
                className={cn(
                  iconTile,
                  familyStyles.event.wash,
                  familyStyles.event.text,
                )}
                aria-hidden
              >
                <CalendarDays className="size-6" />
              </span>
              <h2 className="font-display text-ink text-xl font-bold leading-snug">
                <a
                  href={links.events}
                  className={cn(cardLink, "focus-visible:outline-event")}
                >
                  {labels.agenda}
                </a>
              </h2>
              <p className="text-copy-muted flex-1 leading-relaxed">
                {labels.agendaDescription}
              </p>
              <p className="text-ink inline-flex items-center gap-2 text-sm font-semibold">
                {counts.events} · {labels.published}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                  aria-hidden
                />
              </p>
            </SurfaceCard>
          ) : null}
        </div>
      ) : null}

      {/* Who is behind all of the above. An association is named because it
          publishes something, and linked — and checked — only where its own
          reviewed page exists, so a card here can never open a 404. */}
      {associations.length > 0 ? (
        <section aria-labelledby="associations" className={washedBand}>
          <div className="py-12 md:py-14">
            <div className="max-w-2xl">
              <h2 id="associations" className={cn(bandHeading, "text-ink")}>
                {labels.associations}
              </h2>
              <p className="text-copy-muted mt-2 text-pretty leading-relaxed">
                {labels.associationsBody}
              </p>
            </div>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {associations.map((association) => (
                <SurfaceCard
                  as="li"
                  key={association.slug}
                  className={cn(
                    "relative flex h-full flex-col p-5",
                    association.href &&
                      cn(
                        "transition-all hover:-translate-y-0.5",
                        familyStyles.activity.hoverBorder,
                      ),
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        iconTile,
                        "bg-brand-soft text-brand-soft-ink font-display size-11 text-lg font-bold",
                      )}
                      aria-hidden
                    >
                      {Array.from(association.name)[0]}
                    </span>
                    {association.href ? (
                      <BadgeCheck className="text-ok size-5" aria-hidden />
                    ) : null}
                  </div>
                  <h3 className="font-display text-ink mt-4 text-balance font-bold leading-snug">
                    {association.href ? (
                      <a
                        href={association.href}
                        className={cn(cardLink, "focus-visible:outline-brand")}
                      >
                        {association.name}
                      </a>
                    ) : (
                      association.name
                    )}
                  </h3>
                  {association.focus ? (
                    <p className="text-copy-muted mt-1 flex-1 text-sm leading-relaxed">
                      {association.focus}
                    </p>
                  ) : null}
                  <p className="text-brand-deep mt-4 text-sm font-medium">
                    {activityCount(association.count)}
                  </p>
                </SurfaceCard>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* The promise that qualifies every answer above it. */}
      <section aria-labelledby="trust" className="pb-6 pt-14 md:pb-8 md:pt-16">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 id="trust" className={cn(bandHeading, "text-ink")}>
            {labels.trust}
          </h2>
          <p className="text-copy-muted mt-3 text-pretty text-lg leading-relaxed">
            {labels.trustBody}
          </p>
        </div>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {trust.map(({ Icon, title, body }) => (
            <SurfaceCard as="li" key={title} className="p-6">
              <span
                className={cn(iconTile, "bg-brand-soft text-brand-deep")}
                aria-hidden
              >
                <Icon className="size-6" />
              </span>
              <h3 className="font-display text-ink mt-4 font-bold leading-snug">
                {title}
              </h3>
              <p className="text-copy-muted mt-2 text-sm leading-relaxed">
                {body}
              </p>
            </SurfaceCard>
          ))}
        </ul>
      </section>
    </>
  );
}
