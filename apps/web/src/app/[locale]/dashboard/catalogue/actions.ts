"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { type AnyPgColumn, type PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import { type Locale } from "@calais/shared/i18n";

import { getActionLocale } from "~/i18n/request-locale";
import { localizedPath } from "~/i18n/routing";
import { recordAudit } from "~/server/audit";
import { requireEditor } from "~/server/auth/require";
import { getRoleTestState } from "~/server/auth/authorization";
import {
  catalogueScopeKey,
  isCatalogueNameConflict,
} from "~/server/content/catalogue-scope";
import { db } from "~/server/db";
import {
  activityServices,
  activityTags,
  editorialEntryTags,
  editorialRelatedServices,
  serviceCategories,
  serviceCategoryTranslations,
  services,
  serviceTranslations,
  tags,
  tagTranslations,
} from "~/server/db/schema";

/**
 * Catalogue mutations. Two scopes, two permissions: platform-wide rows need
 * `taxonomy.manage`; an association's own rows need `content.activity.manage`.
 * Categories are platform-only, so they always require `taxonomy.manage`.
 */

const scopeSchema = z.enum(["global", "org"]);

const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

/** Read a form field, falling back when it is absent or blank. */
function field(formData: FormData, name: string, fallback: string): string {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

const nameSchema = z.string().trim().min(2);
const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "lowercase letters, digits, _ or -");

function refresh(locale: Locale) {
  revalidatePath(localizedPath("/dashboard/catalogue", locale));
  revalidatePath(localizedPath("/dashboard/activities", locale));
}

async function writeCatalogueName<T>(
  locale: Locale,
  write: () => Promise<T>,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isCatalogueNameConflict(error)) {
      redirect(
        `${localizedPath("/dashboard/catalogue", locale)}?notice=duplicate-name`,
      );
    }
    throw error;
  }
}

/**
 * Mirror of `protectedPermissionAction`: a superadmin role test must carry the
 * permission for the chosen scope; real editors pass through to their RBAC.
 * Returns the resolved organisation id for org-scoped writes (null otherwise).
 */
async function guardScope(
  formData: FormData,
): Promise<{ locale: Locale; organizationId: string | null }> {
  const locale = await getActionLocale(formData.get("locale"));
  const scope = scopeSchema.parse(formData.get("scope") ?? "global");
  const permission =
    scope === "global" ? "taxonomy.manage" : "content.activity.manage";
  const user = await requireEditor(locale);
  const authorization = await getRoleTestState(user.id);
  if (
    authorization.isSuperadmin &&
    !authorization.effectivePermissions.has(permission)
  ) {
    redirect(
      `${localizedPath("/dashboard/catalogue", locale)}?notice=permission-denied`,
    );
  }
  const organizationId =
    scope === "org"
      ? z.string().uuid().parse(formData.get("organizationId"))
      : null;
  return { locale, organizationId };
}

/** How many rows in `table` reference `id` through `column`. */
async function countReferences(
  table: PgTable,
  column: AnyPgColumn,
  id: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(table)
    .where(eq(column, id));
  return row?.n ?? 0;
}

/** Deletion is only offered for unused rows; bounce back with a notice if not. */
function blockIfUsed(locale: Locale, used: number) {
  if (used > 0) {
    redirect(`${localizedPath("/dashboard/catalogue", locale)}?notice=in-use`);
  }
}

async function upsertTranslations(
  languageValues: { fr: string; en: string | null; ar: string | null },
  write: (languageCode: string, value: string) => Promise<void>,
) {
  const entries: [string, string | null][] = [
    ["fr", languageValues.fr],
    ["en", languageValues.en],
    ["ar", languageValues.ar],
  ];
  for (const [languageCode, value] of entries) {
    if (value === null) continue;
    await write(languageCode, value);
  }
}

/* -------------------------------- services -------------------------------- */

