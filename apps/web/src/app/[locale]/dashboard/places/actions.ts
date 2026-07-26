"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { type Locale } from "@infokit/shared/i18n";

import { localizedPath } from "~/i18n/routing";
import { parseStewardContact } from "~/lib/steward-contact";
import { recordAudit } from "~/server/audit";
import { protectedPermissionAction } from "~/server/auth/require";
import { db } from "~/server/db";
import { places, placeTranslations } from "~/server/db/schema";

const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

const optionalNumber = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Not a number" });
      return z.NEVER;
    }
    return n;
  });

const placeFieldsSchema = z.object({
  nameFr: z.string().trim().min(2),
  nameEn: optional,
  nameAr: optional,
  organizationId: optional,
  cityId: z.string().uuid(),
  cityAreaId: optional,
  addressLine: optional,
  postalCode: optional,
  lat: optionalNumber,
  lng: optionalNumber,
  precision: z.enum(["exact", "area_only", "contact_to_learn"]),
});

function parsePlaceFields(formData: FormData) {
  return placeFieldsSchema.parse({
    nameFr: formData.get("nameFr"),
    nameEn: formData.get("nameEn") ?? "",
    nameAr: formData.get("nameAr") ?? "",
    organizationId: formData.get("organizationId") ?? "",
    cityId: formData.get("cityId"),
    cityAreaId: formData.get("cityAreaId") ?? "",
    addressLine: formData.get("addressLine") ?? "",
    postalCode: formData.get("postalCode") ?? "",
    lat: formData.get("lat") ?? "",
    lng: formData.get("lng") ?? "",
    precision: formData.get("precision"),
  });
}

function refresh(locale: Locale, placeId?: string) {
  revalidatePath(localizedPath("/dashboard/places", locale));
  if (placeId) {
    revalidatePath(localizedPath(`/dashboard/places/${placeId}`, locale));
  }
  revalidatePath(localizedPath("/dashboard", locale));
}

async function upsertNames(
  placeId: string,
  names: { fr: string; en: string | null; ar: string | null },
) {
  const entries: [string, string | null][] = [
    ["fr", names.fr],
    ["en", names.en],
    ["ar", names.ar],
  ];
  for (const [languageCode, name] of entries) {
    if (name === null) continue;
    await db
      .insert(placeTranslations)
      .values({ placeId, languageCode, name })
      .onConflictDoUpdate({
        target: [placeTranslations.placeId, placeTranslations.languageCode],
        set: { name },
      });
  }
}

export const createPlace = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const parsed = parsePlaceFields(formData);
    const steward = parseStewardContact(formData);
    const [place] = await db
      .insert(places)
      .values({
        ...steward,
        organizationId: parsed.organizationId,
        cityId: parsed.cityId,
        cityAreaId: parsed.cityAreaId,
        addressLine: parsed.addressLine,
        postalCode: parsed.postalCode,
        lat: parsed.lat,
        lng: parsed.lng,
        precision: parsed.precision,
      })
      .returning({ id: places.id });
    if (!place) throw new Error("Place insert returned no row");
    await upsertNames(place.id, {
      fr: parsed.nameFr,
      en: parsed.nameEn,
      ar: parsed.nameAr,
    });
    await recordAudit({
      action: "place.created",
      subjectType: "place",
      subjectId: place.id,
      organizationId: parsed.organizationId,
    });
    refresh(locale, place.id);
    redirect(localizedPath(`/dashboard/places/${place.id}`, locale));
  },
);

export const updatePlace = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const placeId = z.string().uuid().parse(formData.get("placeId"));
    const parsed = parsePlaceFields(formData);
    const steward = parseStewardContact(formData);
    await db
      .update(places)
      .set({
        ...steward,
        organizationId: parsed.organizationId,
        cityId: parsed.cityId,
        cityAreaId: parsed.cityAreaId,
        addressLine: parsed.addressLine,
        postalCode: parsed.postalCode,
        lat: parsed.lat,
        lng: parsed.lng,
        precision: parsed.precision,
      })
      .where(eq(places.id, placeId));
    await upsertNames(placeId, {
      fr: parsed.nameFr,
      en: parsed.nameEn,
      ar: parsed.nameAr,
    });
    await recordAudit({
      action: "place.updated",
      subjectType: "place",
      subjectId: placeId,
      organizationId: parsed.organizationId,
    });
    refresh(locale, placeId);
  },
);

export const setPlaceActive = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const placeId = z.string().uuid().parse(formData.get("placeId"));
    const active = formData.get("active") === "true";
    await db.update(places).set({ active }).where(eq(places.id, placeId));
    await recordAudit({
      action: active ? "place.restored" : "place.archived",
      subjectType: "place",
      subjectId: placeId,
    });
    refresh(locale, placeId);
  },
);
