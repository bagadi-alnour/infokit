import Link from "next/link";
import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";

import { loadCatalog } from "@calais/shared/i18n/catalogs";
import { PendingButton } from "~/components/pending-button";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  FreshnessDot,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from "~/components/ui";
import { db } from "~/server/db";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { freshnessOf, isSameParisDay, parisToday } from "~/lib/freshness";
import {
  audienceCategories,
  organizations,
  places,
  placeTranslations,
  scheduleRules,
  serviceCategories,
  serviceTranslations,
  services,
} from "~/server/db/schema";
import { confirmServiceToday } from "../actions";
import { createService } from "./actions";

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const orgs = await db
    .select({ id: organizations.id, name: organizations.displayName })
    .from(organizations)
    .orderBy(organizations.displayName);
  const categories = await db
    .select({ id: serviceCategories.id, code: serviceCategories.code })
    .from(serviceCategories)
    .orderBy(serviceCategories.displayOrder);
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

  const rows = await db
    .select({
      id: services.id,
      published: services.published,
      manualStatus: services.manualStatus,
      lastVerifiedAt: services.lastVerifiedAt,
      reviewDueAt: services.reviewDueAt,
      name: serviceTranslations.name,
      org: organizations.displayName,
      categoryCode: serviceCategories.code,
    })
    .from(services)
    .leftJoin(
      serviceTranslations,
      and(
        eq(serviceTranslations.serviceId, services.id),
        eq(serviceTranslations.languageCode, "fr"),
      ),
    )
    .leftJoin(organizations, eq(services.organizationId, organizations.id))
    .leftJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
    .orderBy(desc(services.createdAt));

  const common = await loadCatalog(locale, "common");
  const today = parisToday();
  const scheduledToday = new Set(
    (
      await db
        .select({ serviceId: scheduleRules.serviceId })
        .from(scheduleRules)
        .where(
          and(
            eq(scheduleRules.weekday, today.weekday),
            or(
              isNull(scheduleRules.validFrom),
              lte(scheduleRules.validFrom, today.isoDate),
            ),
            or(
              isNull(scheduleRules.validTo),
              gte(scheduleRules.validTo, today.isoDate),
            ),
          ),
        )
    ).map((row) => row.serviceId),
  );

  return (
    <>
      <PageHeader
        title="Services"
        sub="One record per distinct offering: breakfast, lunch, shower, shoes… each with its own schedule and status."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card title={`All services (${String(rows.length)})`}>
          {rows.length === 0 ? (
            <EmptyState>
              No services yet — create the first one from an organisation public
              channel and record the source.
            </EmptyState>
          ) : (
            <ul className="divide-line divide-y">
              {rows.map((service) => {
                const freshness = freshnessOf(service);
                const isToday = scheduledToday.has(service.id);
                const confirmable =
                  isToday && !isSameParisDay(service.lastVerifiedAt);
                return (
                  <li
                    key={service.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5"
                  >
                    <Link
                      href={localizedPath(
                        `/dashboard/services/${service.id}`,
                        locale,
                      )}
                      className="min-w-0"
                    >
                      <p className="text-sm font-medium hover:underline">
                        {service.name ?? "(no name)"}
                      </p>
                      <p className="text-muted text-xs">
                        {[service.org, service.categoryCode]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </Link>
                    <span className="flex items-center gap-1.5">
                      <FreshnessDot
                        state={freshness}
                        label={common[`fresh.${freshness}`]}
                      />
                      {isToday ? (
                        <Chip tone="accent">{common["today.scheduled"]}</Chip>
                      ) : null}
                      {service.manualStatus !== "normal" ? (
                        <Chip
                          tone={
                            service.manualStatus === "cancelled"
                              ? "danger"
                              : "warn"
                          }
                        >
                          {service.manualStatus}
                        </Chip>
                      ) : null}
                      <Chip tone={service.published ? "ok" : "neutral"}>
                        {service.published ? "published" : "draft"}
                      </Chip>
                      {confirmable ? (
                        <form action={confirmServiceToday}>
                          <input type="hidden" name="locale" value={locale} />
                          <input
                            type="hidden"
                            name="serviceId"
                            value={service.id}
                          />
                          <PendingButton variant="secondary">
                            {common["action.confirmToday"]}
                          </PendingButton>
                        </form>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="New service">
          {orgs.length === 0 ? (
            <EmptyState>Create an organisation first.</EmptyState>
          ) : (
            <form action={createService} className="grid gap-3">
              <Field label="Organisation (custodian + first provider)">
                <Select name="organizationId" required>
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Category">
                <Select name="categoryId" required>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.code}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Audience">
                <Select name="audienceCategoryId" required>
                  {audiences.map((audience) => (
                    <option key={audience.id} value={audience.id}>
                      {audience.code}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Place" hint="Optional — add places first if needed">
                <Select name="placeId" defaultValue="">
                  <option value="">—</option>
                  {placeRows.map((place) => (
                    <option key={place.id} value={place.id}>
                      {place.name ?? place.id.slice(0, 8)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Name (français)">
                <TextInput name="nameFr" required minLength={2} />
              </Field>
              <Field label="Name (English)" hint="Optional">
                <TextInput name="nameEn" />
              </Field>
              <Field label="Name (العربية)" hint="Optional">
                <TextInput name="nameAr" dir="rtl" />
              </Field>
              <Field
                label="Source note"
                hint="Where does this information come from?"
              >
                <TextArea name="sourceNote" rows={2} />
              </Field>
              <Button>Create service</Button>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
