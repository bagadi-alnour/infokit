import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { createAssetReadUrl } from "~/server/assets/s3";
import {
  sanitizedImageRendition,
  scanUploadedAsset,
} from "~/server/assets/scan";
import { db } from "~/server/db";
import {
  assetTranslations,
  assets,
  coordinationEventAssets,
} from "~/server/db/schema";

/**
 * An event's cover image and its downloadable flyers.
 *
 * Two readers, two shapes. Public surfaces get URLs that go through
 * `/api/events/[id]/media/[assetId]`, which re-answers the visibility question
 * on every request — a link that leaves the page can therefore never outlive
 * the event's reach. The console gets short-lived storage URLs plus the safety
 * state, because an editor needs to see the file they just uploaded and to know
 * why it is not public yet.
 *
 * A file only reaches a reader once its rights are confirmed and its safety
 * scan is clean (docs/DATABASE-SCHEMA.md §9, NFR-012). That bar is applied here
 * once, so no calling surface has to remember it.
 */

/** The roles an event asset may take. */
export const EVENT_COVER_ROLE = "cover";
export const EVENT_FLYER_ROLE = "flyer";

/**
 * Take delivery of a file the uploader was handed a signed URL for: theirs,
 * fresh, rights-confirmed, and not archived. The safety scan runs here, so a
 * file is only ever attached to an event once storage confirms what arrived.
 *
 * Shared by the media actions and by event creation, where the upload happens
 * before the event it belongs to exists.
 */
export async function claimUploadedAsset({
  assetId,
  kind,
  uploaderId,
}: {
  assetId: string;
  kind: "image" | "document";
  uploaderId: string;
}) {
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

/**
 * The event's one cover image. Replacing it detaches the previous file, which
 * stays in storage and in the trail rather than disappearing.
 */
export async function attachEventCover({
  eventId,
  assetId,
  languageCode,
}: {
  eventId: string;
  assetId: string;
  languageCode: string;
}) {
  await db.transaction(async (tx) => {
    await tx
      .delete(coordinationEventAssets)
      .where(
        and(
          eq(coordinationEventAssets.eventId, eventId),
          eq(coordinationEventAssets.role, EVENT_COVER_ROLE),
        ),
      );
    await tx.insert(coordinationEventAssets).values({
      eventId,
      assetId,
      role: EVENT_COVER_ROLE,
      languageCode,
    });
  });
}

/**
 * One more flyer, last in the list. The title lives on the asset's own
 * translation rather than in `content.downloads`: that table needs an owning
 * organisation, and an event may be hosted by the platform itself.
 */
export async function appendEventFlyer({
  eventId,
  assetId,
  languageCode,
  title,
}: {
  eventId: string;
  assetId: string;
  languageCode: string;
  title: string;
}) {
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: coordinationEventAssets.id })
      .from(coordinationEventAssets)
      .where(
        and(
          eq(coordinationEventAssets.eventId, eventId),
          eq(coordinationEventAssets.role, EVENT_FLYER_ROLE),
        ),
      );
    await tx.insert(coordinationEventAssets).values({
      eventId,
      assetId,
      role: EVENT_FLYER_ROLE,
      languageCode,
      displayOrder: existing.length,
    });
    await tx
      .insert(assetTranslations)
      .values({ assetId, languageCode, title, state: "draft" })
      .onConflictDoUpdate({
        target: [assetTranslations.assetId, assetTranslations.languageCode],
        set: { title },
      });
  });
}

export interface PublicEventCover {
  url: string;
  alt: string;
  decorative: boolean;
}

export interface PublicEventFlyer {
  assetId: string;
  url: string;
  title: string;
  byteSize: number;
  /** The language the document itself is written in, when it is known. */
  languageCode: string | null;
}

export interface PublicEventMedia {
  cover: PublicEventCover | null;
  flyers: PublicEventFlyer[];
}

export const NO_EVENT_MEDIA: PublicEventMedia = { cover: null, flyers: [] };

