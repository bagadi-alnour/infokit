"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import { editorialLanguageCodes } from "~/lib/editorial-languages";
import { recordAudit } from "~/server/audit";
import { createAssetUploadUrl, verifyAssetUpload } from "~/server/assets/s3";
import { auth } from "~/server/auth";
import { protectedPermissionAction } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  assets,
  assetTranslations,
  editorialEntries,
  editorialEntryAssets,
} from "~/server/db/schema";

const permittedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

const imageUploadSchema = z.object({
  mimeType: z.enum(permittedImageTypes),
  byteSize: z.coerce
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
  languageCode: z.enum(editorialLanguageCodes),
  altText: z.string().trim().min(1).max(500),
  rightsConfirmed: z.literal("true"),
});

export const createArticleImageUpload = protectedPermissionAction(
  "content.article.write",
  async (formData) => {
    const parsed = imageUploadSchema.parse({
      mimeType: formData.get("mimeType"),
      byteSize: formData.get("byteSize"),
      languageCode: formData.get("languageCode"),
      altText: formData.get("altText"),
      rightsConfirmed: formData.get("rightsConfirmed"),
    });
    const session = await auth();
    if (!session?.user.id) throw new Error("Authentication required");

    const assetId = crypto.randomUUID();
    const storageKey = `uploads/articles/${assetId}/original`;
    const uploadUrl = await createAssetUploadUrl({
      storageKey,
      mimeType: parsed.mimeType,
      byteSize: parsed.byteSize,
      assetId,
    });
    await db.transaction(async (tx) => {
      await tx.insert(assets).values({
        id: assetId,
        uploaderId: session.user.id,
        languageCode: parsed.languageCode,
        storageKey,
        mimeType: parsed.mimeType,
        byteSize: parsed.byteSize,
        kind: "image",
        visibility: "workspace",
        scanState: "pending",
        rightsConfirmed: true,
      });
      await tx.insert(assetTranslations).values({
        assetId,
        languageCode: parsed.languageCode,
        altText: parsed.altText,
        decorative: false,
        state: "draft",
      });
    });
    return { assetId, uploadUrl };
  },
);

const coverSchema = z.object({
  locale: z.enum(["fr", "en", "ar"]),
  entryId: z.string().uuid(),
  assetId: z.string().uuid(),
});

export const setArticleCoverImage = protectedPermissionAction(
  "content.article.write",
  async (formData) => {
    const parsed = coverSchema.parse({
      locale: formData.get("locale"),
      entryId: formData.get("entryId"),
      assetId: formData.get("assetId"),
    });
    const session = await auth();
    if (!session?.user.id) throw new Error("Authentication required");
    const [uploadedAsset] = await db
      .select({
        storageKey: assets.storageKey,
        mimeType: assets.mimeType,
        byteSize: assets.byteSize,
      })
      .from(assets)
      .where(
        and(
          eq(assets.id, parsed.assetId),
          eq(assets.uploaderId, session.user.id),
          eq(assets.kind, "image"),
          eq(assets.rightsConfirmed, true),
          isNull(assets.archivedAt),
        ),
      )
      .limit(1);
    if (!uploadedAsset) throw new Error("The cover image is unavailable");
    await verifyAssetUpload(uploadedAsset);

    await db.transaction(async (tx) => {
      const [entry] = await tx
        .select({ id: editorialEntries.id })
        .from(editorialEntries)
        .where(
          and(
            eq(editorialEntries.id, parsed.entryId),
            eq(editorialEntries.kind, "article"),
          ),
        )
        .limit(1);
      if (!entry) throw new Error("Unknown article");
      await tx
        .delete(editorialEntryAssets)
        .where(
          and(
            eq(editorialEntryAssets.entryId, parsed.entryId),
            eq(editorialEntryAssets.role, "cover"),
          ),
        );
      await tx.insert(editorialEntryAssets).values({
        entryId: parsed.entryId,
        assetId: parsed.assetId,
        role: "cover",
      });
    });
    await recordAudit({
      action: "article.cover_set",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
    });
    revalidatePath(localizedPath("/dashboard/articles", parsed.locale));
  },
);

const removeCoverSchema = coverSchema.omit({ assetId: true });

export const removeArticleCoverImage = protectedPermissionAction(
  "content.article.write",
  async (formData) => {
    const parsed = removeCoverSchema.parse({
      locale: formData.get("locale"),
      entryId: formData.get("entryId"),
    });
    await db
      .delete(editorialEntryAssets)
      .where(
        and(
          eq(editorialEntryAssets.entryId, parsed.entryId),
          eq(editorialEntryAssets.role, "cover"),
        ),
      );
    await recordAudit({
      action: "article.cover_removed",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
    });
    revalidatePath(localizedPath("/dashboard/articles", parsed.locale));
  },
);
