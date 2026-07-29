"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import { editorialLanguageCodes } from "~/lib/editorial-languages";
import { maxUploadBytes } from "~/lib/image-compression";
import { recordAudit } from "~/server/audit";
import { createAssetUploadUrl } from "~/server/assets/s3";
import { scanUploadedAsset } from "~/server/assets/scan";
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

/** The join-table role a downloadable document is attached under. */
const ATTACHMENT_ROLE = "attachment";

/**
 * Take ownership of a file the editor has just pushed to object storage: it has
 * to be theirs, of the kind claimed, rights-confirmed, and actually present at
 * the key we signed. Anything else and the record would point at nothing.
 */
async function claimUpload(
  assetId: string,
  kind: "image" | "document",
  uploaderId: string,
) {
  const [asset] = await db
    .select({
      id: assets.id,
      storageKey: assets.storageKey,
      mimeType: assets.mimeType,
      byteSize: assets.byteSize,
      scanState: assets.scanState,
    })
    .from(assets)
    .where(
      and(
        eq(assets.id, assetId),
        eq(assets.uploaderId, uploaderId),
        eq(assets.kind, kind),
        eq(assets.rightsConfirmed, true),
        isNull(assets.archivedAt),
      ),
    )
    .limit(1);
  if (!asset) throw new Error("The uploaded file is unavailable");
  await scanUploadedAsset(asset);
}

const imageUploadSchema = z.object({
  mimeType: z.enum(permittedImageTypes),
  // The same megabyte the console states and the browser encodes down to: this
  // is where it is enforced, because this is where the upload URL is signed.
  byteSize: z.coerce.number().int().positive().max(maxUploadBytes),
  languageCode: z.enum(editorialLanguageCodes),
  altText: z.string().trim().min(1).max(500),
  rightsConfirmed: z.literal("true"),
});

export const createArticleImageUpload = protectedPermissionAction(
  "content.article.write",
  async (formData, _locale, user) => {
    const parsed = imageUploadSchema.parse({
      mimeType: formData.get("mimeType"),
      byteSize: formData.get("byteSize"),
      languageCode: formData.get("languageCode"),
      altText: formData.get("altText"),
      rightsConfirmed: formData.get("rightsConfirmed"),
    });

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
    // A signed URL is a short-lived write credential for the bucket, so who was
    // handed one for which key belongs in the trail whether or not the upload
    // that follows ever gets attached to anything.
    await recordAudit({
      action: "asset.upload_authorized",
      subjectType: "asset",
      subjectId: assetId,
      metadata: {
        kind: "image",
        context: "article",
        mimeType: parsed.mimeType,
        byteSize: parsed.byteSize,
        languageCode: parsed.languageCode,
      },
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
  async (formData, _locale, user) => {
    const parsed = coverSchema.parse({
      locale: formData.get("locale"),
      entryId: formData.get("entryId"),
      assetId: formData.get("assetId"),
    });
    await claimUpload(parsed.assetId, "image", user.id);

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

const documentUploadSchema = z.object({
  byteSize: z.coerce
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024),
  languageCode: z.enum(editorialLanguageCodes),
  rightsConfirmed: z.literal("true"),
});

/**
 * Signed upload for a document offered alongside an article — a PDF, so it
 * prints and reads the same wherever it is opened.
 */
export const createArticleDocumentUpload = protectedPermissionAction(
  "content.article.write",
  async (formData, _locale, user) => {
    const parsed = documentUploadSchema.parse({
      byteSize: formData.get("byteSize"),
      languageCode: formData.get("languageCode"),
      rightsConfirmed: formData.get("rightsConfirmed"),
    });

    const assetId = crypto.randomUUID();
    const storageKey = `uploads/articles/${assetId}/document.pdf`;
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
    await recordAudit({
      action: "asset.upload_authorized",
      subjectType: "asset",
      subjectId: assetId,
      metadata: {
        kind: "document",
        context: "article",
        mimeType: "application/pdf",
        byteSize: parsed.byteSize,
        languageCode: parsed.languageCode,
      },
    });
    return { assetId, uploadUrl };
  },
);

const addDownloadSchema = z.object({
  locale: z.enum(["fr", "en", "ar"]),
  entryId: z.string().uuid(),
  assetId: z.string().uuid(),
  languageCode: z.enum(editorialLanguageCodes),
  title: z.string().trim().min(2).max(200),
});

/**
 * Attach an uploaded PDF to the article as one of its downloads. The title is
 * written on the asset's own translation rather than in `content.downloads`:
 * that table needs an owning organisation, and an article may be the platform's
 * own — which is exactly the kind that carries a form or a printable guide.
 */
export const addArticleDownload = protectedPermissionAction(
  "content.article.write",
  async (formData, _locale, user) => {
    const parsed = addDownloadSchema.parse({
      locale: formData.get("locale"),
      entryId: formData.get("entryId"),
      assetId: formData.get("assetId"),
      languageCode: formData.get("languageCode"),
      title: formData.get("title"),
    });
    await claimUpload(parsed.assetId, "document", user.id);

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
      const existing = await tx
        .select({ assetId: editorialEntryAssets.assetId })
        .from(editorialEntryAssets)
        .where(
          and(
            eq(editorialEntryAssets.entryId, parsed.entryId),
            eq(editorialEntryAssets.role, ATTACHMENT_ROLE),
          ),
        );
      await tx.insert(editorialEntryAssets).values({
        entryId: parsed.entryId,
        assetId: parsed.assetId,
        role: ATTACHMENT_ROLE,
        displayOrder: existing.length,
      });
      await tx
        .insert(assetTranslations)
        .values({
          assetId: parsed.assetId,
          languageCode: parsed.languageCode,
          title: parsed.title,
          state: "draft",
        })
        .onConflictDoUpdate({
          target: [assetTranslations.assetId, assetTranslations.languageCode],
          set: { title: parsed.title },
        });
    });
    await recordAudit({
      action: "article.download_added",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
      metadata: { languageCode: parsed.languageCode },
    });
    revalidatePath(localizedPath("/dashboard/articles", parsed.locale));
  },
);

/** Which file to detach, from which article — the same three fields as a cover. */
const removeDownloadSchema = coverSchema;

/**
 * Detach a download. The asset itself is left alone — it may be scanned,
 * variant-ed or cited elsewhere, and nothing here is entitled to delete a file.
 */
export const removeArticleDownload = protectedPermissionAction(
  "content.article.write",
  async (formData) => {
    const parsed = removeDownloadSchema.parse({
      locale: formData.get("locale"),
      entryId: formData.get("entryId"),
      assetId: formData.get("assetId"),
    });
    await db
      .delete(editorialEntryAssets)
      .where(
        and(
          eq(editorialEntryAssets.entryId, parsed.entryId),
          eq(editorialEntryAssets.assetId, parsed.assetId),
          eq(editorialEntryAssets.role, ATTACHMENT_ROLE),
        ),
      );
    await recordAudit({
      action: "article.download_removed",
      subjectType: "editorial_entry",
      subjectId: parsed.entryId,
    });
    revalidatePath(localizedPath("/dashboard/articles", parsed.locale));
  },
);