export async function createService(formData: FormData) {
  const { locale, organizationId } = await guardScope(formData);
  const scopeKey = catalogueScopeKey(organizationId);
  const parsed = z
    .object({
      nameFr: nameSchema,
      nameEn: optional,
      nameAr: optional,
      code: optional.pipe(codeSchema.nullable()),
      icon: z.string().trim().min(1).max(50).default("help"),
      categoryId: z.string().uuid(),
    })
    .parse({
      nameFr: formData.get("nameFr"),
      nameEn: formData.get("nameEn") ?? "",
      nameAr: formData.get("nameAr") ?? "",
      code: formData.get("code") ?? "",
      icon: field(formData, "icon", "circle-help"),
      categoryId: formData.get("categoryId"),
    });

  const service = await writeCatalogueName(locale, () =>
    db.transaction(async (tx) => {
      const [created] = await tx
        .insert(services)
        .values({
          organizationId,
          code: parsed.code,
          icon: parsed.icon,
          categoryId: parsed.categoryId,
        })
        .returning({ id: services.id });
      if (!created) throw new Error("Service insert returned no row");

      await upsertTranslations(
        { fr: parsed.nameFr, en: parsed.nameEn, ar: parsed.nameAr },
        async (languageCode, name) => {
          await tx
            .insert(serviceTranslations)
            .values({ serviceId: created.id, scopeKey, languageCode, name })
            .onConflictDoUpdate({
              target: [
                serviceTranslations.serviceId,
                serviceTranslations.languageCode,
              ],
              set: { scopeKey, name },
            });
        },
      );
      return created;
    }),
  );

  await recordAudit({
    action: "service.created",
    subjectType: "service",
    subjectId: service.id,
    organizationId,
  });
  refresh(locale);
}

export async function updateService(formData: FormData) {
  // Scope comes from the row (global vs org), so the same permission split as
  // creation applies: superadmin for platform rows, the org for its own.
  const { locale, organizationId } = await guardScope(formData);
  const serviceId = z.string().uuid().parse(formData.get("serviceId"));
  const parsed = z
    .object({
      nameFr: nameSchema,
      icon: z.string().trim().min(1).max(50),
      categoryId: z.string().uuid(),
    })
    .parse({
      nameFr: formData.get("nameFr"),
      icon: field(formData, "icon", "circle-help"),
      categoryId: formData.get("categoryId"),
    });

  const [owned] = await db
    .select({ organizationId: services.organizationId })
    .from(services)
    .where(eq(services.id, serviceId))
    .limit(1);
  if (owned?.organizationId !== organizationId) {
    throw new Error("The service scope cannot be changed");
  }
  const scopeKey = catalogueScopeKey(owned.organizationId);
  await writeCatalogueName(locale, () =>
    db.transaction(async (tx) => {
      await tx
        .update(services)
        .set({ icon: parsed.icon, categoryId: parsed.categoryId })
        .where(eq(services.id, serviceId));
      await tx
        .insert(serviceTranslations)
        .values({
          serviceId,
          scopeKey,
          languageCode: "fr",
          name: parsed.nameFr,
        })
        .onConflictDoUpdate({
          target: [
            serviceTranslations.serviceId,
            serviceTranslations.languageCode,
          ],
          set: { scopeKey, name: parsed.nameFr },
        });
    }),
  );

  await recordAudit({
    action: "service.updated",
    subjectType: "service",
    subjectId: serviceId,
  });
  refresh(locale);
}

export async function deleteService(formData: FormData) {
  const { locale } = await guardScope(formData);
  const serviceId = z.string().uuid().parse(formData.get("serviceId"));
  const used =
    (await countReferences(
      activityServices,
      activityServices.serviceId,
      serviceId,
    )) +
    (await countReferences(
      editorialRelatedServices,
      editorialRelatedServices.serviceId,
      serviceId,
    ));
  blockIfUsed(locale, used);
  await db.delete(services).where(eq(services.id, serviceId));
  await recordAudit({
    action: "service.deleted",
    subjectType: "service",
    subjectId: serviceId,
  });
  refresh(locale);
}

export async function setServiceActive(formData: FormData) {
  const { locale } = await guardScope(formData);
  const serviceId = z.string().uuid().parse(formData.get("serviceId"));
  const active = formData.get("active") === "true";
  await db.update(services).set({ active }).where(eq(services.id, serviceId));
  await recordAudit({
    action: active ? "service.activated" : "service.deactivated",
    subjectType: "service",
    subjectId: serviceId,
  });
  refresh(locale);
}

/* ------------------------------- categories ------------------------------- */

