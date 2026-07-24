"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import { recordAudit } from "~/server/audit";
import { auth } from "~/server/auth";
import { hasActualPlatformPermission } from "~/server/auth/authorization";
import { protectedPermissionAction } from "~/server/auth/require";
import { catalogueScopeKey } from "~/server/content/catalogue-scope";
import { hashContent } from "~/server/content/editorial";
import { db } from "~/server/db";
import { organizations, tags, tagTranslations } from "~/server/db/schema";

const tagSchema = z.object({
  label: z.string().trim().min(1).max(120),
  organizationId: z
    .union([z.literal(""), z.string().uuid()])
    .transform((value) => value || null),
});

function tagCode(label: string) {
  const normalized = label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
  return normalized || `tag-${hashContent(label).slice(0, 10)}`;
}

async function requireGlobalTagManager() {
  const actor = await auth();
  if (
    !actor?.user.id ||
    !(await hasActualPlatformPermission(actor.user.id, "support.superadmin"))
  ) {
    throw new Error("Only a superadmin can manage global tags");
  }
  return actor.user.id;
}

export const createArticleTag = protectedPermissionAction(
  "content.article.write",
  async (formData, locale) => {
    const parsed = tagSchema.parse({
      label: formData.get("label"),
      organizationId: formData.get("organizationId") ?? "",
    });

    if (!parsed.organizationId) {
      await requireGlobalTagManager();
    }

    if (parsed.organizationId) {
      const [organization] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, parsed.organizationId))
        .limit(1);
      if (!organization) throw new Error("Invalid tag owner");
    }

    const code = tagCode(parsed.label);
    const createdTag = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(tags)
        .values({
          organizationId: parsed.organizationId,
          namespace: "topic",
          code,
          visibility: "public",
        })
        .onConflictDoNothing()
        .returning({ id: tags.id });

      const tag =
        inserted ??
        (
          await tx
            .select({ id: tags.id })
            .from(tags)
            .where(
              and(
                parsed.organizationId
                  ? eq(tags.organizationId, parsed.organizationId)
                  : isNull(tags.organizationId),
                eq(tags.namespace, "topic"),
                eq(tags.code, code),
              ),
            )
            .limit(1)
        )[0];
      if (!tag) throw new Error("Tag insert returned no row");

      await tx
        .insert(tagTranslations)
        .values({
          tagId: tag.id,
          scopeKey: catalogueScopeKey(parsed.organizationId),
          languageCode: locale,
          label: parsed.label,
        })
        .onConflictDoUpdate({
          target: [tagTranslations.tagId, tagTranslations.languageCode],
          set: {
            scopeKey: catalogueScopeKey(parsed.organizationId),
            label: parsed.label,
          },
        });

      const [translation] = await tx
        .select({ label: tagTranslations.label })
        .from(tagTranslations)
        .where(
          and(
            eq(tagTranslations.tagId, tag.id),
            eq(tagTranslations.languageCode, locale),
          ),
        )
        .limit(1);

      return {
        id: tag.id,
        label: translation?.label ?? parsed.label,
        description: "topic",
        organizationId: parsed.organizationId,
      };
    });

    await recordAudit({
      action: "content.article_tag.created",
      subjectType: "core.tag",
      subjectId: createdTag.id,
      organizationId: parsed.organizationId,
      metadata: { code },
    });
    revalidatePath(localizedPath("/dashboard/articles/new", locale));
    return createdTag;
  },
);

const globalTagUpdateSchema = z.object({
  tagId: z.string().uuid(),
  label: z.string().trim().min(1).max(120),
});

export const updateGlobalTag = protectedPermissionAction(
  "content.article.write",
  async (formData, locale) => {
    await requireGlobalTagManager();
    const parsed = globalTagUpdateSchema.parse({
      tagId: formData.get("tagId"),
      label: formData.get("label"),
    });
    const [globalTag] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.id, parsed.tagId), isNull(tags.organizationId)))
      .limit(1);
    if (!globalTag) throw new Error("Unknown global tag");
    await db
      .insert(tagTranslations)
      .values({
        tagId: parsed.tagId,
        scopeKey: catalogueScopeKey(null),
        languageCode: locale,
        label: parsed.label,
      })
      .onConflictDoUpdate({
        target: [tagTranslations.tagId, tagTranslations.languageCode],
        set: { scopeKey: catalogueScopeKey(null), label: parsed.label },
      });
    await recordAudit({
      action: "content.global_tag.updated",
      subjectType: "core.tag",
      subjectId: parsed.tagId,
      metadata: { languageCode: locale },
    });
    revalidatePath(localizedPath("/dashboard/articles/new", locale));
  },
);

const globalTagLifecycleSchema = z.object({
  tagId: z.string().uuid(),
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const setGlobalTagActive = protectedPermissionAction(
  "content.article.write",
  async (formData, locale) => {
    await requireGlobalTagManager();
    const parsed = globalTagLifecycleSchema.parse({
      tagId: formData.get("tagId"),
      active: formData.get("active"),
    });
    const [updated] = await db
      .update(tags)
      .set({ active: parsed.active, updatedAt: new Date() })
      .where(and(eq(tags.id, parsed.tagId), isNull(tags.organizationId)))
      .returning({ id: tags.id });
    if (!updated) throw new Error("Unknown global tag");
    await recordAudit({
      action: parsed.active
        ? "content.global_tag.restored"
        : "content.global_tag.archived",
      subjectType: "core.tag",
      subjectId: parsed.tagId,
    });
    revalidatePath(localizedPath("/dashboard/articles/new", locale));
  },
);
