"use server";

import { type Locale } from "@infokit/shared/i18n";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import { eventLanguages } from "~/lib/event-languages";
import { recordAudit } from "~/server/audit";
import { createAssetUploadUrl, verifyAssetUpload } from "~/server/assets/s3";
import {
  protectedPermissionAction,
  requireEditor,
} from "~/server/auth/require";
import {
  COORDINATION_MANAGE_PERMISSION,
  coordinationViewer,
} from "~/server/content/coordination-events";
import {
  EVENT_COVER_ROLE,
  EVENT_FLYER_ROLE,
} from "~/server/content/event-media";
import { db } from "~/server/db";
import {
  assetTranslations,
  assets,
  coordinationEventAssets,
  coordinationEvents,
} from "~/server/db/schema";

/**
 * An event's cover image and its downloadable flyers.
 *
 * Uploads go straight to object storage through a signed URL — the file never
 * passes through this server — and the row is only attached once storage
 * confirms it arrived intact. Every file starts workspace-only with a pending
 * safety scan; `~/server/content/event-media` is what decides when it may reach
 * a reader, so nothing here has to be careful about publication.
 */

const eventId = z.string().uuid();
const assetId = z.string().uuid();

/**
 * Attaching media is editing the event, so it takes the same two checks the
 * event form takes: the coordination permission, and membership of the hosting
 * organisation. Mirrors `assertMayHost` in ./actions — kept local because a
 * `"use server"` module may only export actions.
 */
async function assertMayManage(id: string) {
  const [event] = await db
    .select({
      hostOrganizationId: coordinationEvents.hostOrganizationId,
      sourceLanguageCode: coordinationEvents.sourceLanguageCode,
    })
    .from(coordinationEvents)
    .where(eq(coordinationEvents.id, id))
    .limit(1);
  if (!event) throw new Error("Unknown coordination event");
  const user = await requireEditor();
  const viewer = await coordinationViewer(user.id);
  if (
    !viewer.isPlatformSteward &&
    (event.hostOrganizationId === null ||
      !viewer.organizationIds.includes(event.hostOrganizationId))
  ) {
    throw new Error("Forbidden: not a member of the hosting organisation");
  }
  return event;
}

/** The uploader's own fresh, rights-confirmed file — nobody else's. */
async function claimUpload(
  id: string,
  kind: "image" | "document",
  uploaderId: string,
) {
  const [asset] = await db
    .select({
      storageKey: assets.storageKey,
      mimeType: assets.mimeType,
      byteSize: assets.byteSize,
    })
    .from(assets)
    .where(
      and(
        eq(assets.id, id),
        eq(assets.uploaderId, uploaderId),
        eq(assets.kind, kind),
        eq(assets.rightsConfirmed, true),
        isNull(assets.archivedAt),
      ),
    )
    .limit(1);
  if (!asset) throw new Error("The uploaded file is unavailable");
  await verifyAssetUpload(asset);
}

function refresh(locale: Locale, id: string) {
  revalidatePath(localizedPath(`/dashboard/events/${id}`, locale));
  // A public-tier event shows its cover on both public surfaces.
  revalidatePath(localizedPath(`/events/${id}`, locale));
  revalidatePath(localizedPath("/events", locale));
}

const imageUploadSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]),
  byteSize: z.coerce
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
  languageCode: z.enum(eventLanguages),
  altText: z.string().trim().min(1).max(500),
  rightsConfirmed: z.literal("true"),
});

export const createEventImageUpload = protectedPermissionAction(
  COORDINATION_MANAGE_PERMISSION,
  async (formData, _locale, user) => {
    const parsed = imageUploadSchema.parse({
      mimeType: formData.get("mimeType"),
      byteSize: formData.get("byteSize"),
      languageCode: formData.get("languageCode"),
      altText: formData.get("altText"),
      rightsConfirmed: formData.get("rightsConfirmed"),
    });
    await assertMayManage(eventId.parse(formData.get("eventId")));

    const id = crypto.randomUUID();
    const storageKey = `uploads/events/${id}/original`;
    const uploadUrl = await createAssetUploadUrl({
      storageKey,
      mimeType: parsed.mimeType,
      byteSize: parsed.byteSize,
      assetId: id,
    });
    await db.transaction(async (tx) => {
      await tx.insert(assets).values({
        id,
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
        assetId: id,
        languageCode: parsed.languageCode,
        altText: parsed.altText,
        decorative: false,
        state: "draft",
      });
    });
    return { assetId: id, uploadUrl };
  },
);

