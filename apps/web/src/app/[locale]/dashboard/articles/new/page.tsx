import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { and, asc, eq, isNull } from "drizzle-orm";

import {
  ArticleCreateForm,
  type ArticleFormOption,
} from "~/components/admin/article-create-form";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { hasActualPlatformPermission } from "~/server/auth/authorization";
import {
  cities,
  cityTranslations,
  organizations,
  tags,
  tagTranslations,
} from "~/server/db/schema";

export default async function NewArticlePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const labels = await loadPageCatalog(locale, "dashboard-articles");
  const session = await auth();
  const canManageGlobalTags = Boolean(
    session?.user.id &&
    (await hasActualPlatformPermission(session.user.id, "support.superadmin")),
  );

  const [organizationRows, cityRows, tagRows, globalTagRows] =
    await Promise.all([
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
          id: tags.id,
          code: tags.code,
          namespace: tags.namespace,
          organizationId: tags.organizationId,
          organizationName: organizations.displayName,
          label: tagTranslations.label,
          description: tagTranslations.description,
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
      canManageGlobalTags
        ? db
            .select({
              id: tags.id,
              code: tags.code,
              active: tags.active,
              label: tagTranslations.label,
            })
            .from(tags)
            .leftJoin(
              tagTranslations,
              and(
                eq(tagTranslations.tagId, tags.id),
                eq(tagTranslations.languageCode, locale),
              ),
            )
            .where(isNull(tags.organizationId))
            .orderBy(asc(tags.displayOrder), asc(tags.code))
        : Promise.resolve([]),
    ]);

  const organizationsForForm: ArticleFormOption[] = organizationRows;
  const citiesForForm: ArticleFormOption[] = cityRows.map((city) => ({
    id: city.id,
    label: city.label ?? city.code,
  }));
  const tagsForForm: ArticleFormOption[] = tagRows.map((tag) => ({
    id: tag.id,
    label: tag.label ?? tag.code,
    description: tag.organizationId
      ? `${labels["field.organization"]}: ${tag.organizationName ?? ""}`
      : labels["scope.platform"],
    organizationId: tag.organizationId,
  }));

  return (
    <div className="px-4 py-7 md:px-7 lg:px-8">
      <ArticleCreateForm
        locale={locale}
        articlesPath={localizedPath("/dashboard/articles", locale)}
        organizations={organizationsForForm}
        cities={citiesForForm}
        tags={tagsForForm}
        globalTags={globalTagRows.map((tag) => ({
          id: tag.id,
          label: tag.label ?? tag.code,
          active: tag.active,
        }))}
        canManageGlobalTags={canManageGlobalTags}
        labels={labels}
      />
    </div>
  );
}
