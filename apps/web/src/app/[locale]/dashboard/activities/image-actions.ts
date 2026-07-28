"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import { editorialLanguageCodes } from "~/lib/editorial-languages";
import { recordAudit } from "~/server/audit";
import { createAssetUploadUrl, verifyAssetUpload } from "~/server/assets/s3";
import { protectedPermissionAction } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  activities,
  activityAssets,
  assets,
  assetTranslations,
  downloads,
  downloadTranslations,
} from "~/server/db/schema";

function refreshActivity(locale: "fr" | "en" | "ar", activityId: string) {
  revalidatePath(
    `${localizedPath("/dashboard/activities", locale)}?activity=${activityId}`,
  );
}

const imageUploadSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]),
  byteSize: z.coerce
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
  languageCode: z.enum(editorialLanguageCodes),
  altText: z.string().trim().min(1).max(500),
  rightsConfirmed: z.literal("true"),
});

export const createActivityImageUpload = protectedPermissionAction(
  "content.activity.manage",
  async (formData, _locale, user) => {
    const parsed = imageUploadSchema.parse({
      mimeType: formData.get("mimeType"),
      byteSize: formData.get("byteSize"),
      languageCode: formData.get("languageCode"),
      altText: formData.get("altText"),
      rightsConfirmed: formData.get("rightsConfirmed"),
    });

    const assetId = crypto.randomUUID();
    const storageKey = `uploads/activities/${assetId}/original`;
    const uploadUrl = await createAssetUploadUrl({
      storageKey,
      mimeType: parsed.mimeType,
      byteSize: parsed.byteSize,
      assetId,
    });
    await db.transaction(async (tx) => {
      await tx.insert(assets).values({
        id: assetId,
        uploaderId: user.id,
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
  activityId: z.string().uuid(),
  assetId: z.string().uuid(),
});

/** Attach (or replace) an activity's cover image from an uploaded asset. */
export const setActivityCoverImage = protectedPermissionAction(
  "content.activity.manage",
  async (formData, _locale, user) => {
    const parsed = coverSchema.parse({
      locale: formData.get("locale"),
      activityId: formData.get("activityId"),
      assetId: formData.get("assetId"),
    });

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
          eq(assets.uploaderId, user.id),
          eq(assets.kind, "image"),
          eq(assets.rightsConfirmed, true),
          isNull(assets.archivedAt),
        ),
      )
      .limit(1);
    if (!uploadedAsset) throw new Error("The activity image is unavailable");
    await verifyAssetUpload(uploadedAsset);

    await db.transaction(async (tx) => {
      const [activity] = await tx
        .select({ sourceLanguage: activities.sourceLanguageCode })
        .from(activities)
        .where(eq(activities.id, parsed.activityId))
        .limit(1);
      if (!activity) throw new Error("Unknown activity");
      await tx
        .delete(activityAssets)
        .where(
          and(
            eq(activityAssets.activityId, parsed.activityId),
            eq(activityAssets.role, "cover"),
          ),
        );
      await tx.insert(activityAssets).values({
        activityId: parsed.activityId,
        assetId: parsed.assetId,
        role: "cover",
        languageCode: activity.sourceLanguage,
      });
    });
    await recordAudit({
      action: "activity.cover_set",
      subjectType: "activity",
      subjectId: parsed.activityId,
    });
    refreshActivity(parsed.locale, parsed.activityId);
  },
);

const removeCoverSchema = z.object({
  locale: z.enum(["fr", "en", "ar"]),
  activityId: z.string().uuid(),
});

export const removeActivityCoverImage = protectedPermissionAction(
  "content.activity.manage",
  async (formData) => {
    const parsed = removeCoverSchema.parse({
      locale: formData.get("locale"),
      activityId: formData.get("activityId"),
    });
    await db
      .delete(activityAssets)
      .where(
        and(
          eq(activityAssets.activityId, parsed.activityId),
          eq(activityAssets.role, "cover"),
        ),
      );
    await recordAudit({
      action: "activity.cover_removed",
      subjectType: "activity",
      subjectId: parsed.activityId,
    });
    refreshActivity(parsed.locale, parsed.activityId);
  },
);

const documentUploadSchema = z.object({
  byteSize: z.coerce
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024),
  languageCode: z.enum(editorialLanguageCodes),
  rightsConfirmed: z.literal("true"),
});

/** Signed upload for a downloadable PDF attached to an activity. */
export const createActivityDocumentUpload = protectedPermissionAction(
  "content.activity.manage",
  async (formData, _locale, user) => {
    const parsed = documentUploadSchema.parse({
      byteSize: formData.get("byteSize"),
      languageCode: formData.get("languageCode"),
      rightsConfirmed: formData.get("rightsConfirmed"),
    });

    const assetId = crypto.randomUUID();
    const storageKey = `uploads/activities/${assetId}/document.pdf`;
    const uploadUrl = await createAssetUploadUrl({
      storageKey,
      mimeType: "application/pdf",
      byteSize: parsed.byteSize,
      assetId,
    });
    await db.insert(assets).values({
      id: assetId,
      uploaderId: user.id,
      languageCode: parsed.languageCode,
      storageKey,
      mimeType: "application/pdf",
      byteSize: parsed.byteSize,
      kind: "document",
      visibility: "workspace",
      scanState: "pending",
      rightsConfirmed: true,
    });
    return { assetId, uploadUrl };
  },
);

const addDownloadSchema = z.object({
  locale: z.enum(["fr", "en", "ar"]),
  activityId: z.string().uuid(),
  assetId: z.string().uuid(),
  languageCode: z.enum(editorialLanguageCodes),
  title: z.string().trim().min(2).max(200),
});

/** Register an uploaded PDF as a public download attached to the activity. */
export const addActivityDownload = protectedPermissionAction(
  "content.activity.manage",
  async (formData, _locale, user) => {
    const parsed = addDownloadSchema.parse({
      locale: formData.get("locale"),
      activityId: formData.get("activityId"),
      assetId: formData.get("assetId"),
      languageCode: formData.get("languageCode"),
      title: formData.get("title"),
    });

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
          eq(assets.uploaderId, user.id),
          eq(assets.kind, "document"),
          eq(assets.rightsConfirmed, true),
          isNull(assets.archivedAt),
        ),
      )
      .limit(1);
    if (!uploadedAsset) throw new Error("The document is unavailable");
    await verifyAssetUpload(uploadedAsset);

    await db.transaction(async (tx) => {
      const [activity] = await tx
        .select({ organizationId: activities.organizationId })
        .from(activities)
        .where(eq(activities.id, parsed.activityId))
        .limit(1);
      if (!activity) throw new Error("Unknown activity");
      if (!activity.organizationId) {
        throw new Error("The activity needs an owning association first");
      }
      const existing = await tx
        .select({ id: activityAssets.id })
        .from(activityAssets)
        .where(
          and(
            eq(activityAssets.activityId, parsed.activityId),
            eq(activityAssets.role, "attachment"),
          ),
        );
      await tx.insert(activityAssets).values({
        activityId: parsed.activityId,
        assetId: parsed.assetId,
        role: "attachment",
        languageCode: parsed.languageCode,
        displayOrder: existing.length,
      });
      const [download] = await tx
        .insert(downloads)
        .values({
          assetId: parsed.assetId,
          organizationId: activity.organizationId,
        })
        .returning({ id: downloads.id });
      if (!download) throw new Error("Download insert returned no row");
      await tx.insert(downloadTranslations).values({
        downloadId: download.id,
        languageCode: parsed.languageCode,
        title: parsed.title,
      });
    });
    await recordAudit({
      action: "activity.download_added",
      subjectType: "activity",
      subjectId: parsed.activityId,
    });
    refreshActivity(parsed.locale, parsed.activityId);
  },
);

const removeDownloadSchema = z.object({
  locale: z.enum(["fr", "en", "ar"]),
  activityId: z.string().uuid(),
  downloadId: z.string().uuid(),
});

export const removeActivityDownload = protectedPermissionAction(
  "content.activity.manage",
  async (formData) => {
    const parsed = removeDownloadSchema.parse({
      locale: formData.get("locale"),
      activityId: formData.get("activityId"),
      downloadId: formData.get("downloadId"),
    });
    await db.transaction(async (tx) => {
      const [download] = await tx
        .select({ assetId: downloads.assetId })
        .from(downloads)
        .where(eq(downloads.id, parsed.downloadId))
        .limit(1);
      if (!download) return;
      await tx.delete(downloads).where(eq(downloads.id, parsed.downloadId));
      await tx
        .delete(activityAssets)
        .where(
          and(
            eq(activityAssets.activityId, parsed.activityId),
            eq(activityAssets.assetId, download.assetId),
            eq(activityAssets.role, "attachment"),
          ),
        );
    });
    await recordAudit({
      action: "activity.download_removed",
      subjectType: "activity",
      subjectId: parsed.activityId,
    });
    refreshActivity(parsed.locale, parsed.activityId);
  },
);
