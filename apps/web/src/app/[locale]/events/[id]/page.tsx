import type { PublicLocale } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { ArrowLeft, CalendarPlus, FileDown, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ContactValue, contactIcon } from "~/components/public/contact-value";
import { ListenControl } from "~/components/public/listen-control";
import { listenControlLabels } from "~/components/public/listen-control-copy";
import {
  ActionAnchor,
  ActionLink,
  Callout,
  Chip,
  EventDateBlock,
  MetaRow,
  OnlineChip,
  SurfaceCard,
  inlineLinkClass,
} from "~/components/public/primitives";
import {
  PublicPageHeader,
  PublicSiteShell,
} from "~/components/public/public-site-shell";
import { TransitLinkList } from "~/components/public/transit-links";
import { JsonLd } from "~/components/seo/json-ld";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { eventIcsHref, eventMapHref } from "~/lib/event-links";
import { publicSpeechHref } from "~/lib/public-speech";
import { presentTransitLinks } from "~/lib/transit-presentation";
import { metaDescription, publicMetadata } from "~/seo/metadata";
import { breadcrumbJsonLd, eventJsonLd } from "~/seo/structured-data";
import { findPublicCoordinationEvent } from "~/server/content/coordination-events";
import { publicEventMediaFor } from "~/server/content/event-media";
import {
  eventWhereLabel,
  formatEventRange,
  listCityViews,
} from "~/server/content/event-presentation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PublicEventPageProps {
  params: Promise<{ locale: string; id: string }>;
}

/** Shared by `generateMetadata` and the page, so describing costs no query. */
const loadEvent = cache(
  async (eventId: string, locale: PublicLocale) =>
    await findPublicCoordinationEvent({ eventId, locale }),
);

export async function generateMetadata({
  params,
}: PublicEventPageProps): Promise<Metadata> {
  const { locale: localeParam, id } = await params;
  const locale = requirePublicRouteLocale(localeParam);
  if (!UUID.test(id)) return {};
  const [event, messages] = await Promise.all([
    loadEvent(id, locale),
    loadPageCatalog(locale, "public-content"),
  ]);
  if (!event) return {};

  return publicMetadata({
    path: `/events/${id}`,
    locale,
    title: event.title,
    description: metaDescription(
      event.description,
      messages["events.description"],
    ),
  });
}

/**
 * One public event on its own page, so it can be shared as a link. Only the
 * `public` tier is readable here — an id from anywhere else simply does not
 * resolve.
 */