export async function createCategory(formData: FormData) {
  // Categories are platform-only; force the global scope regardless of input.
  formData.set("scope", "global");
  const { locale } = await guardScope(formData);
  const parsed = z
    .object({
      code: codeSchema.max(50),
      icon: z.string().trim().min(1).max(50).default("help"),
      labelFr: nameSchema,
      labelEn: optional,
      labelAr: optional,
    })
    .parse({
      code: formData.get("code"),
      icon: field(formData, "icon", "circle-help"),
      labelFr: formData.get("labelFr"),
      labelEn: formData.get("labelEn") ?? "",
      labelAr: formData.get("labelAr") ?? "",
    });

  const category = await writeCatalogueName(locale, () =>
    db.transaction(async (tx) => {
      const [created] = await tx
        .insert(serviceCategories)
        .values({
          code: parsed.code,
          icon: parsed.icon,
          colorToken: parsed.code,
        })
        .returning({ id: serviceCategories.id });
      if (!created) throw new Error("Category insert returned no row");

      await upsertTranslations(
        { fr: parsed.labelFr, en: parsed.labelEn, ar: parsed.labelAr },
        async (languageCode, label) => {
          await tx
            .insert(serviceCategoryTranslations)
            .values({ categoryId: created.id, languageCode, label })
            .onConflictDoUpdate({
              target: [
                serviceCategoryTranslations.categoryId,
                serviceCategoryTranslations.languageCode,
              ],
              set: { label },
            });
        },
      );
      return created;
    }),
  );

  await recordAudit({
    action: "service_category.created",
    subjectType: "service_category",
    subjectId: category.id,
  });
  refresh(locale);
}

export async function setCategoryEnabled(formData: FormData) {
  formData.set("scope", "global");
  const { locale } = await guardScope(formData);
  const categoryId = z.string().uuid().parse(formData.get("categoryId"));
  const enabled = formData.get("enabled") === "true";
  await db
    .update(serviceCategories)
    .set({ enabled })
    .where(eq(serviceCategories.id, categoryId));
  await recordAudit({
    action: enabled ? "service_category.enabled" : "service_category.disabled",
    subjectType: "service_category",
    subjectId: categoryId,
  });
  refresh(locale);
}

export async function updateCategory(formData: FormData) {
  formData.set("scope", "global");
  const { locale } = await guardScope(formData);
  const categoryId = z.string().uuid().parse(formData.get("categoryId"));
  const parsed = z
    .object({
      labelFr: nameSchema,
      icon: z.string().trim().min(1).max(50),
    })
    .parse({
      labelFr: formData.get("labelFr"),
      icon: field(formData, "icon", "circle-help"),
    });

  await writeCatalogueName(locale, () =>
    db.transaction(async (tx) => {
      await tx
        .update(serviceCategories)
        .set({ icon: parsed.icon })
        .where(eq(serviceCategories.id, categoryId));
      await tx
        .insert(serviceCategoryTranslations)
        .values({ categoryId, languageCode: "fr", label: parsed.labelFr })
        .onConflictDoUpdate({
          target: [
            serviceCategoryTranslations.categoryId,
            serviceCategoryTranslations.languageCode,
          ],
          set: { label: parsed.labelFr },
        });
    }),
  );

  await recordAudit({
    action: "service_category.updated",
    subjectType: "service_category",
    subjectId: categoryId,
  });
  refresh(locale);
}

export async function deleteCategory(formData: FormData) {
  formData.set("scope", "global");
  const { locale } = await guardScope(formData);
  const categoryId = z.string().uuid().parse(formData.get("categoryId"));
  const used = await countReferences(services, services.categoryId, categoryId);
  blockIfUsed(locale, used);
  await db
    .delete(serviceCategories)
    .where(eq(serviceCategories.id, categoryId));
  await recordAudit({
    action: "service_category.deleted",
    subjectType: "service_category",
    subjectId: categoryId,
  });
  refresh(locale);
}

/* ---------------------------------- tags ---------------------------------- */

