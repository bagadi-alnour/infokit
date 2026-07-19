import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";

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
import {
  audienceCategories,
  organizations,
  places,
  placeTranslations,
  serviceCategories,
  serviceTranslations,
  services,
} from "~/server/db/schema";
import { createService } from "./actions";

export default async function ServicesPage() {
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
              {rows.map((service) => (
                <li key={service.id} className="py-2.5">
                  <Link
                    href={`/dashboard/services/${service.id}`}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {service.name ?? "(no name)"}
                      </p>
                      <p className="text-muted text-xs">
                        {[service.org, service.categoryCode]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span className="flex gap-1.5">
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
                      {service.lastVerifiedAt === null ? (
                        <Chip tone="warn">unverified</Chip>
                      ) : null}
                      <Chip tone={service.published ? "ok" : "neutral"}>
                        {service.published ? "published" : "draft"}
                      </Chip>
                    </span>
                  </Link>
                </li>
              ))}
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
