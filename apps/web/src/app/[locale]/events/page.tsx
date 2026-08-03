import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { CalendarDays, List } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EventsCalendar } from "~/components/events/month-calendar";
import type { EventCalendarItem } from "~/components/events/month-calendar";
import {
  PublicEventList,
  type PublicEventCard,
} from "~/components/public/public-event-list";
import {
  PublicPageHeader,
  PublicSiteShell,
} from "~/components/public/public-site-shell";
import {
  Callout,
  SurfaceCard,
  inlineLinkClass,
} from "~/components/public/primitives";
import { requirePublicRouteLocale } from "~/i18n/route-locale";
import { JsonLd } from "~/components/seo/json-ld";
import { localizedPath } from "~/i18n/routing";
import { publicMetadata } from "~/seo/metadata";
import { eventJsonLd } from "~/seo/structured-data";
import { cn } from "~/lib/utils";
import {
  listPastPublicCoordinationEvents,
  listPublicCoordinationEvents,
  type CoordinationEventRecord,
} from "~/server/content/coordination-events";
import { publicEventMedia } from "~/server/content/event-media";
import {
  cityToday,
  eventCity,
  eventDetailView,
  eventWhereLabel,
  formatEventRange,
  listCityViews,
  FALLBACK_TIME_ZONE,
  type CityView,
} from "~/server/content/event-presentation";
import { eventIcsHref, eventMapHref } from "~/lib/event-links";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = requirePublicRouteLocale((await params).locale);
  const messages = await loadPageCatalog(locale, "public-content");
  return publicMetadata({
    path: "/events",
    locale,
    title: messages["events.title"],
    description: messages["events.description"],
  });
}

/**
 * The public agenda: only events an organisation deliberately opened to
 * everyone. Two shapes of the same thing — a list to read top to bottom, and a
 * month to see what a week looks like — chosen by a URL parameter so either can
 * be shared or printed.
 */
