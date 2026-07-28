import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { CalendarDays, List, Plus } from "lucide-react";
import Link from "next/link";

import {
  EventsTable,
  type EventsTableLabels,
} from "~/components/events/events-table";
import {
  EventsCalendar,
  type EventsCalendarLabels,
} from "~/components/events/month-calendar";
import type { EventVisibilityValue } from "~/components/events/visibility";
import {
  Card,
  EmptyState,
  PageHeader,
  Stat,
  StatGrid,
  WorkspacePage,
} from "~/components/admin/workspace";
import { Button } from "~/components/ui/button";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { requireEditor } from "~/server/auth/require";
import {
  canManageCoordinationEvents,
  coordinationViewer,
  listCoordinationEvents,
} from "~/server/content/coordination-events";
import { cn } from "~/lib/utils";

import {
  cityToday,
  listCityViews,
  toCalendarItems,
  toTableRows,
} from "./presenters";

/**
 * The shared agenda, in the two shapes an editor needs: a list to search and
 * filter, and a month to see the shape of the weeks ahead. The view is a URL
 * parameter, so either one is a link a team can share.
 */
export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const { view } = await searchParams;
  const calendarView = view === "calendar";
  const t = await loadPageCatalog(locale, "dashboard-events");
  const user = await requireEditor(locale);
  const viewer = await coordinationViewer(user.id);
  // Archived events travel with the list so they can be found and restored;
  // the table hides them until asked, and the calendar never shows them.
  const [events, cityList, canManage] = await Promise.all([
    listCoordinationEvents({ viewer, locale, includeArchived: true }),
    listCityViews(locale),
    canManageCoordinationEvents(user.id),
  ]);

  const cityById = new Map(cityList.map((city) => [city.id, city]));
  const labels = { allDay: t["events.allDayShort"] };
  const now = new Date();
  const visibilityLabels: Record<EventVisibilityValue, string> = {
    organization: t["events.visibility.organization"],
    inter_organization: t["events.visibility.inter_organization"],
    public: t["events.visibility.public"],
  };

  const live = events.filter((event) => event.archivedAt === null);
  const rows = toTableRows({ events, cityById, locale, labels });
  const items = toCalendarItems({
    events: live,
    cityById,
    locale,
    labels,
    visibilityLabels,
  });
  const { todayKey, month } = cityToday(
    cityList[0]?.timezone ?? "Europe/Paris",
    now,
  );

  const upcoming = live.filter((event) => event.endsAt >= now);
  const publicCount = upcoming.filter(
    (event) => event.visibility === "public",
  ).length;
  const cancelledCount = upcoming.filter(
    (event) => event.status === "cancelled",
  ).length;

  const tableLabels: EventsTableLabels = {
    search: t["events.table.search"],
    searchPlaceholder: t["events.table.searchPlaceholder"],
    columns: t["events.table.columns"],
    clear: t["events.table.clear"],
    filterBy: t["events.table.filterBy"],
    noMatch: t["events.table.noMatch"],
    rowsPerPage: t["events.table.rowsPerPage"],
    results: t["events.table.results"],
    page: t["events.table.page"],
    previous: t["events.table.previous"],
    next: t["events.table.next"],
    event: t["events.column.event"],
    when: t["events.column.when"],
    where: t["events.column.where"],
    by: t["events.column.by"],
    host: t["events.column.host"],
    reach: t["events.column.reach"],
    createdBy: t["events.column.createdBy"],
    hostPlatform: t["events.hostPlatform"],
    cancelled: t["events.cancelled"],
    archived: t["events.archived"],
    upcoming: t["events.filter.upcoming"],
    past: t["events.filter.past"],
    state: t["events.filter.state"],
    active: t["events.filter.active"],
    anyState: t["events.filter.anyState"],
    visibilityLabels,
  };

  const calendarLabels: EventsCalendarLabels = {
    previousMonth: t["events.calendar.previousMonth"],
    nextMonth: t["events.calendar.nextMonth"],
    today: t["events.calendar.today"],
    empty: t["events.empty"],
    more: t["events.calendar.more"],
    hostPlatform: t["events.hostPlatform"],
    cancelled: t["events.cancelled"],
    visibilityLabels,
    preview: {
      where: t["events.column.where"],
      city: t["events.city"],
      host: t["events.host"],
      platform: t["events.hostPlatform"],
      contact: t["events.contact"],
      reach: t["events.visibility"],
      cancelled: t["events.cancelledTitle"],
      cancelledNoReason: t["events.cancelledNoReason"],
      addToCalendar: t["events.addToCalendar"],
      openMap: t["events.openMap"],
      notAvailable: t["events.notAvailable"],
    },
  };

  const viewHref = (target: "list" | "calendar") =>
    `${localizedPath("/dashboard/events", locale)}?view=${target}`;

  // Adding an event belongs to the list's own toolbar, beside the controls that
  // shape the list. The header keeps it while there is no list to put it in —
  // an empty agenda, or the month view.
  const createEvent = canManage ? (
    <Button
      nativeButton={false}
      render={<Link href={localizedPath("/dashboard/events/new", locale)} />}
    >
      <Plus aria-hidden />
      {t["events.new"]}
    </Button>
  ) : null;
  const listCarriesCreate = !calendarView && events.length > 0;

  return (
    <WorkspacePage>
      <PageHeader
        title={t["events.title"]}
        sub={t["events.subtitle"]}
        action={listCarriesCreate ? null : createEvent}
      />

      <StatGrid>
        <Stat
          label={t["events.stat.upcoming"]}
          value={upcoming.length}
          hint={t["events.stat.upcomingHint"]}
        />
        <Stat
          label={t["events.stat.public"]}
          value={publicCount}
          hint={t["events.stat.publicHint"]}
        />
        <Stat
          label={t["events.stat.cancelled"]}
          value={cancelledCount}
          hint={t["events.stat.cancelledHint"]}
        />
      </StatGrid>

      {/* The two shapes of the same agenda; the chosen one is in the URL. */}
      <div
        role="group"
        aria-label={t["events.view"]}
        className="border-line bg-subtle mb-4 inline-flex items-center gap-1 rounded-full border p-1"
      >
        {(
          [
            { key: "list", href: viewHref("list"), icon: List },
            { key: "calendar", href: viewHref("calendar"), icon: CalendarDays },
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
                "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium",
                active
                  ? "bg-surface text-ink shadow-ring"
                  : "text-copy-muted hover:text-ink",
              )}
            >
              <Glyph className="size-4" aria-hidden />
              {t[`events.view.${option.key}`]}
            </Link>
          );
        })}
      </div>

      {events.length === 0 ? (
        <Card>
          <EmptyState>{t["events.empty"]}</EmptyState>
        </Card>
      ) : calendarView ? (
        <Card>
          <EventsCalendar
            items={items}
            initialMonth={month}
            todayKey={todayKey}
            locale={locale}
            labels={calendarLabels}
          />
        </Card>
      ) : (
        <EventsTable
          rows={rows}
          labels={tableLabels}
          nowIso={now.toISOString()}
          createAction={createEvent}
        />
      )}
    </WorkspacePage>
  );
}