/** Attach (or replace) the event's one cover image. */
export const setEventCoverImage = protectedPermissionAction(
  COORDINATION_MANAGE_PERMISSION,
  async (formData, locale, user) => {
    const id = eventId.parse(formData.get("eventId"));
    const uploaded = assetId.parse(formData.get("assetId"));
    const event = await assertMayManage(id);
    await claimUpload(uploaded, "image", user.id);

    await db.transaction(async (tx) => {
      // One cover: replacing it detaches the previous file, which stays in
      // storage and in the trail rather than disappearing.
      await tx
        .delete(coordinationEventAssets)
        .where(
          and(
            eq(coordinationEventAssets.eventId, id),
            eq(coordinationEventAssets.role, EVENT_COVER_ROLE),
          ),
        );
      await tx.insert(coordinationEventAssets).values({
        eventId: id,
        assetId: uploaded,
        role: EVENT_COVER_ROLE,
        languageCode: event.sourceLanguageCode,
      });
    });
    await recordAudit({
      action: "coordination_event.cover_set",
      subjectType: "coordination_event",
      subjectId: id,
      organizationId: event.hostOrganizationId,
    });
    refresh(locale, id);
  },
);

export const removeEventCoverImage = protectedPermissionAction(
  COORDINATION_MANAGE_PERMISSION,
  async (formData, locale) => {
    const id = eventId.parse(formData.get("eventId"));
    const event = await assertMayManage(id);
    await db
      .delete(coordinationEventAssets)
      .where(
        and(
          eq(coordinationEventAssets.eventId, id),
          eq(coordinationEventAssets.role, EVENT_COVER_ROLE),
        ),
      );
    await recordAudit({
      action: "coordination_event.cover_removed",
      subjectType: "coordination_event",
      subjectId: id,
      organizationId: event.hostOrganizationId,
    });
    refresh(locale, id);
  },
);

const flyerUploadSchema = z.object({
  byteSize: z.coerce
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024),
  languageCode: z.enum(eventLanguages),
  rightsConfirmed: z.literal("true"),
});

/** Signed upload for a printable flyer — a PDF, so it prints the same anywhere. */
export const createEventFlyerUpload = protectedPermissionAction(
  COORDINATION_MANAGE_PERMISSION,
  async (formData, _locale, user) => {
    const parsed = flyerUploadSchema.parse({
      byteSize: formData.get("byteSize"),
      languageCode: formData.get("languageCode"),
      rightsConfirmed: formData.get("rightsConfirmed"),
    });
    await assertMayManage(eventId.parse(formData.get("eventId")));

    const id = crypto.randomUUID();
    const storageKey = `uploads/events/${id}/flyer.pdf`;
    const uploadUrl = await createAssetUploadUrl({
      storageKey,
      mimeType: "application/pdf",
      byteSize: parsed.byteSize,
      assetId: id,
    });
    await db.insert(assets).values({
      id,
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
    return { assetId: id, uploadUrl };
  },
);

const addFlyerSchema = z.object({
  languageCode: z.enum(eventLanguages),
  title: z.string().trim().min(2).max(200),
});

/**
 * Register an uploaded PDF as one of the event's flyers. The title lives on the
 * asset's own translation rather than in `content.downloads`: that table needs
 * an owning organisation, and an event may be hosted by the platform itself.
 */
export const addEventFlyer = protectedPermissionAction(
  COORDINATION_MANAGE_PERMISSION,
  async (formData, locale, user) => {
    const id = eventId.parse(formData.get("eventId"));
    const uploaded = assetId.parse(formData.get("assetId"));
    const parsed = addFlyerSchema.parse({
      languageCode: formData.get("languageCode"),
      title: formData.get("title"),
    });
    const event = await assertMayManage(id);
    await claimUpload(uploaded, "document", user.id);

    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: coordinationEventAssets.id })
        .from(coordinationEventAssets)
        .where(
          and(
            eq(coordinationEventAssets.eventId, id),
            eq(coordinationEventAssets.role, EVENT_FLYER_ROLE),
          ),
        );
      await tx.insert(coordinationEventAssets).values({
        eventId: id,
        assetId: uploaded,
        role: EVENT_FLYER_ROLE,
        languageCode: parsed.languageCode,
        displayOrder: existing.length,
      });
      await tx
        .insert(assetTranslations)
        .values({
          assetId: uploaded,
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
      action: "coordination_event.flyer_added",
      subjectType: "coordination_event",
      subjectId: id,
      organizationId: event.hostOrganizationId,
      metadata: { languageCode: parsed.languageCode },
    });
    refresh(locale, id);
  },
);

export const removeEventFlyer = protectedPermissionAction(
  COORDINATION_MANAGE_PERMISSION,
  async (formData, locale) => {
    const id = eventId.parse(formData.get("eventId"));
    const uploaded = assetId.parse(formData.get("assetId"));
    const event = await assertMayManage(id);
    await db
      .delete(coordinationEventAssets)
      .where(
        and(
          eq(coordinationEventAssets.eventId, id),
          eq(coordinationEventAssets.assetId, uploaded),
          eq(coordinationEventAssets.role, EVENT_FLYER_ROLE),
        ),
      );
    await recordAudit({
      action: "coordination_event.flyer_removed",
      subjectType: "coordination_event",
      subjectId: id,
      organizationId: event.hostOrganizationId,
    });
    refresh(locale, id);
  },
);
