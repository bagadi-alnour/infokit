import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";

import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from "~/components/ui";
import { db } from "~/server/db";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import {
  audienceCategories,
  organizations,
  places,
  placeTranslations,
  scheduleExceptions,
  scheduleExceptionTranslations,
  scheduleRules,
  serviceProviders,
  serviceTranslations,
  services,
} from "~/server/db/schema";
import {
  addProvider,
  addScheduleException,
  addScheduleRule,
  deleteScheduleException,
  deleteScheduleRule,
  markVerified,
  removeProvider,
  setPublished,
  updateServiceMeta,
  upsertServiceTranslation,
} from "../actions";

const WEEKDAYS = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [7, "Sunday"],
] as const;

const weekdayName = (n: number) =>
  WEEKDAYS.find(([value]) => value === n)?.[1] ?? String(n);

const LOCALES = ["fr", "en", "ar"] as const;

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const routeParams = await params;
  const locale = requireRouteLocale(routeParams.locale);
  const { id } = routeParams;

  const [service] = await db.select().from(services).where(eq(services.id, id));
  if (!service) notFound();

  const translations = await db
    .select()
    .from(serviceTranslations)
    .where(eq(serviceTranslations.serviceId, id));
  const byLocale = new Map(translations.map((t) => [t.languageCode, t]));

  const rules = await db
    .select()
    .from(scheduleRules)
    .where(eq(scheduleRules.serviceId, id))
    .orderBy(asc(scheduleRules.weekday), asc(scheduleRules.startTime));

  const exceptions = await db
    .select({
      id: scheduleExceptions.id,
      date: scheduleExceptions.date,
      kind: scheduleExceptions.kind,
      reason: scheduleExceptionTranslations.publicReason,
    })
    .from(scheduleExceptions)
    .leftJoin(
      scheduleExceptionTranslations,
      and(
        eq(scheduleExceptionTranslations.exceptionId, scheduleExceptions.id),
        eq(scheduleExceptionTranslations.languageCode, "fr"),
      ),
    )
    .where(eq(scheduleExceptions.serviceId, id))
    .orderBy(asc(scheduleExceptions.date));

  const providers = await db
    .select({
      id: serviceProviders.id,
      active: serviceProviders.active,
      org: organizations.displayName,
      organizationId: serviceProviders.organizationId,
    })
    .from(serviceProviders)
    .leftJoin(
      organizations,
      eq(serviceProviders.organizationId, organizations.id),
    )
    .where(eq(serviceProviders.serviceId, id));

  const orgs = await db
    .select({ id: organizations.id, name: organizations.displayName })
    .from(organizations)
    .orderBy(organizations.displayName);
  const audiences = await db
    .select({ id: audienceCategories.id, code: audienceCategories.code })
    .from(audienceCategories)
    .orderBy(audienceCategories.displayOrder);
  const placeRows = await db
    .select({ id: places.id, name: placeTranslations.name })
    .from(places)
    .leftJoin(
      placeTranslations,
      and(
        eq(placeTranslations.placeId, places.id),
        eq(placeTranslations.languageCode, "fr"),
      ),
    );

  const providerOrgIds = new Set(providers.map((p) => p.organizationId));
  const addableOrgs = orgs.filter((org) => !providerOrgIds.has(org.id));
  const frName = byLocale.get("fr")?.name ?? "(no name)";

  return (
    <>
      <Link
        href={localizedPath("/dashboard/services", locale)}
        className="text-accent text-sm"
      >
        ← Services
      </Link>
      <PageHeader
        title={frName}
        sub={
          service.lastVerifiedAt
            ? `Last verified ${service.lastVerifiedAt.toLocaleDateString("en-GB")}`
            : "Never verified — verify with the organisation before relying on it"
        }
        action={
          <span className="flex items-center gap-2">
            {service.manualStatus !== "normal" ? (
              <Chip
                tone={service.manualStatus === "cancelled" ? "danger" : "warn"}
              >
                {service.manualStatus}
              </Chip>
            ) : null}
            <Chip tone={service.published ? "ok" : "neutral"}>
              {service.published ? "published" : "draft"}
            </Chip>
            <form action={markVerified}>
              <input type="hidden" name="serviceId" value={service.id} />
              <Button variant="secondary">Mark verified now</Button>
            </form>
            <form action={setPublished}>
              <input type="hidden" name="serviceId" value={service.id} />
              <input
                type="hidden"
                name="publish"
                value={service.published ? "false" : "true"}
              />
              <Button variant={service.published ? "secondary" : "primary"}>
                {service.published ? "Unpublish" : "Publish"}
              </Button>
            </form>
          </span>
        }
      />

      <div className="grid gap-4">
        <Card title="Details">
          <form
            action={updateServiceMeta}
            className="grid gap-3 md:grid-cols-3"
          >
            <input type="hidden" name="serviceId" value={service.id} />
            <Field label="Audience">
              <Select
                name="audienceCategoryId"
                defaultValue={service.audienceCategoryId}
              >
                {audiences.map((audience) => (
                  <option key={audience.id} value={audience.id}>
                    {audience.code}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Place">
              <Select name="placeId" defaultValue={service.placeId ?? ""}>
                <option value="">—</option>
                {placeRows.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name ?? place.id.slice(0, 8)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Manual status">
              <Select name="manualStatus" defaultValue={service.manualStatus}>
                <option value="normal">normal</option>
                <option value="cancelled">cancelled</option>
                <option value="uncertain">uncertain</option>
              </Select>
            </Field>
            <Field label="Minimum age">
              <TextInput
                name="minAge"
                inputMode="numeric"
                defaultValue={service.minAge ?? ""}
              />
            </Field>
            <Field label="Maximum age">
              <TextInput
                name="maxAge"
                inputMode="numeric"
                defaultValue={service.maxAge ?? ""}
              />
            </Field>
            <div className="md:col-span-3">
              <Field label="Source note">
                <TextArea
                  name="sourceNote"
                  rows={2}
                  defaultValue={service.sourceNote ?? ""}
                />
              </Field>
            </div>
            <div>
              <Button>Save details</Button>
            </div>
          </form>
        </Card>

        <Card title="Translations">
          <div className="grid gap-4 md:grid-cols-3">
            {LOCALES.map((locale) => {
              const translation = byLocale.get(locale);
              return (
                <form
                  key={locale}
                  action={upsertServiceTranslation}
                  className="border-line grid gap-2 rounded-[10px] border p-3"
                  dir={locale === "ar" ? "rtl" : "ltr"}
                >
                  <input type="hidden" name="serviceId" value={service.id} />
                  <input type="hidden" name="languageCode" value={locale} />
                  <p className="text-muted text-xs font-semibold uppercase">
                    {locale}
                    {translation ? (
                      <span className="ml-2 normal-case">
                        ({translation.state})
                      </span>
                    ) : null}
                  </p>
                  <Field label="Name">
                    <TextInput
                      name="name"
                      required
                      defaultValue={translation?.name ?? ""}
                    />
                  </Field>
                  <Field label="Short description">
                    <TextArea
                      name="shortDescription"
                      rows={2}
                      defaultValue={translation?.shortDescription ?? ""}
                    />
                  </Field>
                  <Field label="Instructions">
                    <TextArea
                      name="instructions"
                      rows={2}
                      defaultValue={translation?.instructions ?? ""}
                    />
                  </Field>
                  <div>
                    <Button variant="secondary">Save {locale}</Button>
                  </div>
                </form>
              );
            })}
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Weekly schedule">
            {rules.length === 0 ? (
              <EmptyState>
                No hours yet — the public page cannot compute open/closed.
              </EmptyState>
            ) : (
              <ul className="divide-line mb-3 divide-y">
                {rules.map((rule) => (
                  <li
                    key={rule.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span>
                      {weekdayName(rule.weekday)}{" "}
                      <span className="tabular-nums">
                        {rule.startTime.slice(0, 5)}–{rule.endTime.slice(0, 5)}
                      </span>
                    </span>
                    <form action={deleteScheduleRule}>
                      <input type="hidden" name="id" value={rule.id} />
                      <input
                        type="hidden"
                        name="serviceId"
                        value={service.id}
                      />
                      <Button variant="ghost">Remove</Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form
              action={addScheduleRule}
              className="flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="serviceId" value={service.id} />
              <Field label="Day">
                <Select name="weekday" defaultValue="1">
                  {WEEKDAYS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="From">
                <TextInput name="startTime" type="time" required />
              </Field>
              <Field label="To">
                <TextInput name="endTime" type="time" required />
              </Field>
              <Button variant="secondary">Add hours</Button>
            </form>
          </Card>

          <Card title="Exceptions">
            {exceptions.length === 0 ? (
              <EmptyState>No exceptions.</EmptyState>
            ) : (
              <ul className="divide-line mb-3 divide-y">
                {exceptions.map((exception) => (
                  <li
                    key={exception.id}
                    className="flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span>
                      <span className="tabular-nums">{exception.date}</span>{" "}
                      <Chip
                        tone={
                          exception.kind === "exceptional_opening"
                            ? "ok"
                            : exception.kind === "uncertain"
                              ? "warn"
                              : "danger"
                        }
                      >
                        {exception.kind}
                      </Chip>
                      {exception.reason ? (
                        <span className="text-muted ml-2 text-xs">
                          {exception.reason}
                        </span>
                      ) : null}
                    </span>
                    <form action={deleteScheduleException}>
                      <input type="hidden" name="id" value={exception.id} />
                      <input
                        type="hidden"
                        name="serviceId"
                        value={service.id}
                      />
                      <Button variant="ghost">Remove</Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form
              action={addScheduleException}
              className="flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="serviceId" value={service.id} />
              <Field label="Date">
                <TextInput name="date" type="date" required />
              </Field>
              <Field label="Kind">
                <Select name="kind" defaultValue="closure">
                  <option value="closure">closure</option>
                  <option value="cancellation">cancellation</option>
                  <option value="exceptional_opening">
                    exceptional opening
                  </option>
                  <option value="uncertain">uncertain</option>
                </Select>
              </Field>
              <Field label="Public reason (fr)">
                <TextInput name="reasonFr" />
              </Field>
              <Button variant="secondary">Add exception</Button>
            </form>
          </Card>
        </div>

        <Card title="Providing organisations">
          <ul className="divide-line mb-3 divide-y">
            {providers.map((provider) => (
              <li
                key={provider.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span>
                  {provider.org ?? "?"}{" "}
                  {!provider.active ? (
                    <Chip tone="neutral">inactive</Chip>
                  ) : null}
                </span>
                {providers.length > 1 ? (
                  <form action={removeProvider}>
                    <input type="hidden" name="id" value={provider.id} />
                    <input type="hidden" name="serviceId" value={service.id} />
                    <Button variant="ghost">Remove</Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {addableOrgs.length > 0 ? (
            <form action={addProvider} className="flex items-end gap-2">
              <input type="hidden" name="serviceId" value={service.id} />
              <Field label="Add provider">
                <Select name="organizationId">
                  {addableOrgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button variant="secondary">Add</Button>
            </form>
          ) : null}
        </Card>
      </div>
    </>
  );
}
