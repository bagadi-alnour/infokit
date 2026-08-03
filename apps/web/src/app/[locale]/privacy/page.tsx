import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import type { Metadata } from "next";

import {
  LegalFact,
  LegalRows,
  LegalSection,
  legalUpdatedLabel,
} from "~/components/public/legal-parts";
import { ActionLink, Callout } from "~/components/public/primitives";
import {
  PublicPageHeader,
  PublicSiteShell,
} from "~/components/public/public-site-shell";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { dataProtectionContact } from "~/lib/legal-entity";
import { publicMetadata } from "~/seo/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = requirePublicRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "legal");
  return publicMetadata({
    path: "/privacy",
    locale,
    title: messages["legal.privacy.title"],
    description: messages["legal.privacy.description"],
  });
}

/**
 * What the service records, what it does not, and how to ask about it.
 *
 * Ordered by who is reading. The answer that matters to almost everyone comes
 * first and in one line — reading this site needs no account, no name and no
 * phone number — then the handful of places where anything at all leaves the
 * page: the hosting logs, the map tiles the browser fetches, the narration, the
 * guides that keep nothing. The organisations' own accounts come last, because
 * they are the only part of the platform that processes personal data on an
 * ongoing basis and the part a reader is not in.
 *
 * Every duration and every provider named here is read off the code that
 * implements it — the session and trusted-device lifetimes in
 * `server/auth`, the tile sources in `map-tiles.ts`, the regions in
 * `~/lib/legal-entity` — so this page can be checked rather than believed.
 */
export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requirePublicRouteLocale((await params).locale);
  const [messages, navigationMessages] = await Promise.all([
    loadPageCatalog(locale, "legal"),
    loadPageCatalog(locale, "public-content"),
  ]);
  const contact = dataProtectionContact();

  return (
    <PublicSiteShell
      locale={locale}
      currentPath="/privacy"
      messages={navigationMessages}
      width="reading"
    >
      <PublicPageHeader
        eyebrow={messages["legal.eyebrow"]}
        title={messages["legal.privacy.title"]}
        description={messages["legal.privacy.description"]}
      />

      <div className="flex flex-col gap-6">
        <p className="text-copy-muted text-[0.95rem]">
          {legalUpdatedLabel(messages, locale)}
        </p>

        {/* The whole page in one line, for the reader who stops here. */}
        <Callout role="note" title={messages["legal.privacy.summary"]}>
          {messages["legal.privacy.summaryBody"]}
        </Callout>

        <LegalSection
          title={messages["legal.privacy.reader.title"]}
          body={messages["legal.privacy.reader.body"]}
          points={[
            messages["legal.privacy.reader.point1"],
            messages["legal.privacy.reader.point2"],
            messages["legal.privacy.reader.point3"],
            messages["legal.privacy.reader.point4"],
          ]}
        />

        <LegalSection
          title={messages["legal.privacy.controller.title"]}
          body={messages["legal.privacy.controller.body"]}
        >
          <LegalRows>
            <LegalFact
              label={messages["legal.privacy.controller.contact"]}
              value={contact}
              pending={messages["legal.pending"]}
              linkify
            />
          </LegalRows>
          <div className="mt-1 flex flex-wrap gap-3">
            <ActionLink
              href={localizedPath("/legal", locale)}
              tone="outline"
              size="compact"
            >
              {navigationMessages["public.footer.legal"]}
            </ActionLink>
          </div>
        </LegalSection>

        <LegalSection
          title={messages["legal.privacy.maps.title"]}
          body={messages["legal.privacy.maps.body"]}
        />

        <LegalSection
          title={messages["legal.privacy.speech.title"]}
          body={messages["legal.privacy.speech.body"]}
        />

        <LegalSection
          title={messages["legal.privacy.guides.title"]}
          body={messages["legal.privacy.guides.body"]}
        />

        <LegalSection
          title={messages["legal.privacy.members.title"]}
          body={messages["legal.privacy.members.body"]}
          points={[
            messages["legal.privacy.members.point1"],
            messages["legal.privacy.members.point2"],
            messages["legal.privacy.members.point3"],
          ]}
        />

        <LegalSection
          title={messages["legal.privacy.basis.title"]}
          body={messages["legal.privacy.basis.body"]}
        />

        <LegalSection
          title={messages["legal.privacy.retention.title"]}
          body={messages["legal.privacy.retention.body"]}
          points={[
            messages["legal.privacy.retention.point1"],
            messages["legal.privacy.retention.point2"],
            messages["legal.privacy.retention.point3"],
            messages["legal.privacy.retention.point4"],
            messages["legal.privacy.retention.point5"],
          ]}
        />

        <LegalSection
          title={messages["legal.privacy.providers.title"]}
          body={messages["legal.privacy.providers.body"]}
        />

        <LegalSection
          title={messages["legal.privacy.cookies.title"]}
          body={messages["legal.privacy.cookies.body"]}
        />

        <LegalSection
          title={messages["legal.privacy.rights.title"]}
          body={messages["legal.privacy.rights.body"]}
        >
          {/* The supervisory authority, kept out of the paragraph above: a
              reader who is unhappy with an answer should not have to find this
              sentence inside a longer one. */}
          <Callout role="note" className="mt-1">
            {messages["legal.privacy.rights.complaint"]}
          </Callout>
        </LegalSection>

        <LegalSection
          title={messages["legal.privacy.security.title"]}
          body={messages["legal.privacy.security.body"]}
        />

        <LegalSection
          title={messages["legal.privacy.changes.title"]}
          body={messages["legal.privacy.changes.body"]}
        />
      </div>
    </PublicSiteShell>
  );
}
