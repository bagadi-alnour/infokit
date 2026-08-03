"use server";

import { type Locale } from "@infokit/shared/i18n";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { EVENT_VISIBILITIES } from "~/components/events/visibility";
import { localizedPath } from "~/i18n/routing";
import { eventLanguages, type EventLanguage } from "~/lib/event-languages";
import { parseStewardContact } from "~/lib/steward-contact";
import {
  parseTransitLinks,
  transitLinksPatch,
  type TransitLink,
} from "~/lib/transit-links";
import { zonedWallTimeToInstant } from "~/lib/zoned-time";
import { optionalNumber, optionalText, optionalUuid } from "~/lib/form-fields";
import { recordAudit } from "~/server/audit";
import {
  requireEditor,
  protectedPermissionAction,
} from "~/server/auth/require";
import {
  COORDINATION_MANAGE_PERMISSION,
  coordinationViewer,
} from "~/server/content/coordination-events";
import { FALLBACK_TIME_ZONE } from "~/server/content/event-presentation";
import {
  appendEventFlyer,
  attachEventCover,
  claimUploadedAsset,
} from "~/server/content/event-media";
import { db } from "~/server/db";
import {
  cities,
  coordinationEvents,
  coordinationEventTransitLinks,
  coordinationEventTranslations,
  placeTranslations,
  places,
} from "~/server/db/schema";

const eventFieldsSchema = z.object({
  hostOrganizationId: optionalUuid,
  /** Null only for an event that happens online and in no city. */
  cityId: optionalUuid,
  isOnline: z.boolean(),
  onlineUrl: optionalText.refine(
    (value) => value === null || /^https?:\/\/\S+$/i.test(value),
    "Write the joining link as a web address, https://…",
  ),
  visibility: z.enum(EVENT_VISIBILITIES),
  placeId: optionalUuid,
  locationLabel: optionalText,
  contactLabel: optionalText,
  contactValue: optionalText,
  allDay: z.boolean(),
  startDate: z.string().trim().min(1),
  startTime: z.string().trim(),
  endDate: z.string().trim(),
  endTime: z.string().trim(),
  sourceLanguageCode: z.enum(eventLanguages),
  titleFr: optionalText,
  titleEn: optionalText,
  titleAr: optionalText,
  descriptionFr: optionalText,
  descriptionEn: optionalText,
  descriptionAr: optionalText,
});

function parseEventFields(formData: FormData) {
  const text = (name: string) => formData.get(name) ?? "";
  return eventFieldsSchema.parse({
    hostOrganizationId: text("hostOrganizationId"),
    cityId: text("cityId"),
    isOnline:
      formData.get("isOnline") === "on" || formData.get("isOnline") === "true",
    onlineUrl: text("onlineUrl"),
    visibility: formData.get("visibility"),
    placeId: text("placeId"),
    locationLabel: text("locationLabel"),
    contactLabel: text("contactLabel"),
    contactValue: text("contactValue"),
    allDay:
      formData.get("allDay") === "on" || formData.get("allDay") === "true",
    startDate: text("startDate"),
    startTime: text("startTime"),
    endDate: text("endDate"),
    endTime: text("endTime"),
    sourceLanguageCode: formData.get("sourceLanguageCode") ?? "fr",
    titleFr: text("titleFr"),
    titleEn: text("titleEn"),
    titleAr: text("titleAr"),
    descriptionFr: text("descriptionFr"),
    descriptionEn: text("descriptionEn"),
    descriptionAr: text("descriptionAr"),
  });
}

type EventFields = z.infer<typeof eventFieldsSchema>;

/**
 * An address written into the event form instead of chosen from the list. The
 * name is required and the rest is not: an address the suggestions did not
 * recognise is still an address, and a place with no coordinates simply has no
 * point on a map.
 */
const newPlaceSchema = z.object({
  name: z.string().trim().min(2).max(150),
  addressLine: optionalText,
  postalCode: optionalText,
  lat: optionalNumber,
  lng: optionalNumber,
});

/**
 * The place that address becomes, or `null` when the editor chose one from the
 * list. Kept as a real place rather than as free text on the event so the next
 * event at the same address can pick it, and so the map has somewhere to put a
 * pin (docs/DATABASE-SCHEMA.md §2).
 *
 * It is filed under the event's own city and hosting organisation, and left at
 * the `exact` precision every place starts from — the places workspace is where
 * an address that must not be shown precisely gets that decision (RISKS.md R5).
 */
