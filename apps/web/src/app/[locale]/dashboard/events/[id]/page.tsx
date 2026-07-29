import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";

import { EventForm, type EventFormValues } from "~/components/admin/event-form";
import { EventMediaManager } from "~/components/admin/event-media-manager";
import { TransitLinkSummary } from "~/components/admin/transit-links";
import {
  Card,
  Chip,
  DangerZone,
  Field,
  Notice,
  PageHeader,
  ReadOnlyField,
  TextArea,
  WorkspacePage,
} from "~/components/admin/workspace";
import { PendingButton } from "~/components/pending-button";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { eventLanguages, type EventLanguage } from "~/lib/event-languages";
import { recordRestrictedRead } from "~/server/audit/reads";
import { requireEditor } from "~/server/auth/require";
import {
  canManageCoordinationEvents,
  coordinationViewer,
  findCoordinationEvent,
  hostChoicesFor,
} from "~/server/content/coordination-events";
import { workspaceEventMedia } from "~/server/content/event-media";
import { db } from "~/server/db";
import { organizations, placeTranslations, places } from "~/server/db/schema";

import {
  archiveCoordinationEvent,
  cancelCoordinationEvent,
  reinstateCoordinationEvent,
} from "../actions";
import { eventFormFields, eventWhen, listCityViews } from "../presenters";

const reachTone = {
  organization: "neutral",
  inter_organization: "accent",
  public: "ok",
} as const;

/**
 * One event: what it is now, and every change an editor may make to it —
 * editing the details, cancelling it with a reason people can read, and
 * archiving it once it no longer belongs on the agenda.
 */
