import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";

import { EventForm, type EventFormValues } from "~/components/admin/event-form";
import { PageHeader, WorkspacePage } from "~/components/admin/workspace";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { EMPTY_STEWARD_CONTACT } from "~/lib/steward-contact";
import { requireEditor } from "~/server/auth/require";
import {
  canManageCoordinationEvents,
  coordinationViewer,
  hostChoicesFor,
} from "~/server/content/coordination-events";
import { db } from "~/server/db";
import { organizations, placeTranslations, places } from "~/server/db/schema";

import { cityToday, listCityViews } from "../presenters";

/** A new event on the shared agenda. */
export default async function NewEventPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const [t, consoleLabels] = await Promise.all([
    loadPageCatalog(locale, "dashboard-events"),
    loadPageCatalog(locale, "dashboard-console"),
  ]);
  const user = await requireEditor(locale);
  const agendaPath = localizedPath("/dashboard/events", locale);
  const [viewer, canManage] = await Promise.all([
    coordinationViewer(user.id),
    canManageCoordinationEvents(user.id),
  ]);
  if (!canManage) redirect(agendaPath);

  const [cityList, organizationRows, placeRows] = await Promise.all([
    listCityViews(locale),
    db
      .select({ id: organizations.id, name: organizations.displayName })
      .from(organizations)
      .orderBy(asc(organizations.displayName)),
    db
      .select({
        id: places.id,
        cityId: places.cityId,
        name: placeTranslations.name,
      })
      .from(places)
      .leftJoin(
        placeTranslations,
        and(
          eq(placeTranslations.placeId, places.id),
          eq(placeTranslations.languageCode, locale),
        ),
      )
      .where(and(isNull(places.archivedAt), eq(places.active, true)))
      .orderBy(asc(placeTranslations.name)),
  ]);

  const hosts = hostChoicesFor(viewer, organizationRows);
  const city = cityList[0];
  const { todayKey } = cityToday(city?.timezone ?? "Europe/Paris", new Date());

  const values: EventFormValues = {
    // A member hosts for their own organisation; a platform steward starts
    // from the platform itself and picks a host if the event belongs to one.
    hostOrganizationId: viewer.isPlatformSteward ? "" : (hosts[0]?.id ?? ""),
    cityId: city?.id ?? "",
    visibility: "organization",
    placeId: "",
    locationLabel: "",
    contactLabel: "",
    contactValue: "",
    allDay: false,
    startDate: todayKey,
    startTime: "09:00",
    endDate: todayKey,
    endTime: "11:00",
    sourceLanguageCode: "fr",
    text: {
      fr: { title: "", description: "" },
      en: { title: "", description: "" },
      ar: { title: "", description: "" },
    },
    steward: EMPTY_STEWARD_CONTACT,
  };

  return (
    <WorkspacePage width="content">
      <PageHeader
        title={t["events.newTitle"]}
        sub={t["events.newSub"]}
        back={{ href: agendaPath, label: t["events.backToAgenda"] }}
      />
      <EventForm
        mode="create"
        locale={locale}
        values={values}
        organizations={hosts}
        cities={cityList}
        places={placeRows.map((place) => ({
          id: place.id,
          name: place.name ?? place.id.slice(0, 8),
          cityId: place.cityId,
        }))}
        canHostAsPlatform={viewer.isPlatformSteward}
        labels={t}
        consoleLabels={consoleLabels}
        cancelHref={agendaPath}
      />
    </WorkspacePage>
  );
}