export default async function PublicEventPage({
  params,
}: PublicEventPageProps) {
  const { locale: localeParam, id } = await params;
  const locale = requirePublicRouteLocale(localeParam);
  const messages = await loadPageCatalog(locale, "public-content");
  // An id that cannot be a uuid is a wrong link, not a database question.
  if (!UUID.test(id)) notFound();
  const [event, cityList, media] = await Promise.all([
    loadEvent(id, locale),
    listCityViews(locale),
    publicEventMediaFor({ eventId: id, locale }),
  ]);
  if (!event) notFound();

  const city = cityList.find((candidate) => candidate.id === event.cityId);
  const range = formatEventRange(event, city, locale, {
    allDay: messages["events.allDay"],
  });
  const where = eventWhereLabel(event);
  // The same presenter the payload the app reads goes through, so one journey
  // reads identically on both surfaces.
  const transit = presentTransitLinks({
    links: event.transit,
    messages,
    locale,
  });
  const mapHref = eventMapHref(event, city?.name ?? null);
  const icsHref = eventIcsHref(event.id, locale);
  const hostHref =
    event.hostPageSlug === null
      ? null
      : localizedPath(`/organizations/${event.hostPageSlug}`, locale);

  return (
    <PublicSiteShell
      locale={locale}
      currentPath={`/events/${id}`}
      messages={messages}
      width="reading"
    >
      <JsonLd
        data={[
          eventJsonLd({
            locale,
            id,
            name: event.title,
            description: event.description,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            cancelled: event.status === "cancelled",
            hostName: event.hostName,
            placeName: where ?? city?.name,
            address: event.placeAddressLine,
            precision: event.placePrecision,
            isOnline: event.isOnline,
            onlineUrl: event.onlineUrl,
            image: media.cover?.url,
          }),
          breadcrumbJsonLd({
            locale,
            trail: [
              { name: messages["public.nav.home"], path: "/" },
              { name: messages["events.title"], path: "/events" },
              { name: event.title, path: `/events/${id}` },
            ],
          }),
        ]}
      />
      <PublicPageHeader
        eyebrow={messages["events.eyebrow"]}
        title={event.title}
        family="event"
        actions={
          <ActionLink
            href={localizedPath("/events", locale)}
            tone="quiet"
            size="compact"
          >
            <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden />
            {messages["events.back"]}
          </ActionLink>
        }
      >
        <div className="flex flex-wrap gap-2">
          {/* The same washed date block the agenda draws (§5): the family hue
           * follows the event out of the list and onto its own page, on the one
           * element there too. The date and the time were two neutral chips
           * here, which made this the one event surface where the agenda's own
           * hue went missing. */}
          <EventDateBlock
            href={icsHref}
            dateLabel={range.dateLabel}
            timeLabel={range.timeLabel}
            ariaLabel={`${messages["events.addToCalendar"]} — ${range.dateLabel} ${range.timeLabel}`}
          />
          {/* Said before the place, because an event that is only online has
           * no place to say. */}
          {event.isOnline ? (
            <OnlineChip
              label={messages["events.online"]}
              url={event.onlineUrl}
            />
          ) : null}
          {(where ?? city?.name ?? "") === "" ? null : mapHref ? (
            <a
              href={mapHref}
              target="_blank"
              rel="noreferrer"
              aria-label={`${messages["events.openMap"]} — ${where ?? city?.name ?? ""}`}
              className="rounded-chip focus-visible:outline-brand focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Chip
                icon={<MapPin className="size-4" aria-hidden />}
                className="hover:border-brand hover:text-brand-deep underline decoration-1 underline-offset-2"
              >
                {where ?? city?.name ?? ""}
              </Chip>
            </a>
          ) : (
            <Chip icon={<MapPin className="size-4" aria-hidden />}>
              {where ?? city?.name ?? ""}
            </Chip>
          )}
        </div>
      </PublicPageHeader>

      <div className="grid gap-6">
        {event.status === "cancelled" ? (
          <Callout tone="warning" title={messages["events.cancelled"]}>
            {event.cancellationReason ?? messages["events.cancelledNoReason"]}
          </Callout>
        ) : null}

        {/* The poster the organisers made says in one image what a paragraph
         * takes three sentences to say — and it survives being photographed off
         * a screen and shown to someone else. */}
        {media.cover ? (
          <figure className="m-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed remote media, no known intrinsic size */}
            <img
              src={media.cover.url}
              alt={media.cover.decorative ? "" : media.cover.alt}
              aria-hidden={media.cover.decorative || undefined}
              className="bg-subtle rounded-card border-line w-full border object-cover"
              loading="lazy"
            />
          </figure>
        ) : null}

        {event.description ? (
          <p className="text-ink whitespace-pre-line text-[1.0625rem] leading-relaxed">
            {event.description}
          </p>
        ) : null}

        <SurfaceCard className="p-5 md:p-6">
          <dl className="grid gap-3">
            <MetaRow label={messages["events.when"]}>
              {range.dateLabel} · {range.timeLabel}
            </MetaRow>
            {/* An online event answers "where" with a link, or with the
             * promise of one: "not available" would read as a missing answer
             * rather than as the answer. */}
            {event.isOnline ? (
              <MetaRow label={messages["events.onlineJoin"]}>
                {event.onlineUrl === null ? (
                  messages["events.onlineNoLink"]
                ) : (
                  <a
                    href={event.onlineUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={inlineLinkClass}
                  >
                    {event.onlineUrl}
                  </a>
                )}
              </MetaRow>
            ) : null}
            {where === null && event.isOnline ? null : (
              <MetaRow label={messages["events.where"]}>
                {where ?? messages["public.notAvailable"]}
              </MetaRow>
            )}
            {city === undefined && event.isOnline ? null : (
              <MetaRow label={messages["events.city"]}>
                {city?.name ?? messages["public.notAvailable"]}
              </MetaRow>
            )}
            {/* After the place and before who is running it: a reader who has
             * just read an address they do not recognise asks this next, and the
             * organisers are the only ones who can answer it. The row is absent
             * rather than empty when nobody has — an unanswered question is
             * better left unasked than answered "not available". */}
            {transit.length > 0 ? (
              <MetaRow label={messages["transit.gettingHere"]}>
                <TransitLinkList links={transit} />
              </MetaRow>
            ) : null}
            <MetaRow label={messages["events.host"]}>
              {/* "Organised by" is a question about the organisation as much as
               * the event: its page holds the rest of the answer. */}
              {event.hostName === null ? (
                messages["public.platform"]
              ) : hostHref ? (
                <Link href={hostHref} className={inlineLinkClass}>
                  {event.hostName}
                </Link>
              ) : (
                event.hostName
              )}
            </MetaRow>
            {event.contactValue ? (
              <MetaRow
                label={messages["events.contact"]}
                icon={contactIcon(event.contactValue)}
              >
                <ContactValue
                  label={event.contactLabel}
                  value={event.contactValue}
                />
              </MetaRow>
            ) : null}
          </dl>
        </SurfaceCard>

        {/* The date chip above is the same file; this is the version someone
         * reading to the end can still act on without scrolling back. A flyer
         * sits beside it because the person who prints one is announcing the
         * event to people this page will never reach. */}
        <div className="flex flex-wrap gap-2">
          <ActionAnchor href={icsHref} tone="solid">
            <CalendarPlus className="size-5" aria-hidden />
            {messages["events.addToCalendar"]}
          </ActionAnchor>
          {media.flyers.map((flyer) => (
            <ActionAnchor
              key={flyer.assetId}
              href={flyer.url}
              tone="outline"
              download
            >
              <FileDown className="size-5" aria-hidden />
              {flyer.title || messages["events.flyer"]}
            </ActionAnchor>
          ))}
        </div>

        {/* Times move; the person travelling is the one who pays for it. */}
        <Callout tone="info" role="note">
          {messages["events.checkBefore"]}
        </Callout>

        <ListenControl
          src={publicSpeechHref({
            kind: "event",
            id,
            locale,
          })}
          labels={listenControlLabels(messages)}
        />
      </div>
    </PublicSiteShell>
  );
}