export default async function EventPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const locale = requireRouteLocale(rawLocale);
  const [t, consoleLabels] = await Promise.all([
    loadPageCatalog(locale, "dashboard-events"),
    loadPageCatalog(locale, "dashboard-console"),
  ]);
  const user = await requireEditor(locale);
  const agendaPath = localizedPath("/dashboard/events", locale);
  const viewer = await coordinationViewer(user.id);
  const [event, canManage] = await Promise.all([
    findCoordinationEvent({ eventId: id, viewer, locale }),
    canManageCoordinationEvents(user.id),
  ]);
  /**
   * `findCoordinationEvent` answers through the reader's own memberships, so a
   * miss here is either an event that is gone or one that belongs to somebody
   * else — and from a single request those look identical, which is exactly why
   * the attempt is recorded. The reader still gets the same 404: what a tier
   * hides includes whether the thing exists.
   */
  if (!event) {
    await recordRestrictedRead({
      action: "event.detail_read_refused",
      subjectType: "coordination_event",
      subjectId: id,
      actorUserId: user.id,
      outcome: "denied",
      errorCode: "event_not_readable",
    });
    notFound();
  }

  const [cityList, organizationRows, placeRows, media] = await Promise.all([
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
    workspaceEventMedia({ eventId: id, locale }),
  ]);

  const city = cityList.find((candidate) => candidate.id === event.cityId);
  const when = eventWhen({
    event,
    city,
    locale,
    labels: { allDay: t["events.allDayShort"] },
  });
  const fields = eventFormFields(event, city?.timezone ?? "Europe/Paris");
  const cancelled = event.status === "cancelled";
  const archived = event.archivedAt !== null;

  const text = Object.fromEntries(
    eventLanguages.map((language) => [
      language,
      {
        title: event.translations[language]?.title ?? "",
        description: event.translations[language]?.description ?? "",
      },
    ]),
  ) as EventFormValues["text"];

  const values: EventFormValues = {
    hostOrganizationId: event.hostOrganizationId ?? "",
    cityId: event.cityId,
    visibility: event.visibility,
    placeId: event.placeId ?? "",
    locationLabel: event.locationLabel ?? "",
    contactLabel: event.contactLabel ?? "",
    contactValue: event.contactValue ?? "",
    allDay: event.allDay,
    sourceLanguageCode: (eventLanguages as readonly string[]).includes(
      event.sourceLanguageCode,
    )
      ? (event.sourceLanguageCode as EventLanguage)
      : "fr",
    text,
    steward: {
      stewardName: event.stewardName,
      stewardPhone: event.stewardPhone,
      stewardEmail: event.stewardEmail,
    },
    transit: event.transit,
    ...fields,
  };

  return (
    <WorkspacePage width="content">
      <PageHeader
        family="event"
        title={event.title || t["events.untitled"]}
        sub={`${when.dateLabel} · ${when.timeLabel}`}
        back={{ href: agendaPath, label: t["events.backToAgenda"] }}
        badges={
          <>
            <Chip tone={reachTone[event.visibility]}>
              {t[`events.visibility.${event.visibility}`]}
            </Chip>
            {cancelled ? (
              <Chip tone="danger">{t["events.cancelled"]}</Chip>
            ) : null}
            {archived ? (
              <Chip tone="neutral">{t["events.archived"]}</Chip>
            ) : null}
          </>
        }
      />

      {cancelled ? (
        <Notice tone="danger" title={t["events.cancelledTitle"]}>
          {event.cancellationReason ?? t["events.cancelledNoReason"]}
        </Notice>
      ) : null}
      {archived ? (
        <Notice tone="warn" title={t["events.archivedTitle"]}>
          {t["events.archivedBody"]}
        </Notice>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card title={t["events.summary"]}>
          <div className="grid gap-3">
            <ReadOnlyField
              label={t["events.host"]}
              value={event.hostName ?? t["events.hostPlatform"]}
            />
            <ReadOnlyField
              label={t["events.column.where"]}
              value={
                [event.placeName, event.locationLabel, city?.name]
                  .filter(Boolean)
                  .join(" · ") || null
              }
            />
            <ReadOnlyField
              label={t["events.contact"]}
              value={
                [event.contactLabel, event.contactValue]
                  .filter(Boolean)
                  .join(" · ") || null
              }
            />
            {/* Only when somebody recorded a way in: an empty list would read
             * as "you cannot get here without a car". */}
            {event.transit.length > 0 ? (
              <div>
                <p className="text-copy-muted text-xs font-semibold uppercase tracking-wide">
                  {consoleLabels["transit.title"]}
                </p>
                <TransitLinkSummary
                  links={event.transit}
                  labels={consoleLabels}
                  className="mt-0.5 grid gap-1 text-sm"
                />
              </div>
            ) : null}
          </div>
        </Card>
        <Card title={t["events.reachTitle"]}>
          <p className="text-copy-muted text-sm">
            {t[`events.visibility.${event.visibility}.hint`]}
          </p>
        </Card>
      </div>

      {canManage ? (
        <>
          <div className="mb-6">
            <EventForm
              mode="edit"
              locale={locale}
              eventId={event.id}
              values={values}
              organizations={hostChoicesFor(viewer, organizationRows)}
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
          </div>

          <div className="mb-6">
            <Card title={t["events.media.title"]} hint={t["events.media.hint"]}>
              <EventMediaManager
                locale={locale}
                eventId={event.id}
                sourceLanguage={values.sourceLanguageCode}
                cover={media.cover}
                flyers={media.flyers}
                labels={{
                  coverHeading: t["events.media.coverHeading"],
                  coverHint: t["events.media.coverHint"],
                  coverAttached: t["events.media.coverAttached"],
                  altLabel: t["events.media.altLabel"],
                  altHint: t["events.media.altHint"],
                  rights: t["events.media.rights"],
                  select: t["events.media.select"],
                  replace: t["events.media.replace"],
                  remove: t["events.media.remove"],
                  uploading: t["events.media.uploading"],
                  uploadError: t["events.media.uploadError"],
                  coverSaved: t["events.media.coverSaved"],
                  coverRemoved: t["events.media.coverRemoved"],
                  flyersHeading: t["events.media.flyersHeading"],
                  flyersHint: t["events.media.flyersHint"],
                  flyersEmpty: t["events.media.flyersEmpty"],
                  flyerTitle: t["events.media.flyerTitle"],
                  flyerTitleHint: t["events.media.flyerTitleHint"],
                  addFlyer: t["events.media.addFlyer"],
                  flyerAdded: t["events.media.flyerAdded"],
                  flyerRemoved: t["events.media.flyerRemoved"],
                  removeError: t["events.media.removeError"],
                  constraints: t["events.media.constraints"],
                  pendingScan: t["events.media.pendingScan"],
                  download: t["events.media.download"],
                }}
              />
            </Card>
          </div>

          {cancelled ? (
            <Card
              title={t["events.reinstate"]}
              hint={t["events.reinstateHint"]}
            >
              <form action={reinstateCoordinationEvent}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="eventId" value={event.id} />
                <PendingButton variant="secondary">
                  {t["events.reinstateAction"]}
                </PendingButton>
              </form>
            </Card>
          ) : (
            <Card title={t["events.cancel"]} hint={t["events.cancelHint"]}>
              <form action={cancelCoordinationEvent} className="grid gap-3">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="eventId" value={event.id} />
                <Field
                  label={t["events.cancelReason"]}
                  hint={t["events.cancelReasonHint"]}
                >
                  <TextArea name="reason" rows={3} required minLength={3} />
                </Field>
                <div>
                  <PendingButton variant="danger">
                    {t["events.cancelAction"]}
                  </PendingButton>
                </div>
              </form>
            </Card>
          )}

          <div className="mt-6">
            <DangerZone title={t["events.removeTitle"]}>
              <p className="text-copy-muted text-sm">
                {archived ? t["events.restoreBody"] : t["events.archiveBody"]}
              </p>
              <form action={archiveCoordinationEvent}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="eventId" value={event.id} />
                <input
                  type="hidden"
                  name="archived"
                  value={archived ? "false" : "true"}
                />
                <PendingButton variant={archived ? "secondary" : "danger"}>
                  {archived
                    ? t["events.restoreAction"]
                    : t["events.archiveAction"]}
                </PendingButton>
              </form>
            </DangerZone>
          </div>
        </>
      ) : (
        <Notice tone="info" title={t["events.readOnlyTitle"]}>
          {t["events.readOnlyBody"]}
        </Notice>
      )}
    </WorkspacePage>
  );
}
