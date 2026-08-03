import { aboutStrings } from "@infokit/shared/about";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";

import {
  LegalSection,
  ProviderFacts,
  PublisherFacts,
  legalUpdatedLabel,
} from "~/components/public/legal-parts";
import { ActionLink, Callout } from "~/components/public/primitives";
import {
  PublicPageHeader,
  PublicSiteShell,
} from "~/components/public/public-site-shell";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { legalPublisher } from "~/lib/legal-entity";
import { publicMetadata } from "~/seo/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = requirePublicRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "legal");
  return publicMetadata({
    path: "/legal",
    locale,
    title: messages["legal.notice.title"],
    description: messages["legal.notice.description"],
  });
}

/**
 * Who publishes InfoKit, who is not behind it, and who answers for what it says.
 *
 * The notice French law asks a public site for, written to be read rather than
 * skipped: what this service is and is not affiliated with comes first, because
 * that is the part a reader — or an association deciding whether to publish
 * here, or anyone checking what the platform claims — actually needs. Those
 * opening words are the About page's own `independence` section, translated in
 * all eleven languages, so the claim is worded once wherever it is read
 * (docs/UI-ARCHITECTURE.md §1).
 *
 * The identity facts come from `~/lib/legal-entity`, not from this file: a row
 * nobody has settled yet says so instead of showing a plausible address.
 */
export default async function LegalNoticePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requirePublicRouteLocale((await params).locale);
  const [messages, navigationMessages] = await Promise.all([
    loadPageCatalog(locale, "legal"),
    loadPageCatalog(locale, "public-content"),
  ]);
  const about = aboutStrings(locale);
  const identityIncomplete = [
    legalPublisher.name,
    legalPublisher.address,
    legalPublisher.email,
  ].some((fact) => !fact);

  return (
    <PublicSiteShell
      locale={locale}
      currentPath="/legal"
      messages={navigationMessages}
      width="reading"
    >
      <PublicPageHeader
        eyebrow={messages["legal.eyebrow"]}
        title={messages["legal.notice.title"]}
        description={messages["legal.notice.description"]}
      />

      <div className="flex flex-col gap-6">
        <p className="text-copy-muted text-[0.95rem]">
          {legalUpdatedLabel(messages, locale)}
        </p>

        {/* The same words as the About page's opening section: what this service
            is, and what it is not affiliated with. */}
        <LegalSection
          title={about.independence.title}
          body={about.independence.body}
        />

        <LegalSection
          title={messages["legal.notice.publisher.title"]}
          body={messages["legal.notice.publisher.body"]}
        >
          <PublisherFacts messages={messages} />
          {/* Shown only while a row is still open, and worded for the reader
              rather than for whoever has to finish the page. */}
          {identityIncomplete ? (
            <Callout role="note" className="mt-2">
              {messages["legal.pendingNote"]}
            </Callout>
          ) : null}
        </LegalSection>

        <LegalSection
          title={messages["legal.notice.hosting.title"]}
          body={messages["legal.notice.hosting.body"]}
        >
          <ProviderFacts messages={messages} />
        </LegalSection>

        <LegalSection
          title={messages["legal.notice.content.title"]}
          body={messages["legal.notice.content.body"]}
          points={[
            messages["legal.notice.content.point1"],
            messages["legal.notice.content.point2"],
            messages["legal.notice.content.point3"],
            messages["legal.notice.content.point4"],
          ]}
        />

        <LegalSection
          title={messages["legal.notice.report.title"]}
          body={messages["legal.notice.report.body"]}
        />

        <LegalSection
          title={messages["legal.notice.property.title"]}
          body={messages["legal.notice.property.body"]}
        />

        <LegalSection
          title={messages["legal.notice.data.title"]}
          body={messages["legal.notice.data.body"]}
        >
          <div className="mt-1 flex flex-wrap gap-3">
            <ActionLink
              href={localizedPath("/privacy", locale)}
              tone="outline"
              size="compact"
            >
              {navigationMessages["public.footer.privacy"]}
            </ActionLink>
          </div>
        </LegalSection>

        <div className="flex flex-wrap gap-3">
          <ActionLink href={localizedPath("/about", locale)} tone="quiet">
            {about.title}
          </ActionLink>
        </div>
      </div>
    </PublicSiteShell>
  );
}