async function createPlaceFromEventForm(
  fields: EventFields,
  formData: FormData,
) {
  const name = z
    .string()
    .trim()
    .parse(formData.get("newPlaceName") ?? "");
  // Absent means the editor never opened the fields, which is not the same as
  // an address they left half-written: that one is rejected by the parse.
  if (name === "") return null;
  // A place belongs to a city, and the form hides the address fields entirely
  // for an online event — so this is a tampered post, not an editor's mistake.
  if (fields.cityId === null) {
    throw new Error("An address needs a city: the event cannot be online-only");
  }
  const cityId = fields.cityId;
  const parsed = newPlaceSchema.parse({
    name,
    addressLine: formData.get("newPlaceAddressLine") ?? "",
    postalCode: formData.get("newPlacePostalCode") ?? "",
    lat: formData.get("newPlaceLat") ?? "",
    lng: formData.get("newPlaceLng") ?? "",
  });

  const [place] = await db
    .insert(places)
    .values({
      organizationId: fields.hostOrganizationId,
      cityId,
      addressLine: parsed.addressLine,
      postalCode: parsed.postalCode,
      lat: parsed.lat,
      lng: parsed.lng,
      precision: "exact",
    })
    .returning({ id: places.id });
  if (!place) throw new Error("Place insert returned no row");
  // The name is a proper noun, so it is recorded for every language rather than
  // for the one the editor happens to be working in: a console in Arabic that
  // falls back to an id shows a place nobody can recognise in a list.
  await db.insert(placeTranslations).values(
    eventLanguages.map((languageCode) => ({
      placeId: place.id,
      languageCode,
      name: parsed.name,
    })),
  );
  await recordAudit({
    action: "place.created",
    subjectType: "place",
    subjectId: place.id,
    organizationId: fields.hostOrganizationId,
    metadata: { source: "event_form" },
  });
  return place.id;
}

/**
 * The clock the editor typed the hours in. An online event names no city, so
 * its hours are the platform's own zone — the same fallback every agenda reads
 * them back through (`server/content/event-presentation`).
 */
async function cityTimezone(cityId: string | null) {
  if (cityId === null) return FALLBACK_TIME_ZONE;
  const [city] = await db
    .select({ timezone: cities.timezone })
    .from(cities)
    .where(eq(cities.id, cityId))
    .limit(1);
  if (!city) throw new Error("Unknown city");
  return city.timezone;
}

/**
 * An event happens somewhere: in a city, or online. The database says the same
 * thing in a check constraint; this says it before the insert, where the editor
 * can be told which of the two answers is missing.
 */
function assertHasWhere(fields: EventFields) {
  if (fields.isOnline || fields.cityId !== null) return;
  throw new Error("Choose the city, or say the event happens online");
}

/**
 * The event's window as two instants. An all-day event runs from midnight to
 * the last minute of its end day in the city's own timezone, so "Saturday"
 * means Saturday there and not a UTC day that starts at 02:00 local.
 */
async function resolveRange(fields: EventFields) {
  const timezone = await cityTimezone(fields.cityId);
  const endDate = fields.endDate === "" ? fields.startDate : fields.endDate;
  const startsAt = zonedWallTimeToInstant(
    fields.startDate,
    fields.allDay ? "00:00" : fields.startTime,
    timezone,
  );
  const endsAt = zonedWallTimeToInstant(
    endDate,
    fields.allDay ? "23:59" : fields.endTime,
    timezone,
  );
  if (!startsAt || !endsAt) {
    throw new Error("Choose a valid start and end for the event");
  }
  if (endsAt < startsAt) {
    throw new Error("The event cannot end before it starts");
  }
  return { startsAt, endsAt };
}

/** The authored text, source language first — that one is required. */
function resolveTitles(fields: EventFields) {
  const titles: Record<EventLanguage, string | null> = {
    fr: fields.titleFr,
    en: fields.titleEn,
    ar: fields.titleAr,
  };
  const descriptions: Record<EventLanguage, string | null> = {
    fr: fields.descriptionFr,
    en: fields.descriptionEn,
    ar: fields.descriptionAr,
  };
  if (!titles[fields.sourceLanguageCode]) {
    throw new Error("The event needs a title in its source language");
  }
  return { titles, descriptions };
}

