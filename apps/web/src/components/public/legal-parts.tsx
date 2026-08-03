import { formatMessage, type PublicLocale } from "@infokit/shared/i18n";
import type { ReactNode } from "react";

import {
  MetaRow,
  SurfaceCard,
  inlineLinkClass,
} from "~/components/public/primitives";
import { contactLink } from "~/lib/contact-link";
import {
  legalLastUpdated,
  legalPublisher,
  technicalProviders,
  type LegalPublisher,
} from "~/lib/legal-entity";

/**
 * The pieces the legal notice and the privacy policy both need.
 *
 * The two pages answer different questions — who publishes this, and what
 * happens to what you leave behind — but they name the same publisher, stamp the
 * same date and read the same provider table, so those three things are built
 * once here. A fact recorded in `legal-entity.ts` therefore appears identically
 * on both pages, and a fact still to be settled is missing from both in the same
 * words rather than being filled in on one of them.
 *
 * The pages keep the calm of every other public page: the same `SurfaceCard`
 * sections and the same metadata rows the content surfaces use
 * (docs/DESIGN-SYSTEM.md §5). A legal page is still read under stress, and
 * often by the person deciding whether this site can be trusted at all.
 */

/** "Last updated: 3 August 2026", in the reader's own calendar and language. */
export function legalUpdatedLabel(
  messages: Record<string, string>,
  locale: PublicLocale,
): string {
  // Midday UTC, so the stamped day is the same day in Europe/Paris — the wall
  // clock every public date on this site is read in — whatever the offset.
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(`${legalLastUpdated}T12:00:00Z`));
  return formatMessage(messages["legal.updated"] ?? "", { date });
}

/** Title, paragraph, the short facts under it, and anything the page adds. */
export function LegalSection({
  title,
  body,
  points = [],
  children,
}: {
  title: string;
  body: string;
  points?: string[];
  children?: ReactNode;
}) {
  return (
    <SurfaceCard as="section" className="flex flex-col gap-3 p-5 md:p-6">
      <h2 className="text-ink text-xl font-bold tracking-tight">{title}</h2>
      <p className="text-copy-muted leading-relaxed">{body}</p>
      {points.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-2">
          {points.map((point) => (
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
      {children}
    </SurfaceCard>
  );
}

/** The `dl` the rows below expect around them. */
export function LegalRows({ children }: { children: ReactNode }) {
  return <dl className="mt-1 flex flex-col gap-3">{children}</dl>;
}

/**
 * One fact about the publisher, or the sentence that says it is not settled yet.
 *
 * An unfilled row is shown rather than hidden: a reader looking for the
 * publisher's address learns that it is coming, and whoever has to finish the
 * page sees exactly which rows are still open — a silently dropped row reads as
 * a page with nothing missing.
 */
export function LegalFact({
  label,
  value,
  pending,
  linkify = false,
}: {
  label: string;
  value: string | null;
  pending: string;
  /** Email and phone rows become tappable; a name or an address does not. */
  linkify?: boolean;
}) {
  if (!value) {
    return (
      <MetaRow label={label}>
        <span className="text-copy-muted">{pending}</span>
      </MetaRow>
    );
  }
  const link = linkify ? contactLink(value) : { kind: "text" as const };
  return (
    <MetaRow label={label}>
      {link.href ? (
        <a href={link.href} className={inlineLinkClass}>
          {value}
        </a>
      ) : (
        value
      )}
    </MetaRow>
  );
}

/** Every row of the publisher's identity, in the order a notice states them. */
export function PublisherFacts({
  messages,
  publisher = legalPublisher,
}: {
  messages: Record<string, string>;
  publisher?: LegalPublisher;
}) {
  const pending = messages["legal.pending"] ?? "";
  return (
    <LegalRows>
      <LegalFact
        label={messages["legal.notice.publisher.name"] ?? ""}
        value={publisher.name}
        pending={pending}
      />
      <LegalFact
        label={messages["legal.notice.publisher.legalForm"] ?? ""}
        value={publisher.legalForm}
        pending={pending}
      />
      <LegalFact
        label={messages["legal.notice.publisher.registration"] ?? ""}
        value={publisher.registration}
        pending={pending}
      />
      <LegalFact
        label={messages["legal.notice.publisher.address"] ?? ""}
        value={publisher.address}
        pending={pending}
      />
      <LegalFact
        label={messages["legal.notice.publisher.email"] ?? ""}
        value={publisher.email}
        pending={pending}
        linkify
      />
      <LegalFact
        label={messages["legal.notice.publisher.phone"] ?? ""}
        value={publisher.phone}
        pending={pending}
        linkify
      />
      <LegalFact
        label={messages["legal.notice.publisher.director"] ?? ""}
        value={publisher.publicationDirector}
        pending={pending}
      />
    </LegalRows>
  );
}

/**
 * Who runs which part of the service, and where the data sits.
 *
 * The role is the label and the company is the value, because the question a
 * reader arrives with is "who has my request", not "what does Amazon do here".
 * A provider whose region this deployment does not pin says nothing about it
 * rather than guessing at a country.
 */
export function ProviderFacts({
  messages,
}: {
  messages: Record<string, string>;
}) {
  return (
    <LegalRows>
      {technicalProviders.map((provider) => {
        const region = provider.region
          ? messages[`legal.region.${provider.region}`]
          : null;
        return (
          <MetaRow
            key={`${provider.role}-${provider.name}`}
            label={messages[`legal.role.${provider.role}`] ?? provider.role}
          >
            {provider.name}
            {region ? (
              <span className="text-copy-muted"> · {region}</span>
            ) : null}
          </MetaRow>
        );
      })}
    </LegalRows>
  );
}