interface MediaRow {
  eventId: string;
  assetId: string;
  role: string;
  byteSize: number;
  mimeType: string;
  scanState: string;
  storageKey: string;
  assetLanguage: string | null;
  linkLanguage: string | null;
  displayOrder: number;
  title: string | null;
  altText: string | null;
  decorative: boolean | null;
  translationLanguage: string | null;
}

/** Every attached file for these events, with its authored text alongside. */
async function mediaRows(
  eventIds: readonly string[],
  { requireClean }: { requireClean: boolean },
): Promise<MediaRow[]> {
  if (eventIds.length === 0) return [];
  return db
    .select({
      eventId: coordinationEventAssets.eventId,
      assetId: assets.id,
      role: coordinationEventAssets.role,
      byteSize: assets.byteSize,
      mimeType: assets.mimeType,
      scanState: assets.scanState,
      storageKey: assets.storageKey,
      assetLanguage: assets.languageCode,
      linkLanguage: coordinationEventAssets.languageCode,
      displayOrder: coordinationEventAssets.displayOrder,
      title: assetTranslations.title,
      altText: assetTranslations.altText,
      decorative: assetTranslations.decorative,
      translationLanguage: assetTranslations.languageCode,
    })
    .from(coordinationEventAssets)
    .innerJoin(assets, eq(assets.id, coordinationEventAssets.assetId))
    .leftJoin(assetTranslations, eq(assetTranslations.assetId, assets.id))
    .where(
      and(
        inArray(coordinationEventAssets.eventId, [...eventIds]),
        eq(coordinationEventAssets.active, true),
        eq(assets.rightsConfirmed, true),
        isNull(assets.archivedAt),
        requireClean ? eq(assets.scanState, "clean") : undefined,
      ),
    )
    .orderBy(asc(coordinationEventAssets.displayOrder));
}

/** The authored text for one asset, in the reader's language when there is one. */
function pickText(rows: readonly MediaRow[], locale: string) {
  return (
    rows.find((row) => row.translationLanguage === locale) ??
    rows.find((row) => row.translationLanguage === row.assetLanguage) ??
    rows.find((row) => row.translationLanguage !== null) ??
    rows[0]
  );
}

/** One entry per asset: the join above returns a row per authored language. */
function byAsset(rows: readonly MediaRow[]): Map<string, MediaRow[]> {
  const grouped = new Map<string, MediaRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.assetId) ?? [];
    list.push(row);
    grouped.set(row.assetId, list);
  }
  return grouped;
}

/**
 * The media of several events at once, for the public agenda. Events with
 * nothing attached are simply absent from the map — read it with
 * `?? NO_EVENT_MEDIA`.
 */
export async function publicEventMedia({
  eventIds,
  locale,
}: {
  eventIds: readonly string[];
  locale: string;
}): Promise<Map<string, PublicEventMedia>> {
  const rows = await mediaRows(eventIds, { requireClean: true });
  const media = new Map<string, PublicEventMedia>();
  for (const [, assetRows] of byAsset(rows)) {
    const first = assetRows[0];
    if (!first) continue;
    const text = pickText(assetRows, locale);
    const entry = media.get(first.eventId) ?? { cover: null, flyers: [] };
    const url = `/api/events/${first.eventId}/media/${first.assetId}`;
    if (first.role === EVENT_COVER_ROLE) {
      // One cover per event; the newest attach replaced the previous row.
      entry.cover = {
        url,
        alt: text?.altText ?? "",
        decorative: text?.decorative ?? false,
      };
    } else if (first.role === EVENT_FLYER_ROLE) {
      entry.flyers.push({
        assetId: first.assetId,
        url,
        title: text?.title ?? "",
        byteSize: first.byteSize,
        languageCode: first.linkLanguage ?? first.assetLanguage,
      });
    }
    media.set(first.eventId, entry);
  }
  return media;
}