/**
 * An editor may only host for an organisation they belong to; platform
 * stewards may also host as the platform itself or on an organisation's behalf,
 * the same rule the organisation directory already uses.
 */
async function assertMayHost(hostOrganizationId: string | null) {
  const user = await requireEditor();
  const viewer = await coordinationViewer(user.id);
  if (viewer.isPlatformSteward) return;
  if (
    hostOrganizationId === null ||
    !viewer.organizationIds.includes(hostOrganizationId)
  ) {
    throw new Error("Forbidden: not a member of the hosting organisation");
  }
}

async function upsertText(
  eventId: string,
  titles: Record<EventLanguage, string | null>,
  descriptions: Record<EventLanguage, string | null>,
) {
  for (const languageCode of eventLanguages) {
    const title = titles[languageCode];
    const description = descriptions[languageCode];
    if (!title) {
      // Clearing the title drops that language: a public page should fall back
      // to the source language, not show an event with an empty heading.
      await db
        .delete(coordinationEventTranslations)
        .where(
          and(
            eq(coordinationEventTranslations.eventId, eventId),
            eq(coordinationEventTranslations.languageCode, languageCode),
          ),
        );
      continue;
    }
    await db
      .insert(coordinationEventTranslations)
      .values({ eventId, languageCode, title, description })
      .onConflictDoUpdate({
        target: [
          coordinationEventTranslations.eventId,
          coordinationEventTranslations.languageCode,
        ],
        set: { title, description },
      });
  }
}

/**
 * The event's transport links, in the order the editor put them in. Positions
 * come from the list itself rather than from the form, so a row dragged or
 * deleted needs no bookkeeping of its own.
 */
async function insertTransit(eventId: string, links: TransitLink[]) {
  if (links.length === 0) return;
  await db.insert(coordinationEventTransitLinks).values(
    links.map((link, index) => ({
      eventId,
      ...link,
      displayOrder: index,
    })),
  );
}

/**
 * The same list, replacing whatever was there.
 *
 * Wholesale, because the editor owns the list: a row edited from "bus 5" into
 * "train, Calais-Ville" is not that row with a correction, and nothing on it —
 * no publication, no translation, no audit of its own — is worth keeping an id
 * alive for. What the form posted is what the event has.
 *
 * In one transaction, so a failed insert cannot leave an event that used to say
 * how to reach it saying nothing.
 */
async function replaceTransit(eventId: string, links: TransitLink[]) {
  await db.transaction(async (tx) => {
    await tx
      .delete(coordinationEventTransitLinks)
      .where(eq(coordinationEventTransitLinks.eventId, eventId));
    if (links.length === 0) return;
    await tx.insert(coordinationEventTransitLinks).values(
      links.map((link, displayOrder) => ({
        eventId,
        ...link,
        displayOrder,
      })),
    );
  });
}

/**
 * The cover image and the flyers chosen while the event was still being
 * written. They were uploaded to storage as the editor picked them — there was
 * no event yet to attach them to — so the ids travel on the post and are
 * attached here, once the event exists and its author has been checked.
 *
 * Each file is claimed the same way the media panel claims one: the uploader's
 * own, rights-confirmed, and scanned before it is ever attached.
 */
async function attachDraftMedia({
  eventId,
  uploaderId,
  languageCode,
  formData,
}: {
  eventId: string;
  uploaderId: string;
  languageCode: EventLanguage;
  formData: FormData;
}) {
  const assetId = z.string().uuid();
  const flyerTitle = z.string().trim().min(2).max(200);
  const cover = formData.get("coverAssetId");
  if (cover !== null && cover !== "") {
    const id = assetId.parse(cover);
    await claimUploadedAsset({ assetId: id, kind: "image", uploaderId });
    await attachEventCover({ eventId, assetId: id, languageCode });
    await recordAudit({
      action: "coordination_event.cover_set",
      subjectType: "coordination_event",
      subjectId: eventId,
    });
  }

  // Index-aligned, the way the transit rows travel: the title belongs to the
  // file next to it, and the browser posts both lists in document order.
  const flyerIds = formData.getAll("flyerAssetId");
  const flyerTitles = formData.getAll("flyerTitle");
  for (const [index, value] of flyerIds.entries()) {
    const id = assetId.parse(value);
    const title = flyerTitle.parse(flyerTitles[index] ?? "");
    await claimUploadedAsset({ assetId: id, kind: "document", uploaderId });
    await appendEventFlyer({ eventId, assetId: id, languageCode, title });
    await recordAudit({
      action: "coordination_event.flyer_added",
      subjectType: "coordination_event",
      subjectId: eventId,
      metadata: { languageCode },
    });
  }
}

