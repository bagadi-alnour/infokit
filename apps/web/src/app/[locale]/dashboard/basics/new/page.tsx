import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, asc, eq } from "drizzle-orm";

import {
  BasicInformationCreateForm,
  type BasicInformationOption,
} from "~/components/admin/basic-information-create-form";
import { WorkspacePage } from "~/components/admin/workspace";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { buildWorkspaceLabels } from "~/lib/workspace-labels";
import { db } from "~/server/db";
import { hasAiTranslationProvider } from "~/server/ai/provider";
import { auth } from "~/server/auth";
import { hasActualPlatformPermission } from "~/server/auth/authorization";
import { denyPageAccess, hasPermission } from "~/server/auth/require";
import { platformVerifyPermission } from "~/server/content/language-review";
import {
  cities,
  cityTranslations,
  organizations,
  serviceCategories,
  serviceCategoryTranslations,
} from "~/server/db/schema";

export default async function NewBasicInformationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const [labels, overviewLabels, session] = await Promise.all([
    loadPageCatalog(locale, "dashboard-basics"),
    loadPageCatalog(locale, "dashboard-overview"),
    auth(),
  ]);
  const editorLabels = buildWorkspaceLabels(overviewLabels, labels);
  /**
   * The form is refused to anyone `createBasicInformation` would refuse. That
   * wrapper reads platform grants only (server/auth/require.ts), so without this
   * grant the form has nothing to file the contact under, and its owner picker
   * would still have named every association on the way to the throw.
   */
  if (!(
    session?.user.id &&
    (await hasActualPlatformPermission(
      session.user.id,
      "content.basic_information.write",
    ))
  )) {
    await denyPageAccess("content.basic_information.write", locale);
  }
  /**
   * Whether the two publishing choices are offered at all.
   *
   * Nothing on a form that has never been saved has been read by anyone, so
   * publishing from it is the platform's own check being applied by the person
   * who holds it — and on this kind that check is a phone number nobody has
   * dialled. Everyone else sends the text up the review chain instead, and is
   * not shown a choice the server would refuse.
   */
  const canPublish = await hasPermission(platformVerifyPermission);

  const [organizationRows, cityRows, categoryRows] = await Promise.all([
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
    // The same taxonomy the activities are filed under, so a number and the
    // published activities answering the same need can sit together.
    db
      .select({
        id: serviceCategories.id,
        code: serviceCategories.code,
        label: serviceCategoryTranslations.label,
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
      .orderBy(
        asc(serviceCategories.displayOrder),
        asc(serviceCategories.code),
      ),
  ]);

  const organizationsForForm: BasicInformationOption[] = organizationRows;
  const citiesForForm: BasicInformationOption[] = cityRows.map((city) => ({
    id: city.id,
    label: city.label ?? city.code,
  }));
  const categoriesForForm: BasicInformationOption[] = categoryRows.map(
    (category) => ({
      id: category.id,
      label: category.label ?? category.code,
    }),
  );

  return (
    <WorkspacePage>
      <BasicInformationCreateForm
        locale={locale}
        basicsPath={localizedPath("/dashboard/basics", locale)}
        organizations={organizationsForForm}
        cities={citiesForForm}
        categories={categoriesForForm}
        labels={labels}
        editorLabels={editorLabels}
        aiEnabled={hasAiTranslationProvider()}
        canPublish={canPublish}
      />
    </WorkspacePage>
  );
}