/** One event's media for a public surface. */
export async function publicEventMediaFor({
  eventId,
  locale,
}: {
  eventId: string;
  locale: string;
}): Promise<PublicEventMedia> {
  const media = await publicEventMedia({ eventIds: [eventId], locale });
  return media.get(eventId) ?? NO_EVENT_MEDIA;
}

/** Whether a reader may be served this file, once the event itself is readable. */
export async function eventMediaFile({
  eventId,
  assetId,
}: {
  eventId: string;
  assetId: string;
}): Promise<{
  storageKey: string;
  mimeType: string;
  isDocument: boolean;
  fileName: string;
} | null> {
  const rows = await mediaRows([eventId], { requireClean: true });
  const assetRows = rows.filter((row) => row.assetId === assetId);
  const first = assetRows[0];
  if (!first) return null;
  const text = pickText(assetRows, first.assetLanguage ?? "fr");
  const isDocument = first.role === EVENT_FLYER_ROLE;
  /**
   * A cover is served as the rendition the safety pass encoded, never as the
   * bytes the uploader's browser produced. A flyer has no rendition — nothing
   * re-encodes a PDF — and an image cleared before renditions existed has none
   * either; both keep the original.
   */
  const served = isDocument
    ? null
    : await sanitizedImageRendition(first.assetId);
  return {
    storageKey: served?.storageKey ?? first.storageKey,
    mimeType: served?.mimeType ?? first.mimeType,
    isDocument,
    fileName: documentFileName(text?.title ?? "", first.mimeType),
  };
}

function documentFileName(title: string, mimeType: string): string {
  const base = title.trim() === "" ? "flyer" : title.trim();
  const extension = mimeType === "application/pdf" ? ".pdf" : "";
  return base.toLowerCase().endsWith(extension) ? base : `${base}${extension}`;
}

export interface WorkspaceEventCover {
  assetId: string;
  /** Null when object storage is unavailable — the file is still attached. */
  previewUrl: string | null;
  altText: string;
  /** Anything but `clean` keeps the file off every public page. */
  scanState: string;
}

export interface WorkspaceEventFlyer {
  assetId: string;
  title: string;
  byteSize: number;
  languageCode: string | null;
  downloadUrl: string | null;
  scanState: string;
}

export interface WorkspaceEventMedia {
  cover: WorkspaceEventCover | null;
  flyers: WorkspaceEventFlyer[];
}

/**
 * A short-lived storage URL, or null when the object store is not configured.
 * A missing bucket is an operations problem; it must not take the whole event
 * page down with it.
 */
async function safeReadUrl(
  storageKey: string,
  contentType: string,
  fileName?: string,
): Promise<string | null> {
  try {
    return await createAssetReadUrl(storageKey, { contentType, fileName });
  } catch {
    return null;
  }
}

/**
 * The same media as the console sees it: pending scans included, because the
 * editor who uploaded a flyer is the one who needs to know it is not public
 * yet.
 */
export async function workspaceEventMedia({
  eventId,
  locale,
}: {
  eventId: string;
  locale: string;
}): Promise<WorkspaceEventMedia> {
  const rows = await mediaRows([eventId], { requireClean: false });
  const result: WorkspaceEventMedia = { cover: null, flyers: [] };
  for (const [, assetRows] of byAsset(rows)) {
    const first = assetRows[0];
    if (!first) continue;
    const text = pickText(assetRows, locale);
    if (first.role === EVENT_COVER_ROLE) {
      result.cover = {
        assetId: first.assetId,
        previewUrl: await safeReadUrl(first.storageKey, first.mimeType),
        altText: text?.altText ?? "",
        scanState: first.scanState,
      };
    } else if (first.role === EVENT_FLYER_ROLE) {
      result.flyers.push({
        assetId: first.assetId,
        title: text?.title ?? "",
        byteSize: first.byteSize,
        languageCode: first.linkLanguage ?? first.assetLanguage,
        downloadUrl: await safeReadUrl(
          first.storageKey,
          first.mimeType,
          documentFileName(text?.title ?? "", first.mimeType),
        ),
        scanState: first.scanState,
      });
    }
  }
  return result;
}
