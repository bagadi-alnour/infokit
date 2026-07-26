import {
  ArrowRight,
  BookOpen,
  ListFilter,
  Route,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  ActionLink,
  Eyebrow,
  Stat,
  StatusPill,
  SurfaceCard,
} from "~/components/public/primitives";

export interface HomeLabels {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: string;
  activities: string;
  activitiesDescription: string;
  articles: string;
  articlesDescription: string;
  guide: string;
  guideDescription: string;
  reliability: string;
  reliabilityDescription: string;
  /** The word on a card's "open this" affordance. */
  published: string;
  /** Accessible name for the section-cards region. */
  sectionsLabel: string;
  /** From the public-content catalog — the four status words (§6). */
  statusOpen: string;
  statusClosed: string;
  statusUncertain: string;
  statusCancelled: string;
  lastVerified: string;
}

/**
 * The home page answers three questions in order: what is here, how fresh is
 * it, where do I go next. Nothing below the hero is decoration — each block is
 * a route into the content (docs/DESIGN-SYSTEM.md §1).
 */
export function PublicHomeExperience({
  labels,
  links,
  counts,
}: {
  labels: HomeLabels;
  links: { activities: string; articles: string; guide: string };
  counts: { activities: number; articles: number; guides: number };
}) {
  const sections: {
    key: string;
    title: string;
    description: string;
    href: string;
    count: number;
    icon: ReactNode;
  }[] = [
    {
      key: "activities",
      title: labels.activities,
      description: labels.activitiesDescription,
      href: links.activities,
      count: counts.activities,
      icon: <ListFilter className="size-5" aria-hidden />,
    },
    {
      key: "guide",
      title: labels.guide,
      description: labels.guideDescription,
      href: links.guide,
      count: counts.guides,
      icon: <Route className="size-5" aria-hidden />,
    },
    {
      key: "articles",
      title: labels.articles,
      description: labels.articlesDescription,
      href: links.articles,
      count: counts.articles,
      icon: <BookOpen className="size-5" aria-hidden />,
    },
  ];

  return (
    <div className="flex flex-col gap-12 md:gap-16">
      <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
        <div className="flex flex-col gap-5">
          <Eyebrow>{labels.eyebrow}</Eyebrow>
          <h1 className="text-ink text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl">
            {labels.title}
          </h1>
          <p className="text-copy-muted max-w-xl text-lg leading-relaxed md:text-xl">
            {labels.description}
          </p>
          <div className="mt-1 flex flex-wrap gap-3">
            <ActionLink href={links.activities} size="large">
              {labels.primaryAction}
              <ArrowRight className="size-5 rtl:rotate-180" aria-hidden />
            </ActionLink>
            <ActionLink href={links.guide} tone="outline" size="large">
              {labels.guide}
            </ActionLink>
          </div>
          <div className="border-line mt-4 grid max-w-lg grid-cols-3 gap-4 border-t pt-6">
            <Stat value={counts.activities} label={labels.activities} />
            <Stat value={counts.guides} label={labels.guide} />
            <Stat value={counts.articles} label={labels.articles} />
          </div>
        </div>

        {/* The reader learns the status vocabulary before they need it. */}
        <SurfaceCard className="shadow-lift p-6 md:p-7">
          <h2 className="font-display text-ink text-xl font-bold">
            {labels.reliability}
          </h2>
          <p className="text-copy-muted mt-3 text-[0.95rem] leading-relaxed">
            {labels.reliabilityDescription}
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            <li>
              <StatusPill status="open" label={labels.statusOpen} />
            </li>
            <li>
              <StatusPill status="closed" label={labels.statusClosed} />
            </li>
            <li>
              <StatusPill status="uncertain" label={labels.statusUncertain} />
            </li>
            <li>
              <StatusPill status="cancelled" label={labels.statusCancelled} />
            </li>
          </ul>
          <p className="border-line text-copy-muted mt-5 flex items-center gap-2 border-t pt-4 text-sm font-medium">
            <ShieldCheck className="text-ok size-4" aria-hidden />
            {labels.lastVerified}
          </p>
        </SurfaceCard>
      </section>

      <section
        aria-label={labels.sectionsLabel}
        className="flex flex-col gap-5"
      >
        <ul className="grid gap-4 md:grid-cols-3">
          {sections.map((section) => (
            <SurfaceCard
              as="li"
              key={section.key}
              className="hover:border-brand focus-within:border-brand hover:shadow-lift group relative flex flex-col gap-3 p-6 transition-shadow"
            >
              <span className="bg-brand-soft text-brand-soft-ink flex size-11 items-center justify-center rounded-full">
                {section.icon}
              </span>
              <h3 className="font-display text-ink text-lg font-bold">
                <a
                  href={section.href}
                  className="rounded-control focus-visible:outline-brand after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {section.title}
                </a>
              </h3>
              <p className="text-copy-muted flex-1 text-[0.95rem] leading-relaxed">
                {section.description}
              </p>
              <p className="text-brand-deep inline-flex items-center gap-2 text-sm font-semibold">
                {section.count} · {labels.published}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                  aria-hidden
                />
              </p>
            </SurfaceCard>
          ))}
        </ul>
      </section>
    </div>
  );
}