function refresh(locale: Locale, eventId?: string) {
  revalidatePath(localizedPath("/dashboard/events", locale));
  if (eventId) {
    revalidatePath(localizedPath(`/dashboard/events/${eventId}`, locale));
  }
  // A public-tier event is part of the public agenda too.
  revalidatePath(localizedPath("/events", locale));
}

export const createCoordinationEvent = protectedPermissionAction(
  COORDINATION_MANAGE_PERMISSION,
  async (formData, locale) => {
    const fields = parseEventFields(formData);
    assertHasWhere(fields);
    await assertMayHost(fields.hostOrganizationId);
    const { startsAt, endsAt } = await resolveRange(fields);
    const { titles, descriptions } = resolveTitles(fields);
    const user = await requireEditor(locale);
    const newPlaceId = await createPlaceFromEventForm(fields, formData);

    const [event] = await db
      .insert(coordinationEvents)
      .values({
        ...parseStewardContact(formData),
        hostOrganizationId: fields.hostOrganizationId,
        cityId: fields.cityId,
        isOnline: fields.isOnline,
        onlineUrl: fields.onlineUrl,
        visibility: fields.visibility,
        placeId: newPlaceId ?? fields.placeId,
        locationLabel: fields.locationLabel,
        contactLabel: fields.contactLabel,
        contactValue: fields.contactValue,
        startsAt,
        endsAt,
        allDay: fields.allDay,
        sourceLanguageCode: fields.sourceLanguageCode,
        createdById: user.id,
      })
      .returning({ id: coordinationEvents.id });
    if (!event) throw new Error("Coordination event insert returned no row");
    await upsertText(event.id, titles, descriptions);
    await insertTransit(event.id, parseTransitLinks(formData));
    await attachDraftMedia({
      eventId: event.id,
      uploaderId: user.id,
      languageCode: fields.sourceLanguageCode,
      formData,
    });
    await recordAudit({
      action: "coordination_event.created",
      subjectType: "coordination_event",
      subjectId: event.id,
      organizationId: fields.hostOrganizationId,
      metadata: { visibility: fields.visibility },
    });
    refresh(locale, event.id);
    redirect(
      `${localizedPath(`/dashboard/events/${event.id}`, locale)}?notice=event-created`,
    );
  },
);

export const updateCoordinationEvent = protectedPermissionAction(
  COORDINATION_MANAGE_PERMISSION,
  async (formData, locale) => {
    const eventId = z.string().uuid().parse(formData.get("eventId"));
    const fields = parseEventFields(formData);
    assertHasWhere(fields);
    const [existing] = await db
      .select({ hostOrganizationId: coordinationEvents.hostOrganizationId })
      .from(coordinationEvents)
      .where(eq(coordinationEvents.id, eventId))
      .limit(1);
    if (!existing) throw new Error("Unknown coordination event");
    // Both ends are checked: an event you may see but whose host you do not
    // belong to is not yours to edit, and reassigning it to an organisation you
    // do not belong to is not a way to plant one either.
    await assertMayHost(existing.hostOrganizationId);
    await assertMayHost(fields.hostOrganizationId);
    const { startsAt, endsAt } = await resolveRange(fields);
    const { titles, descriptions } = resolveTitles(fields);
    const newPlaceId = await createPlaceFromEventForm(fields, formData);

    await db
      .update(coordinationEvents)
      .set({
        ...parseStewardContact(formData),
        hostOrganizationId: fields.hostOrganizationId,
        cityId: fields.cityId,
        isOnline: fields.isOnline,
        onlineUrl: fields.onlineUrl,
        visibility: fields.visibility,
        placeId: newPlaceId ?? fields.placeId,
        locationLabel: fields.locationLabel,
        contactLabel: fields.contactLabel,
        contactValue: fields.contactValue,
        startsAt,
        endsAt,
        allDay: fields.allDay,
        sourceLanguageCode: fields.sourceLanguageCode,
      })
      .where(eq(coordinationEvents.id, eventId));
    await upsertText(eventId, titles, descriptions);
    // Absent fieldset means "not shown", not "none": a screen that never asked
    // about transport must not answer for it. An event that moved online is the
    // one case where absent does mean none — there is nowhere left to travel.
    const transit = fields.isOnline ? [] : transitLinksPatch(formData);
    if (transit) await replaceTransit(eventId, transit);
    await recordAudit({
      action: "coordination_event.updated",
      subjectType: "coordination_event",
      subjectId: eventId,
      organizationId: fields.hostOrganizationId,
      metadata: { visibility: fields.visibility },
    });
    refresh(locale, eventId);
  },
);