export default async function PublicEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const locale = requirePublicRouteLocale((await params).locale);
  const { view } = await searchParams;
  const calendarView = view === "calendar";
  const now = new Date();
  const [messages, upcoming, past, cityList] = await Promise.all([
    loadPageCatalog(locale, "public-content"),
    listPublicCoordinationEvents({ locale, from: now }),
    listPastPublicCoordinationEvents({ locale, before: now }),
    listCityViews(locale),
  ]);
  const media = await publicEventMedia({
    eventIds: [...upcoming, ...past].map((event) => event.id),
    locale,
  });

  const cityById = new Map(cityList.map((city) => [city.id, city]));
  const labels = { allDay: messages["events.allDay"] };
  const toCard = (event: CoordinationEventRecord): PublicEventCard => {
    const city: CityView | undefined = eventCity(cityById, event);
    const range = formatEventRange(event, city, locale, labels);
    return {
      id: event.id,
      href: localizedPath(`/events/${event.id}`, locale),
      title: event.title,
      description: event.description,
      dateLabel: range.dateLabel,
      timeLabel: range.timeLabel,
      whereLabel: eventWhereLabel(event),
      mapHref: eventMapHref(event, city?.name ?? null),
      cityName: city?.name ?? "",
      isOnline: event.isOnline,
      onlineUrl: event.onlineUrl,
      hostName: event.hostName,
      hostHref:
        event.hostPageSlug === null
          ? null
          : localizedPath(`/organizations/${event.hostPageSlug}`, locale),
      contactLabel: event.contactLabel,
      contactValue: event.contactValue,
      cancelled: event.status === "cancelled",
      cancellationReason: event.cancellationReason,
      icsHref: eventIcsHref(event.id, locale),
      coverImage: media.get(event.id)?.cover ?? null,
    };
  };
  // The month shows what happened as well as what is coming: an empty grid for
  // last month would look like nothing ever happens here.
  const calendarItems: EventCalendarItem[] = [...upcoming, ...past].map(
    (event) => {
      const city = eventCity(cityById, event);
      const range = formatEventRange(event, city, locale, labels);
      const href = localizedPath(`/events/${event.id}`, locale);
      return {
        id: event.id,
        href,
        title: event.title,
        hostName: event.hostName,
        cancelled: event.status === "cancelled",
        allDay: event.allDay,
        startKey: range.startKey,
        endKey: range.endKey,
        timeLabel: range.chipTime,
        detail: eventDetailView({ event, city, locale, labels, href }),
      };
    },
  );
  const { todayKey, month } = cityToday(
    cityList[0]?.timezone ?? FALLBACK_TIME_ZONE,
    now,
  );

  const listLabels = {
    empty: messages["events.empty"],
    details: messages["events.details"],
    online: messages["events.online"],
    host: messages["events.host"],
    platform: messages["public.platform"],
    contact: messages["events.contact"],
    cancelled: messages["events.cancelled"],
    cancelledNoReason: messages["events.cancelledNoReason"],
    addToCalendar: messages["events.addToCalendar"],
    openMap: messages["events.openMap"],
  };

  const previewLabels = {
    where: messages["events.where"],
    city: messages["events.city"],
    online: messages["events.online"],
    host: messages["events.host"],
    platform: messages["public.platform"],
    contact: messages["events.contact"],
    // Every event on this page is public: reach is not a distinction here.
    reach: "",
    cancelled: messages["events.cancelled"],
    cancelledNoReason: messages["events.cancelledNoReason"],
    addToCalendar: messages["events.addToCalendar"],
    openMap: messages["events.openMap"],
    notAvailable: messages["public.notAvailable"],
  };

  const viewHref = (target: "list" | "calendar") =>
    `${localizedPath("/events", locale)}?view=${target}`;

  return (
    <PublicSiteShell locale={locale} currentPath="/events" messages={messages}>
      {/* Each upcoming event as its own node rather than one list: this is the
       * shape that becomes an event result, and a past event has nothing left
       * to announce. */}
      <JsonLd
        data={upcoming.map((event) =>
          eventJsonLd({
            locale,
            id: event.id,
            name: event.title,
            description: event.description,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            cancelled: event.status === "cancelled",
            hostName: event.hostName,
            placeName:
              eventWhereLabel(event) ?? eventCity(cityById, event)?.name,
            address: event.placeAddressLine,
            precision: event.placePrecision,
            isOnline: event.isOnline,
            onlineUrl: event.onlineUrl,
            image: media.get(event.id)?.cover?.url,
          }),
        )}
      />
      <PublicPageHeader
        eyebrow={messages["events.eyebrow"]}
        title={messages["events.title"]}
        description={messages["events.description"]}
        family="event"
      >
        {/* Both views are plain links: they work with JavaScript off and can be
         * bookmarked, which matters on a shared or borrowed phone. */}
        <div
          role="group"
          aria-label={messages["events.view"]}
          className="border-line bg-subtle rounded-control inline-flex items-center gap-1 border p-1"
        >
          {(
            [
              { key: "list", href: viewHref("list"), icon: List },
              {
                key: "calendar",
                href: viewHref("calendar"),
                icon: CalendarDays,
              },
            ] as const
          ).map((option) => {
            const active =
              option.key === "calendar" ? calendarView : !calendarView;
            const Glyph = option.icon;
            return (
              <Link
                key={option.key}
                href={option.href}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "rounded-control focus-visible:outline-brand inline-flex min-h-12 items-center gap-2 px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2",
                  active
                    ? "bg-surface text-ink shadow-ring"
                    : "text-copy-muted hover:text-ink",
                )}
              >
                <Glyph className="size-5" aria-hidden />
                {messages[`events.view.${option.key}`]}
              </Link>
            );
          })}
        </div>
      </PublicPageHeader>

      {/* An agenda and a service list look alike at a glance, and mistaking one
       * for the other wastes a journey: this says which is which, in both
       * views, and points to the other one. */}
      <Callout tone="info" role="note" className="mb-6">
        {messages["events.occasional"]}{" "}
        <Link
          href={localizedPath("/activities", locale)}
          className={inlineLinkClass}
        >
          {messages["events.occasional.link"]}
        </Link>
      </Callout>

      {calendarView ? (
        <SurfaceCard className="p-4 md:p-6">
          <EventsCalendar
            items={calendarItems}
            initialMonth={month}
            todayKey={todayKey}
            locale={locale}
            labels={{
              previousMonth: messages["events.calendar.previousMonth"],
              nextMonth: messages["events.calendar.nextMonth"],
              today: messages["events.calendar.today"],
              empty: messages["events.empty"],
              more: messages["events.calendar.more"],
              hostPlatform: messages["public.platform"],
              cancelled: messages["events.cancelled"],
              preview: previewLabels,
            }}
          />
        </SurfaceCard>
      ) : (
        <div className="grid gap-10">
          <section className="grid gap-4">
            <h2 className="text-ink text-2xl font-bold tracking-tight">
              {messages["events.upcoming"]}
            </h2>
            <PublicEventList
              events={upcoming.map(toCard)}
              labels={listLabels}
            />
          </section>
          {past.length > 0 ? (
            <section className="grid gap-4">
              <h2 className="text-ink text-2xl font-bold tracking-tight">
                {messages["events.past"]}
              </h2>
              <PublicEventList
                events={past.map(toCard)}
                labels={{ ...listLabels, empty: messages["events.emptyPast"] }}
              />
            </section>
          ) : null}
        </div>
      )}
    </PublicSiteShell>
  );
}