export async function createTag(formData: FormData) {
  const { locale, organizationId } = await guardScope(formData);
  const scopeKey = catalogueScopeKey(organizationId);
  const parsed = z
    .object({
      labelFr: nameSchema,
      labelEn: optional,
      labelAr: optional,
      code: codeSchema,
      namespace: z.string().trim().min(1).max(60).default("topic"),
      colorToken: z.string().trim().min(1).max(60).default("neutral"),
      visibility: z.enum(["public", "workspace"]),
    })
    .parse({
      labelFr: formData.get("labelFr"),
      labelEn: formData.get("labelEn") ?? "",
      labelAr: formData.get("labelAr") ?? "",
      code: formData.get("code"),
      namespace: field(formData, "namespace", "topic"),
      colorToken: field(formData, "colorToken", "neutral"),
      visibility: formData.get("visibility") ?? "public",
    });

  const tag = await writeCatalogueName(locale, () =>
    db.transaction(async (tx) => {
      const [created] = await tx
        .insert(tags)
        .values({
          organizationId,
          namespace: parsed.namespace,
          code: parsed.code,
          colorToken: parsed.colorToken,
          visibility: parsed.visibility,
        })
        .returning({ id: tags.id });
      if (!created) throw new Error("Tag insert returned no row");

      await upsertTranslations(
        { fr: parsed.labelFr, en: parsed.labelEn, ar: parsed.labelAr },
        async (languageCode, label) => {
          await tx
            .insert(tagTranslations)
            .values({ tagId: created.id, scopeKey, languageCode, label })
            .onConflictDoUpdate({
              target: [tagTranslations.tagId, tagTranslations.languageCode],
              set: { scopeKey, label },
            });
        },
      );
      return created;
    }),
  );

  await recordAudit({
    action: "tag.created",
    subjectType: "tag",
    subjectId: tag.id,
    organizationId,
  });
  refresh(locale);
}

export async function setTagActive(formData: FormData) {
  const { locale } = await guardScope(formData);
  const tagId = z.string().uuid().parse(formData.get("tagId"));
  const active = formData.get("active") === "true";
  await db.update(tags).set({ active }).where(eq(tags.id, tagId));
  await recordAudit({
    action: active ? "tag.activated" : "tag.deactivated",
    subjectType: "tag",
    subjectId: tagId,
  });
  refresh(locale);
}

export async function updateTag(formData: FormData) {
  const { locale, organizationId } = await guardScope(formData);
  const tagId = z.string().uuid().parse(formData.get("tagId"));
  const parsed = z
    .object({
      labelFr: nameSchema,
      namespace: z.string().trim().min(1).max(60),
      colorToken: z.string().trim().min(1).max(60),
      visibility: z.enum(["public", "workspace"]),
    })
    .parse({
      labelFr: formData.get("labelFr"),
      namespace: field(formData, "namespace", "topic"),
      colorToken: field(formData, "colorToken", "neutral"),
      visibility: formData.get("visibility") ?? "public",
    });

  const [owned] = await db
    .select({ organizationId: tags.organizationId })
    .from(tags)
    .where(eq(tags.id, tagId))
    .limit(1);
  if (owned?.organizationId !== organizationId) {
    throw new Error("The tag scope cannot be changed");
  }
  const scopeKey = catalogueScopeKey(owned.organizationId);
  await writeCatalogueName(locale, () =>
    db.transaction(async (tx) => {
      await tx
        .update(tags)
        .set({
          namespace: parsed.namespace,
          colorToken: parsed.colorToken,
          visibility: parsed.visibility,
        })
        .where(eq(tags.id, tagId));
      await tx
        .insert(tagTranslations)
        .values({
          tagId,
          scopeKey,
          languageCode: "fr",
          label: parsed.labelFr,
        })
        .onConflictDoUpdate({
          target: [tagTranslations.tagId, tagTranslations.languageCode],
          set: { scopeKey, label: parsed.labelFr },
        });
    }),
  );

  await recordAudit({
    action: "tag.updated",
    subjectType: "tag",
    subjectId: tagId,
  });
  refresh(locale);
}

export async function deleteTag(formData: FormData) {
  const { locale } = await guardScope(formData);
  const tagId = z.string().uuid().parse(formData.get("tagId"));
  const used =
    (await countReferences(activityTags, activityTags.tagId, tagId)) +
    (await countReferences(
      editorialEntryTags,
      editorialEntryTags.tagId,
      tagId,
    ));
  blockIfUsed(locale, used);
  await db.delete(tags).where(eq(tags.id, tagId));
  await recordAudit({
    action: "tag.deleted",
    subjectType: "tag",
    subjectId: tagId,
  });
  refresh(locale);
}