/**
 * Cancelling keeps the event on the agenda with a reason people can read
 * (FR-P2-024) — it is never a silent deletion.
 */
export const cancelCoordinationEvent = protectedPermissionAction(
  COORDINATION_MANAGE_PERMISSION,
  async (formData, locale) => {
    const eventId = z.string().uuid().parse(formData.get("eventId"));
    const reason = z
      .string()
      .trim()
      .min(3, "Say why the event is cancelled")
      .parse(formData.get("reason"));
    const [existing] = await db
      .select({
        hostOrganizationId: coordinationEvents.hostOrganizationId,
        sourceLanguageCode: coordinationEvents.sourceLanguageCode,
      })
      .from(coordinationEvents)
      .where(eq(coordinationEvents.id, eventId))
      .limit(1);
    if (!existing) throw new Error("Unknown coordination event");
    await assertMayHost(existing.hostOrganizationId);

    await db
      .update(coordinationEvents)
      .set({ status: "cancelled" })
      .where(eq(coordinationEvents.id, eventId));
    await db
      .update(coordinationEventTranslations)
      .set({ cancellationReason: reason })
      .where(eq(coordinationEventTranslations.eventId, eventId));
    await recordAudit({
      action: "coordination_event.cancelled",
      subjectType: "coordination_event",
      subjectId: eventId,
      organizationId: existing.hostOrganizationId,
      reason,
    });
    refresh(locale, eventId);
  },
);

export const reinstateCoordinationEvent = protectedPermissionAction(
  COORDINATION_MANAGE_PERMISSION,
  async (formData, locale) => {
    const eventId = z.string().uuid().parse(formData.get("eventId"));
    const [existing] = await db
      .select({ hostOrganizationId: coordinationEvents.hostOrganizationId })
      .from(coordinationEvents)
      .where(eq(coordinationEvents.id, eventId))
      .limit(1);
    if (!existing) throw new Error("Unknown coordination event");
    await assertMayHost(existing.hostOrganizationId);

    await db
      .update(coordinationEvents)
      .set({ status: "scheduled" })
      .where(eq(coordinationEvents.id, eventId));
    await db
      .update(coordinationEventTranslations)
      .set({ cancellationReason: null })
      .where(eq(coordinationEventTranslations.eventId, eventId));
    await recordAudit({
      action: "coordination_event.reinstated",
      subjectType: "coordination_event",
      subjectId: eventId,
      organizationId: existing.hostOrganizationId,
    });
    refresh(locale, eventId);
  },
);

/**
 * Removal is archival (docs/DATABASE-SCHEMA.md §2): the row keeps its history
 * and leaves every agenda, including the public one.
 */
export const archiveCoordinationEvent = protectedPermissionAction(
  COORDINATION_MANAGE_PERMISSION,
  async (formData, locale) => {
    const eventId = z.string().uuid().parse(formData.get("eventId"));
    const archived = formData.get("archived") !== "false";
    const [existing] = await db
      .select({ hostOrganizationId: coordinationEvents.hostOrganizationId })
      .from(coordinationEvents)
      .where(eq(coordinationEvents.id, eventId))
      .limit(1);
    if (!existing) throw new Error("Unknown coordination event");
    await assertMayHost(existing.hostOrganizationId);

    await db
      .update(coordinationEvents)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(coordinationEvents.id, eventId));
    await recordAudit({
      action: archived
        ? "coordination_event.archived"
        : "coordination_event.restored",
      subjectType: "coordination_event",
      subjectId: eventId,
      organizationId: existing.hostOrganizationId,
    });
    refresh(locale, eventId);
    if (archived) {
      redirect(
        `${localizedPath("/dashboard/events", locale)}?notice=event-archived`,
      );
    }
  },
);
