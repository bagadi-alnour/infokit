import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, eq } from "drizzle-orm";

import {
  ActivityCreateForm,
  type ActivityFormOption,
} from "~/components/admin/activity-create-form";
import { WorkspacePage } from "~/components/admin/workspace";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { EDITOR_CONTACT_OPTION_ID } from "~/lib/editor-contact";
import { hasAiTranslationProvider } from "~/server/ai/provider";
import { requireEditor } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  audienceCategories,
  audienceCategoryTranslations,
  cities,
  cityTranslations,
  contacts,
  contactTranslations,
  organizations,
  places,
  placeTranslations,
  serviceCategories,
  serviceCategoryTranslations,
  services,
  serviceTranslations,
  tags,
  tagTranslations,
} from "~/server/db/schema";

export default async function NewActivityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const [editor, labels, overviewLabels] = await Promise.all([
    requireEditor(locale),
    loadPageCatalog(locale, "dashboard-console"),
    loadPageCatalog(locale, "dashboard-overview"),
  ]);
  const [
    organizationRows,
    cityRows,
    placeRows,
    categoryRows,
    audienceRows,
    serviceRows,
    tagRows,
    contactRows,
  ] = await Promise.all([
    db
      .select({ id: organizations.id, label: organizations.displayName })
      .from(organizations)
      .orderBy(organizations.displayName),
    db
      .select({
        id: cities.id,
        code: cities.code,
        label: cityTranslations.name,
      })
      .from(cities)
      .leftJoin(
        cityTranslations,
        and(
          eq(cityTranslations.cityId, cities.id),
          eq(cityTranslations.languageCode, locale),
        ),
      )
      .where(eq(cities.active, true))
      .orderBy(cities.code),
    db
      .select({
        id: places.id,
        cityId: places.cityId,
        label: placeTranslations.name,
        address: places.addressLine,
        precision: places.precision,
      })
      .from(places)
      .leftJoin(
        placeTranslations,
        and(
          eq(placeTranslations.placeId, places.id),
          eq(placeTranslations.languageCode, locale),
        ),
      )
      .where(eq(places.active, true))
      .orderBy(placeTranslations.name),
    db
      .select({
        id: serviceCategories.id,
        code: serviceCategories.code,
        label: serviceCategoryTranslations.label,
        description: serviceCategoryTranslations.description,
      })
      .from(serviceCategories)
      .leftJoin(
        serviceCategoryTranslations,
        and(
          eq(serviceCategoryTranslations.categoryId, serviceCategories.id),
          eq(serviceCategoryTranslations.languageCode, locale),
        ),
      )
      .where(eq(serviceCategories.enabled, true))
      .orderBy(serviceCategories.displayOrder),
    db
      .select({
        id: audienceCategories.id,
        code: audienceCategories.code,
        label: audienceCategoryTranslations.label,
        description: audienceCategoryTranslations.explanation,
      })
      .from(audienceCategories)
      .leftJoin(
        audienceCategoryTranslations,
        and(
          eq(
            audienceCategoryTranslations.audienceCategoryId,
            audienceCategories.id,
          ),
          eq(audienceCategoryTranslations.languageCode, locale),
        ),
      )
      .where(eq(audienceCategories.enabled, true))
      .orderBy(audienceCategories.displayOrder),
    db
      .select({
        id: services.id,
        organizationId: services.organizationId,
        organizationName: organizations.displayName,
        icon: services.icon,
        label: serviceTranslations.name,
        description: serviceCategoryTranslations.label,
      })
      .from(services)
      .innerJoin(
        serviceCategories,
        eq(services.categoryId, serviceCategories.id),
      )
      .leftJoin(organizations, eq(services.organizationId, organizations.id))
      .leftJoin(
        serviceTranslations,
        and(
          eq(serviceTranslations.serviceId, services.id),
          eq(serviceTranslations.languageCode, locale),
        ),
      )
      .leftJoin(
        serviceCategoryTranslations,
        and(
          eq(serviceCategoryTranslations.categoryId, serviceCategories.id),
          eq(serviceCategoryTranslations.languageCode, locale),
        ),
      )
      .where(eq(services.active, true))
      .orderBy(serviceTranslations.name),
    db
      .select({
        id: tags.id,
        code: tags.code,
        namespace: tags.namespace,
        organizationId: tags.organizationId,
        organizationName: organizations.displayName,
        label: tagTranslations.label,
      })
      .from(tags)
      .leftJoin(organizations, eq(tags.organizationId, organizations.id))
      .leftJoin(
        tagTranslations,
        and(
          eq(tagTranslations.tagId, tags.id),
          eq(tagTranslations.languageCode, locale),
        ),
      )
      .where(and(eq(tags.active, true), eq(tags.visibility, "public")))
      .orderBy(asc(tags.displayOrder), asc(tags.code)),
    db
      .select({
        id: contacts.id,
        organizationId: contacts.organizationId,
        kind: contacts.kind,
        value: contacts.value,
        label: contactTranslations.label,
      })
      .from(contacts)
      .leftJoin(
        contactTranslations,
        and(
          eq(contactTranslations.contactId, contacts.id),
          eq(contactTranslations.languageCode, locale),
        ),
      )
      .where(and(eq(contacts.active, true), eq(contacts.visibility, "public")))
      .orderBy(contacts.displayOrder),
  ]);

  const editorLabels: Record<string, string> = {};
  for (const [key, value] of Object.entries(overviewLabels)) {
    if (key.startsWith("create.")) {
      editorLabels[key.replace(/^create\./, "")] = value;
    }
  }

  /**
   * The editor themselves, first in the contacts list.
   *
   * Most organisations here have published no contact at all, so the list is
   * empty and an activity gets filed that no reader can ask about. The person
   * entering it can always be asked; keeping the option publishes their sign-in
   * address, which the description says plainly before they choose it.
   */
  const editorEmail = editor.email?.trim();
  const editorName = editor.name?.trim() ?? "";
  const editorContact: ActivityFormOption | null = editorEmail
    ? {
        id: EDITOR_CONTACT_OPTION_ID,
        label: labels["activity.create.contactYou"].replace(
          "{name}",
          editorName.length > 0 ? editorName : editorEmail,
        ),
        description: `${editorEmail} · ${labels["activity.create.contactYouHint"]}`,
        organizationId: null,
      }
    : null;

  const option = (row: {
    id: string;
    label: string | null;
    code: string;
    description?: string | null;
  }): ActivityFormOption => ({
    id: row.id,
    label: row.label ?? row.code,
    description: row.description ?? undefined,
  });

  return (
    <WorkspacePage>
      <ActivityCreateForm
        locale={locale}
        activitiesPath={localizedPath("/dashboard/activities", locale)}
        organizations={organizationRows}
        cities={cityRows.map((row) => ({
          id: row.id,
          label: row.label ?? row.code,
        }))}
        places={placeRows.map((row) => ({
          id: row.id,
          label: row.label ?? row.address ?? labels["activities.untitled"],
          description: row.address ?? row.precision,
          cityId: row.cityId,
        }))}
        categories={categoryRows.map(option)}
        audiences={audienceRows.map(option)}
        services={serviceRows.map((row) => ({
          id: row.id,
          label: row.label ?? labels["service.untitled"],
          description: `${
            row.organizationId
              ? `${labels["scope.organization"]}: ${row.organizationName ?? ""}`
              : labels["scope.global"]
          }${row.description ? ` · ${row.description}` : ""}`,
          organizationId: row.organizationId,
          icon: row.icon,
        }))}
        tags={tagRows.map((row) => ({
          id: row.id,
          label: row.label ?? row.code,
          description: row.organizationId
            ? `${labels["scope.organization"]}: ${row.organizationName ?? ""}`
            : labels["scope.global"],
          organizationId: row.organizationId,
        }))}
        contacts={[
          ...(editorContact ? [editorContact] : []),
          ...contactRows.map((row) => ({
            id: row.id,
            label: row.label ?? row.value ?? row.kind,
            description: row.value ?? row.kind,
            organizationId: row.organizationId,
          })),
        ]}
        labels={labels}
        editorLabels={editorLabels}
        aiEnabled={hasAiTranslationProvider()}
      />
    </WorkspacePage>
  );
}
