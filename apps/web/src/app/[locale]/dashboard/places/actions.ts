"use server";

import { localeSchema } from "@calais/validation/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "~/server/db";
import { localizedPath } from "~/i18n/routing";
import { places, placeTranslations } from "~/server/db/schema";
import { protectedEditorAction } from "~/server/auth/require";

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

const createPlaceSchema = z.object({
  locale: localeSchema,
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

export const createPlace = protectedEditorAction(async (formData) => {
  const parsed = createPlaceSchema.parse({
    locale: formData.get("locale"),
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

  const [place] = await db
    .insert(places)
    .values({
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

  const names: [string, string | null][] = [
    ["fr", parsed.nameFr],
    ["en", parsed.nameEn],
    ["ar", parsed.nameAr],
  ];
  for (const [languageCode, name] of names) {
    if (name === null) continue;
    await db
      .insert(placeTranslations)
      .values({ placeId: place.id, languageCode, name });
  }
  revalidatePath(localizedPath("/dashboard/places", parsed.locale));
  revalidatePath(localizedPath("/dashboard", parsed.locale));
});
