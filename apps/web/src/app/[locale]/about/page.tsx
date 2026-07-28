import { aboutStrings, type AboutSection } from "@infokit/shared/about";
import {
  localeMetadata,
  publicSupportedLocales,
  type PublicLocale,
} from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { PublicActivityStatus } from "@infokit/shared/public-content";
import type { Metadata } from "next";
import Link from "next/link";

import {
  PublicPageHeader,
  PublicSiteShell,
} from "~/components/public/public-site-shell";
import {
  ActionLink,
  StatusPill,
  SurfaceCard,
  statusWord,
} from "~/components/public/primitives";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { publicMetadata } from "~/seo/metadata";

/**
 * "Can I trust this" is asked in the reader's own language, so the title and
 * description come from the eleven-language About table rather than the
 * interface catalogue, which only fr/en/ar translate in full.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = requirePublicRouteLocale((await params).locale);
  const about = aboutStrings(locale);
  return publicMetadata({
    path: "/about",
    locale,
    title: about.title,
    description: about.tagline,
  });
}

/** The ramp in the order it is taught, not alphabetical: best case downwards. */
const statusOrder: PublicActivityStatus[] = [
  "open",
  "closed",
  "uncertain",
  "cancelled",
];

/**
 * What InfoKit is, who writes what it shows, and what it does not ask for.
 *
 * The same table as the app's About sheet (`@infokit/shared/about`), so the
 * answer to "can I trust this" is worded identically wherever it is read
 * (docs/UI-ARCHITECTURE.md §1). Two sections quote the site instead of
 * describing it — the four status words appear as real pills and the eleven
 * languages as their own names — because this is also where a reader comes to
 * check what a pill on some other page meant.
 */
export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requirePublicRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "public-content");
  const about = aboutStrings(locale);
  // The site's own status vocabulary, not a second translation of it.
  const statusLabels = {
    statusOpen: messages["activities.status.open"],
    statusClosed: messages["activities.status.closed"],
    statusUncertain: messages["activities.status.uncertain"],
    statusCancelled: messages["activities.status.cancelled"],
  };

  return (
    <PublicSiteShell
      locale={locale}
      currentPath="/about"
      messages={messages}
      width="reading"
    >
      <PublicPageHeader
        eyebrow={messages["public.platform"]}
        title={about.title}
        description={about.tagline}
      />

      <div className="flex flex-col gap-6">
        <p className="text-ink max-w-2xl text-lg leading-relaxed">
          {about.intro}
        </p>

        <Section section={about.what} />
        <Section section={about.source} />
        <Section section={about.freshness} />

        {/* The four words as they actually appear, glyph and colour included:
            the shortest way to explain a pill is to show the pill. */}
        <SurfaceCard as="section" className="flex flex-col gap-4 p-5 md:p-6">
          <SectionHeading>{about.statuses.title}</SectionHeading>
          <p className="text-copy-muted leading-relaxed">
            {about.statuses.body}
          </p>
          <dl className="flex flex-col gap-4">
            {statusOrder.map((status) => (
              <div key={status} className="flex flex-col gap-1.5">
                <dt>
                  <StatusPill
                    status={status}
                    label={statusWord(status, statusLabels)}
                  />
                </dt>
                <dd className="text-copy-muted leading-relaxed">
                  {about.statuses.meanings[status]}
                </dd>
              </div>
            ))}
          </dl>
        </SurfaceCard>

        {/* Each language in its own script and its own name, and each one a link
            to this page in that language — the one list here that needs no
            translating, and the one a reader can use without reading the rest. */}
        <SurfaceCard as="section" className="flex flex-col gap-4 p-5 md:p-6">
          <SectionHeading>{about.languages.title}</SectionHeading>
          <p className="text-copy-muted leading-relaxed">
            {about.languages.body}
          </p>
          <ul className="flex flex-wrap gap-2">
            {publicSupportedLocales.map((code: PublicLocale) => (
              <li key={code}>
                <Link
                  href={localizedPath("/about", code)}
                  hrefLang={code}
                  lang={code}
                  dir={localeMetadata[code].direction}
                  aria-current={code === locale ? "page" : undefined}
                  className={
                    code === locale
                      ? "bg-brand-soft text-brand-soft-ink rounded-chip border-brand-soft focus-visible:outline-brand inline-flex min-h-11 items-center border px-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                      : "bg-subtle border-line text-ink hover:border-brand hover:text-brand-deep rounded-chip focus-visible:outline-brand inline-flex min-h-11 items-center border px-3 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                  }
                >
                  {localeMetadata[code].label}
                </Link>
              </li>
            ))}
          </ul>
        </SurfaceCard>

        {/* The paragraph only: the four things never asked for are listed where
            they are promised — the app's welcome — and a second wording of a
            promise is a promise a reader can doubt (docs/DESIGN-SYSTEM.md §6). */}
        <Section section={about.privacy} />
        <Section section={about.security} />
        <Section section={about.cities} />
        <Section section={about.collaboration} />
        <Section section={about.associations} />

        <div className="flex flex-wrap gap-3">
          <ActionLink
            href={localizedPath("/activities", locale)}
            tone="outline"
          >
            {messages["public.nav.activities"]}
          </ActionLink>
          <ActionLink href={localizedPath("/simulator", locale)} tone="quiet">
            {messages["public.nav.guide"]}
          </ActionLink>
        </div>
      </div>
    </PublicSiteShell>
  );
}

/** Title, paragraph, and the short facts under it — the shape of every section. */
function Section({ section }: { section: AboutSection }) {
  return (
    <SurfaceCard as="section" className="flex flex-col gap-3 p-5 md:p-6">
      <SectionHeading>{section.title}</SectionHeading>
      <p className="text-copy-muted leading-relaxed">{section.body}</p>
      {section.points.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-2">
          {section.points.map((point) => (
            <li key={point} className="flex gap-2.5">
              <span className="text-brand-deep font-semibold" aria-hidden>
                ·
              </span>
              <span className="text-ink min-w-0 flex-1 leading-relaxed">
                {point}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </SurfaceCard>
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="text-ink text-xl font-bold tracking-tight">{children}</h2>
  );
}
