import { formatMessage, type Locale } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import {
  Ban,
  CalendarDays,
  Check,
  CircleCheckBig,
  CircleHelp,
  MapPin,
  Pencil,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import { RunbookCalendar } from "~/components/admin/runbook-calendar";
import { RunbookInformationRail } from "~/components/admin/runbook-information-rail";
import { PendingButton } from "~/components/pending-button";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import {
  attentionKindOf,
  parisToday,
  type AttentionKind,
} from "~/lib/freshness";
import { organizationChoices } from "~/server/auth/authorization";
import { requireEditor } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  activities,
  activityOccurrenceConfirmations,
  activityServices,
  activityTranslations,
  cities,
  cityTeams,
  cityTranslations,
  placeTranslations,
  scheduleExceptions,
  scheduleRules,
  services,
  serviceTranslations,
} from "~/server/db/schema";
import {
  cancelActivityToday,
  confirmActivitiesToday,
  confirmActivityToday,
  markActivityUncertain,
  undoCancelActivityToday,
} from "./actions";

const localeTag: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-GB",
  ar: "ar",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;

function isoWeekday(isoDate: string) {
  const day = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function monthDates(month: string) {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from(
    { length: days },
    (_, index) =>
      `${String(year).padStart(4, "0")}-${String(monthNumber).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
  );
}

function formatDate(isoDate: string, locale: Locale, long = true) {
  return new Intl.DateTimeFormat(localeTag[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(long ? {} : { year: undefined }),
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

type TranslationRow = {
  languageCode: string;
  name: string;
};

function translatedName(
  rows: TranslationRow[],
  locale: Locale,
  fallback: string,
) {
  return (
    rows.find((row) => row.languageCode === locale)?.name ??
    rows.find((row) => row.languageCode === "fr")?.name ??
    rows[0]?.name ??
    fallback
  );
}

/**
 * Deep link into the activities console. A global activity has no city, so the
 * `city` hint is left out rather than sent as an empty value.
 */
function activityConsoleQuery(activity: {
  id: string;
  organizationId: string | null;
  cityId: string | null;
}) {
  const query = new URLSearchParams({ activity: activity.id });
  if (activity.organizationId) query.set("org", activity.organizationId);
  if (activity.cityId) query.set("city", activity.cityId);
  return query.toString();
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    org?: string;
    city?: string;
    date?: string;
    month?: string;
  }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const search = await searchParams;
  const user = await requireEditor(locale);
  const messages = await loadPageCatalog(locale, "dashboard-overview");
  const today = parisToday();
  const selectedDate =
    search.date && ISO_DATE.test(search.date) ? search.date : today.isoDate;
  const selectedMonth =
    search.month && ISO_MONTH.test(search.month)
      ? search.month
      : selectedDate.slice(0, 7);
  const selectedWeekday = isoWeekday(selectedDate);
  const isToday = selectedDate === today.isoDate;

  /**
   * Which association's day this is. `?org=` is a convenience — the list of
   * associations this account administers is the guarantee — so the id is
   * honoured only if it is one of them and dropped otherwise. Read straight from
   * the query string it would have pointed the runbook at any association's
   * activities for the day, steward names and all.
   */
  const [organizationScope, cityRows, teamRows] = await Promise.all([
    organizationChoices(user.id, search.org),
    db
      .select({ id: cities.id, code: cities.code, name: cityTranslations.name })
      .from(cities)
      .leftJoin(
        cityTranslations,
        and(
          eq(cityTranslations.cityId, cities.id),
          eq(cityTranslations.languageCode, locale),
        ),
      )
      .where(eq(cities.active, true))
      .orderBy(asc(cities.code)),
    db
      .select({
        id: cityTeams.id,
        name: cityTeams.name,
        organizationId: cityTeams.organizationId,
        cityId: cityTeams.cityId,
      })
      .from(cityTeams)
      .where(eq(cityTeams.active, true)),
  ]);
  const selectedOrganization = organizationScope.choices.find(
    (row) => row.id === organizationScope.selectedId,
  );
  const organizationTeam = teamRows.find(
    (row) => row.organizationId === selectedOrganization?.id,
  );
  const selectedCity =
    cityRows.find((row) => row.id === search.city) ??
    cityRows.find((row) => row.id === organizationTeam?.cityId) ??
    cityRows[0];
  const cityName =
    selectedCity?.name ?? selectedCity?.code ?? messages["scope.city"];

  /**
   * The day's work in the selected city. The organisation narrows it, but a
   * platform-owned activity has no organisation and still opens its doors, so it
   * belongs to whoever is on the runbook. Matching on `organizationId` alone
   * dropped those rows silently: `null = <uuid>` is never true, so they were
   * scheduled, published, unconfirmed, and invisible.
   */
  const scopedActivities = selectedCity
    ? await db
        .select({
          id: activities.id,
          organizationId: activities.organizationId,
          cityId: activities.cityId,
          teamId: activities.teamId,
          placeId: activities.placeId,
          published: activities.published,
          manualStatus: activities.manualStatus,
          lastVerifiedAt: activities.lastVerifiedAt,
          reviewDueAt: activities.reviewDueAt,
        })
        .from(activities)
        .where(
          and(
            eq(activities.cityId, selectedCity.id),
            selectedOrganization
              ? or(
                  isNull(activities.organizationId),
                  eq(activities.organizationId, selectedOrganization.id),
                )
              : isNull(activities.organizationId),
            isNull(activities.archivedAt),
          ),
        )
    : [];
  const activityIds = scopedActivities.map((activity) => activity.id);
  const placeIds = scopedActivities
    .map((activity) => activity.placeId)
    .filter((id): id is string => id !== null);
  const monthStart = `${selectedMonth}-01`;
  const datesInMonth = monthDates(selectedMonth);
  const monthEnd = datesInMonth.at(-1) ?? monthStart;

  const [
    translationRows,
    ruleRows,
    exceptionRows,
    confirmationRows,
    assignmentRows,
    placeNameRows,
  ] = await Promise.all([
    activityIds.length
      ? db
          .select({
            activityId: activityTranslations.activityId,
            languageCode: activityTranslations.languageCode,
            name: activityTranslations.name,
          })
          .from(activityTranslations)
          .where(inArray(activityTranslations.activityId, activityIds))
      : [],
    activityIds.length
      ? db
          .select()
          .from(scheduleRules)
          .where(inArray(scheduleRules.activityId, activityIds))
          .orderBy(asc(scheduleRules.startTime))
      : [],
    activityIds.length
      ? db
          .select()
          .from(scheduleExceptions)
          .where(
            and(
              inArray(scheduleExceptions.activityId, activityIds),
              gte(scheduleExceptions.date, monthStart),
              lte(scheduleExceptions.date, monthEnd),
            ),
          )
      : [],
    activityIds.length
      ? db
          .select()
          .from(activityOccurrenceConfirmations)
          .where(
            and(
              inArray(activityOccurrenceConfirmations.activityId, activityIds),
              gte(activityOccurrenceConfirmations.date, monthStart),
              lte(activityOccurrenceConfirmations.date, monthEnd),
            ),
          )
      : [],
    activityIds.length
      ? db
          .select({
            activityId: activityServices.activityId,
            serviceId: services.id,
            languageCode: serviceTranslations.languageCode,
            name: serviceTranslations.name,
          })
          .from(activityServices)
          .innerJoin(services, eq(activityServices.serviceId, services.id))
          .leftJoin(
            serviceTranslations,
            eq(serviceTranslations.serviceId, services.id),
          )
          .where(
            and(
              inArray(activityServices.activityId, activityIds),
              eq(activityServices.active, true),
              eq(services.active, true),
              isNull(services.archivedAt),
            ),
          )
      : [],
    placeIds.length
      ? db
          .select({
            placeId: placeTranslations.placeId,
            languageCode: placeTranslations.languageCode,
            name: placeTranslations.name,
          })
          .from(placeTranslations)
          .where(inArray(placeTranslations.placeId, placeIds))
      : [],
  ]);

  const translationsByActivity = new Map<string, TranslationRow[]>();
  for (const row of translationRows) {
    const current = translationsByActivity.get(row.activityId) ?? [];
    current.push(row);
    translationsByActivity.set(row.activityId, current);
  }
  const placesById = new Map<string, TranslationRow[]>();
  for (const row of placeNameRows) {
    const current = placesById.get(row.placeId) ?? [];
    current.push(row);
    placesById.set(row.placeId, current);
  }
  const servicesByActivity = new Map<string, Map<string, TranslationRow[]>>();
  for (const row of assignmentRows) {
    const assigned =
      servicesByActivity.get(row.activityId) ??
      new Map<string, TranslationRow[]>();
    const names: TranslationRow[] = assigned.get(row.serviceId) ?? [];
    if (row.name && row.languageCode) {
      names.push({ languageCode: row.languageCode, name: row.name });
    }
    assigned.set(row.serviceId, names);
    servicesByActivity.set(row.activityId, assigned);
  }
  const rulesByActivity = new Map<string, typeof ruleRows>();
  for (const rule of ruleRows) {
    const current = rulesByActivity.get(rule.activityId) ?? [];
    current.push(rule);
    rulesByActivity.set(rule.activityId, current);
  }
  const exceptionKey = (activityId: string, date: string) =>
    `${activityId}:${date}`;
  const exceptionsByOccurrence = new Map<string, Set<string>>();
  for (const exception of exceptionRows) {
    const key = exceptionKey(exception.activityId, exception.date);
    const current = exceptionsByOccurrence.get(key) ?? new Set();
    current.add(exception.kind);
    exceptionsByOccurrence.set(key, current);
  }
  const confirmationByOccurrence = new Map(
    confirmationRows.map((row) => [
      exceptionKey(row.activityId, row.date),
      row,
    ]),
  );

  const activityName = (id: string) =>
    translatedName(
      translationsByActivity.get(id) ?? [],
      locale,
      messages["activity.untitled"],
    );
  const occurrenceFor = (activity: (typeof scopedActivities)[number]) => {
    const rules = (rulesByActivity.get(activity.id) ?? []).filter(
      (rule) =>
        rule.weekday === selectedWeekday &&
        (!rule.validFrom || rule.validFrom <= selectedDate) &&
        (!rule.validTo || rule.validTo >= selectedDate),
    );
    if (rules.length === 0) return null;
    const exceptions =
      exceptionsByOccurrence.get(exceptionKey(activity.id, selectedDate)) ??
      new Set<string>();
    const confirmed = confirmationByOccurrence.get(
      exceptionKey(activity.id, selectedDate),
    );
    const assignedServices = [
      ...(servicesByActivity.get(activity.id)?.entries() ?? []),
    ].map(([serviceId, names]) => ({
      id: serviceId,
      name: translatedName(names, locale, messages["service.untitled"]),
    }));
    return {
      ...activity,
      name: activityName(activity.id),
      place: activity.placeId
        ? translatedName(
            placesById.get(activity.placeId) ?? [],
            locale,
            messages["activity.mobile"],
          )
        : messages["activity.mobile"],
      windows: rules.map(
        (rule) => `${rule.startTime.slice(0, 5)}–${rule.endTime.slice(0, 5)}`,
      ),
      services: assignedServices,
      cancelled: exceptions.has("closure") || exceptions.has("cancellation"),
      uncertain: exceptions.has("uncertain"),
      confirmedAt: confirmed?.confirmedAt ?? null,
    };
  };
  const occurrences = scopedActivities
    .map(occurrenceFor)
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => (a.windows[0] ?? "").localeCompare(b.windows[0] ?? ""));

  /**
   * Classified once, read twice: the calendar's attention dot and the attention
   * rail below it were computing "needs attention" differently, so an activity
   * that had never been verified showed a plain scheduled dot while the rail
   * called it out by name.
   */
  const attentionByActivity = new Map<string, AttentionKind>();
  for (const activity of scopedActivities) {
    const kind = attentionKindOf({
      ...activity,
      hasSchedule: (rulesByActivity.get(activity.id) ?? []).length > 0,
    });
    if (kind) attentionByActivity.set(activity.id, kind);
  }

  const eventDates: Record<
    string,
    ("scheduled" | "confirmed" | "attention" | "cancelled")[]
  > = {};
  for (const date of datesInMonth) {
    const states = new Set<
      "scheduled" | "confirmed" | "attention" | "cancelled"
    >();
    const weekday = isoWeekday(date);
    for (const activity of scopedActivities) {
      const scheduled = (rulesByActivity.get(activity.id) ?? []).some(
        (rule) =>
          rule.weekday === weekday &&
          (!rule.validFrom || rule.validFrom <= date) &&
          (!rule.validTo || rule.validTo >= date),
      );
      if (!scheduled) continue;
      const exceptions =
        exceptionsByOccurrence.get(exceptionKey(activity.id, date)) ??
        new Set<string>();
      if (exceptions.has("closure") || exceptions.has("cancellation")) {
        states.add("cancelled");
      } else if (
        confirmationByOccurrence.has(exceptionKey(activity.id, date))
      ) {
        states.add("confirmed");
      } else if (
        exceptions.has("uncertain") ||
        attentionByActivity.has(activity.id)
      ) {
        states.add("attention");
      } else {
        states.add("scheduled");
      }
    }
    if (states.size > 0) eventDates[date] = [...states];
  }

  const pending = occurrences.filter(
    (occurrence) =>
      !occurrence.cancelled && !occurrence.uncertain && !occurrence.confirmedAt,
  );
  const allConfirmed =
    isToday &&
    occurrences.length > 0 &&
    occurrences.every(
      (occurrence) => occurrence.cancelled || Boolean(occurrence.confirmedAt),
    );
  const attention = scopedActivities.flatMap((activity) => {
    const kind = attentionByActivity.get(activity.id);
    return kind ? [{ activity, kind, name: activityName(activity.id) }] : [];
  });
  const mainAttention = attention[0];
  const selectedDateLabel = formatDate(selectedDate, locale);

  return (
    <RunbookInformationRail
      hideLabel={messages["information.hide"]}
      showLabel={messages["information.show"]}
      main={
        <>
          <div className="border-line flex flex-col gap-5 border-b pb-6 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold capitalize tracking-tight md:text-4xl">
                {selectedDateLabel}
              </h1>
              <p className="text-copy-muted mt-3 text-sm md:text-base">
                {formatMessage(
                  messages[
                    isToday ? "runbook.summary" : "runbook.summaryScheduled"
                  ],
                  {
                    count: String(
                      isToday ? pending.length : occurrences.length,
                    ),
                    city: cityName,
                  },
                )}
              </p>
            </div>
            {isToday && pending.length > 0 ? (
              <form action={confirmActivitiesToday} className="shrink-0">
                <input type="hidden" name="locale" value={locale} />
                {pending.map((occurrence) => (
                  <input
                    key={occurrence.id}
                    type="hidden"
                    name="activityId"
                    value={occurrence.id}
                  />
                ))}
                <PendingButton className="h-12 px-5 text-base">
                  <CircleCheckBig aria-hidden />
                  {formatMessage(messages["runbook.confirmAll"], {
                    count: String(pending.length),
                  })}
                </PendingButton>
              </form>
            ) : null}
          </div>

          <div className="divide-line divide-y">
            {occurrences.length === 0 ? (
              <div className="py-14 text-center">
                <CalendarDays
                  className="text-copy-muted mx-auto size-8"
                  aria-hidden
                />
                <h2 className="mt-3 font-semibold">
                  {messages["runbook.empty"]}
                </h2>
                <p className="text-copy-muted mx-auto mt-1 max-w-md text-sm">
                  {messages["runbook.emptyHint"]}
                </p>
              </div>
            ) : (
              occurrences.map((occurrence, index) => {
                const tone = occurrence.cancelled
                  ? "text-danger"
                  : occurrence.uncertain
                    ? "text-warn"
                    : occurrence.confirmedAt
                      ? "text-ok"
                      : "text-brand";
                return (
                  <article
                    key={occurrence.id}
                    className="grid gap-4 py-7 md:grid-cols-[34px_minmax(0,1fr)]"
                  >
                    <div className="relative hidden md:block" aria-hidden>
                      <CalendarDays
                        className={`${tone} relative z-10 size-6`}
                      />
                      {index < occurrences.length - 1 ? (
                        <span className="bg-line absolute start-3 top-7 h-[calc(100%+3.5rem)] w-px" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <h2 className="text-lg font-semibold">
                              {occurrence.name}
                            </h2>
                            <span className="text-copy-muted text-sm tabular-nums">
                              {occurrence.windows.join(", ")}
                            </span>
                            {occurrence.cancelled ? (
                              <Badge className="bg-danger-soft text-danger">
                                {messages["runbook.cancelled"]}
                              </Badge>
                            ) : occurrence.uncertain ? (
                              <Badge className="bg-warn-soft text-warn">
                                {messages["runbook.uncertainStatus"]}
                              </Badge>
                            ) : occurrence.confirmedAt ? (
                              <Badge className="bg-ok-soft text-ok">
                                <Check aria-hidden />
                                {messages["runbook.confirmed"]}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-copy-muted mt-2 flex items-center gap-1.5 text-sm">
                            <MapPin className="size-4 shrink-0" aria-hidden />
                            {occurrence.place}, {cityName}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <Link
                            className={buttonVariants({ variant: "outline" })}
                            href={`${localizedPath("/dashboard/activities", locale)}?${activityConsoleQuery(
                              {
                                id: occurrence.id,
                                organizationId:
                                  occurrence.organizationId ??
                                  selectedOrganization?.id ??
                                  null,
                                cityId: occurrence.cityId,
                              },
                            )}`}
                          >
                            <Pencil aria-hidden />
                            {messages["runbook.correct"]}
                          </Link>
                          {isToday ? (
                            occurrence.cancelled ? (
                              <form action={undoCancelActivityToday}>
                                <input
                                  type="hidden"
                                  name="locale"
                                  value={locale}
                                />
                                <input
                                  type="hidden"
                                  name="activityId"
                                  value={occurrence.id}
                                />
                                <PendingButton variant="secondary">
                                  {messages["runbook.undoCancel"]}
                                </PendingButton>
                              </form>
                            ) : (
                              <form action={cancelActivityToday}>
                                <input
                                  type="hidden"
                                  name="locale"
                                  value={locale}
                                />
                                <input
                                  type="hidden"
                                  name="activityId"
                                  value={occurrence.id}
                                />
                                <PendingButton variant="danger">
                                  <Ban aria-hidden />
                                  {messages["runbook.cancel"]}
                                </PendingButton>
                              </form>
                            )
                          ) : null}
                          {isToday &&
                          !occurrence.cancelled &&
                          !occurrence.confirmedAt ? (
                            <form action={markActivityUncertain}>
                              <input
                                type="hidden"
                                name="locale"
                                value={locale}
                              />
                              <input
                                type="hidden"
                                name="activityId"
                                value={occurrence.id}
                              />
                              <PendingButton variant="secondary">
                                <CircleHelp aria-hidden />
                                {messages["runbook.uncertain"]}
                              </PendingButton>
                            </form>
                          ) : null}
                        </div>
                      </div>

                      <p className="text-copy-muted mt-3 text-xs lg:text-end">
                        {formatMessage(messages["runbook.occurrenceScope"], {
                          city: cityName,
                          date: selectedDateLabel,
                        })}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {occurrence.services.length > 0 ? (
                          occurrence.services.map((service) => (
                            <Badge
                              key={service.id}
                              variant="outline"
                              className="h-8 rounded-md px-3 font-normal"
                            >
                              {service.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-copy-muted text-xs">
                            {messages["activity.noServices"]}
                          </span>
                        )}
                      </div>
                      {isToday &&
                      !occurrence.cancelled &&
                      !occurrence.confirmedAt &&
                      !occurrence.uncertain ? (
                        <form action={confirmActivityToday} className="mt-4">
                          <input type="hidden" name="locale" value={locale} />
                          <input
                            type="hidden"
                            name="activityId"
                            value={occurrence.id}
                          />
                          <PendingButton variant="secondary">
                            <Check aria-hidden />
                            {messages["runbook.confirmOne"]}
                          </PendingButton>
                        </form>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {allConfirmed ? (
            <div className="border-ok/40 bg-ok-soft mt-5 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
              <CircleCheckBig
                className="text-ok size-10 shrink-0"
                aria-hidden
              />
              <div>
                <p className="font-semibold">
                  {messages["runbook.allConfirmed"]}
                </p>
                <p className="text-copy-muted mt-1 text-sm">
                  {messages["runbook.allConfirmedHint"]}
                </p>
              </div>
              <div className="text-copy-muted sm:ms-auto sm:text-end">
                <p className="text-ok text-sm font-medium">
                  {messages["runbook.confirmedBy"]}
                </p>
                <p className="text-xs">
                  {organizationTeam?.name ?? messages["scope.team"]}
                </p>
              </div>
            </div>
          ) : null}
        </>
      }
      information={
        <>
          <RunbookCalendar
            selectedDate={selectedDate}
            month={selectedMonth}
            eventDates={eventDates}
            selectedDateLabel={selectedDateLabel}
            selectedCount={occurrences.length}
            labels={{
              activities: messages["calendar.activities"],
              scheduled: messages["calendar.scheduled"],
              confirmed: messages["calendar.confirmed"],
              attention: messages["calendar.attention"],
              loading: messages["calendar.loading"],
            }}
            localeCode={locale}
          />

          <section className="border-line mt-5 border-t pt-5">
            <h2 className="flex items-center gap-2 font-semibold">
              {messages["attention.title"]}
              <Badge className="bg-warn-soft text-warn" variant="secondary">
                {attention.length}
              </Badge>
            </h2>
            {mainAttention ? (
              <div className="mt-3">
                <p className="text-warn flex items-start gap-2 text-sm font-semibold">
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden
                  />
                  {mainAttention.name}
                </p>
                <p className="text-copy-muted mt-1 ps-6 text-xs">
                  {
                    {
                      uncertain: messages["attention.uncertain"],
                      noSchedule: messages["attention.noSchedule"],
                      never: messages["attention.never"],
                      overdue: messages["attention.overdue"],
                      dueSoon: messages["attention.dueSoon"],
                    }[mainAttention.kind]
                  }
                </p>
                <Link
                  className={buttonVariants({
                    variant: "outline",
                    className: "mt-3 w-full justify-between",
                  })}
                  href={`${localizedPath("/dashboard/activities", locale)}?${activityConsoleQuery(
                    {
                      id: mainAttention.activity.id,
                      organizationId:
                        mainAttention.activity.organizationId ??
                        selectedOrganization?.id ??
                        null,
                      cityId: mainAttention.activity.cityId,
                    },
                  )}`}
                >
                  {messages["attention.review"]}
                  <Pencil aria-hidden />
                </Link>
              </div>
            ) : (
              <p className="text-copy-muted mt-2 text-sm">
                {messages["attention.empty"]}
              </p>
            )}
          </section>
        </>
      }
    />
  );
}
