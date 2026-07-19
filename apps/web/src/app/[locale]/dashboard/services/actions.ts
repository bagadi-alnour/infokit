"use server";

import type { Locale } from "@calais/shared/i18n";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import { localizedPath } from "~/i18n/routing";
import { protectedEditorAction } from "~/server/auth/require";
import {
  cities,
  places,
  scheduleExceptions,
  scheduleExceptionTranslations,
  scheduleRules,
  serviceProviders,
  serviceTranslations,
  services,
} from "~/server/db/schema";

const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

const optionalInt = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 130) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid age" });
      return z.NEVER;
    }
    return n;
  });

function refresh(locale: Locale, serviceId?: string) {
  revalidatePath(localizedPath("/dashboard/services", locale));
  if (serviceId) {
    revalidatePath(localizedPath(`/dashboard/services/${serviceId}`, locale));
  }
  revalidatePath(localizedPath("/dashboard", locale));
}

async function cityIdFor(placeId: string | null): Promise<string> {
  if (placeId) {
    const [place] = await db
      .select({ cityId: places.cityId })
      .from(places)
      .where(eq(places.id, placeId));
    if (place) return place.cityId;
  }
  const [calais] = await db
    .select({ id: cities.id })
    .from(cities)
    .where(eq(cities.code, "calais"));
  if (!calais) throw new Error("Seed the database first: pnpm db:seed");
  return calais.id;
}

/* ------------------------------ create ------------------------------ */

const createServiceSchema = z.object({
  organizationId: z.string().uuid(),
  placeId: optional,
  categoryId: z.string().uuid(),
  audienceCategoryId: z.string().uuid(),
  nameFr: z.string().trim().min(2),
  nameEn: optional,
  nameAr: optional,
  sourceNote: optional,
});

export const createService = protectedEditorAction(async (formData, locale) => {
  const parsed = createServiceSchema.parse({
    organizationId: formData.get("organizationId"),
    placeId: formData.get("placeId") ?? "",
    categoryId: formData.get("categoryId"),
    audienceCategoryId: formData.get("audienceCategoryId"),
    nameFr: formData.get("nameFr"),
    nameEn: formData.get("nameEn") ?? "",
    nameAr: formData.get("nameAr") ?? "",
    sourceNote: formData.get("sourceNote") ?? "",
  });

  const [service] = await db
    .insert(services)
    .values({
      organizationId: parsed.organizationId,
      placeId: parsed.placeId,
      cityId: await cityIdFor(parsed.placeId),
      categoryId: parsed.categoryId,
      audienceCategoryId: parsed.audienceCategoryId,
      sourceNote: parsed.sourceNote,
    })
    .returning({ id: services.id });
  if (!service) throw new Error("Service insert returned no row");

  const names: [string, string | null][] = [
    ["fr", parsed.nameFr],
    ["en", parsed.nameEn],
    ["ar", parsed.nameAr],
  ];
  for (const [languageCode, name] of names) {
    if (name === null) continue;
    await db
      .insert(serviceTranslations)
      .values({ serviceId: service.id, languageCode, name });
  }
  await db.insert(serviceProviders).values({
    serviceId: service.id,
    organizationId: parsed.organizationId,
  });

  refresh(locale, service.id);
  redirect(localizedPath(`/dashboard/services/${service.id}`, locale));
});

/* ------------------------------- meta -------------------------------- */

const updateMetaSchema = z.object({
  serviceId: z.string().uuid(),
  placeId: optional,
  audienceCategoryId: z.string().uuid(),
  minAge: optionalInt,
  maxAge: optionalInt,
  manualStatus: z.enum(["normal", "cancelled", "uncertain"]),
  sourceNote: optional,
});

export const updateServiceMeta = protectedEditorAction(
  async (formData, locale) => {
    const parsed = updateMetaSchema.parse({
      serviceId: formData.get("serviceId"),
      placeId: formData.get("placeId") ?? "",
      audienceCategoryId: formData.get("audienceCategoryId"),
      minAge: formData.get("minAge") ?? "",
      maxAge: formData.get("maxAge") ?? "",
      manualStatus: formData.get("manualStatus"),
      sourceNote: formData.get("sourceNote") ?? "",
    });
    await db
      .update(services)
      .set({
        placeId: parsed.placeId,
        cityId: await cityIdFor(parsed.placeId),
        audienceCategoryId: parsed.audienceCategoryId,
        minAge: parsed.minAge,
        maxAge: parsed.maxAge,
        manualStatus: parsed.manualStatus,
        sourceNote: parsed.sourceNote,
      })
      .where(eq(services.id, parsed.serviceId));
    refresh(locale, parsed.serviceId);
  },
);

/* --------------------------- translations ---------------------------- */

const translationSchema = z.object({
  serviceId: z.string().uuid(),
  languageCode: z.enum(["fr", "en", "ar"]),
  name: z.string().trim().min(1),
  shortDescription: optional,
  instructions: optional,
});

export const upsertServiceTranslation = protectedEditorAction(
  async (formData, locale) => {
    const parsed = translationSchema.parse({
      serviceId: formData.get("serviceId"),
      languageCode: formData.get("languageCode"),
      name: formData.get("name"),
      shortDescription: formData.get("shortDescription") ?? "",
      instructions: formData.get("instructions") ?? "",
    });
    await db
      .insert(serviceTranslations)
      .values(parsed)
      .onConflictDoUpdate({
        target: [
          serviceTranslations.serviceId,
          serviceTranslations.languageCode,
        ],
        set: {
          name: parsed.name,
          shortDescription: parsed.shortDescription,
          instructions: parsed.instructions,
        },
      });
    refresh(locale, parsed.serviceId);
  },
);

/* ------------------------------ schedule ----------------------------- */

const scheduleRuleSchema = z
  .object({
    serviceId: z.string().uuid(),
    weekday: z.coerce.number().int().min(1).max(7),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine((v) => v.startTime < v.endTime, {
    message: "Start must be before end",
  });

export const addScheduleRule = protectedEditorAction(
  async (formData, locale) => {
    const parsed = scheduleRuleSchema.parse({
      serviceId: formData.get("serviceId"),
      weekday: formData.get("weekday"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
    });
    await db.insert(scheduleRules).values(parsed);
    refresh(locale, parsed.serviceId);
  },
);

export const deleteScheduleRule = protectedEditorAction(
  async (formData, locale) => {
    const id = z.string().uuid().parse(formData.get("id"));
    const serviceId = z.string().uuid().parse(formData.get("serviceId"));
    await db
      .delete(scheduleRules)
      .where(
        and(eq(scheduleRules.id, id), eq(scheduleRules.serviceId, serviceId)),
      );
    refresh(locale, serviceId);
  },
);

const exceptionSchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["closure", "cancellation", "exceptional_opening", "uncertain"]),
  reasonFr: optional,
});

export const addScheduleException = protectedEditorAction(
  async (formData, locale) => {
    const parsed = exceptionSchema.parse({
      serviceId: formData.get("serviceId"),
      date: formData.get("date"),
      kind: formData.get("kind"),
      reasonFr: formData.get("reasonFr") ?? "",
    });
    const [exception] = await db
      .insert(scheduleExceptions)
      .values({
        serviceId: parsed.serviceId,
        date: parsed.date,
        kind: parsed.kind,
      })
      .returning({ id: scheduleExceptions.id });
    if (exception && parsed.reasonFr) {
      await db.insert(scheduleExceptionTranslations).values({
        exceptionId: exception.id,
        languageCode: "fr",
        publicReason: parsed.reasonFr,
      });
    }
    refresh(locale, parsed.serviceId);
  },
);

export const deleteScheduleException = protectedEditorAction(
  async (formData, locale) => {
    const id = z.string().uuid().parse(formData.get("id"));
    const serviceId = z.string().uuid().parse(formData.get("serviceId"));
    await db
      .delete(scheduleExceptions)
      .where(
        and(
          eq(scheduleExceptions.id, id),
          eq(scheduleExceptions.serviceId, serviceId),
        ),
      );
    refresh(locale, serviceId);
  },
);

/* ------------------------------ providers ---------------------------- */

export const addProvider = protectedEditorAction(async (formData, locale) => {
  const serviceId = z.string().uuid().parse(formData.get("serviceId"));
  const organizationId = z
    .string()
    .uuid()
    .parse(formData.get("organizationId"));
  await db
    .insert(serviceProviders)
    .values({ serviceId, organizationId })
    .onConflictDoNothing();
  refresh(locale, serviceId);
});

export const removeProvider = protectedEditorAction(
  async (formData, locale) => {
    const id = z.string().uuid().parse(formData.get("id"));
    const serviceId = z.string().uuid().parse(formData.get("serviceId"));
    await db
      .delete(serviceProviders)
      .where(
        and(
          eq(serviceProviders.id, id),
          eq(serviceProviders.serviceId, serviceId),
        ),
      );
    refresh(locale, serviceId);
  },
);

/* --------------------------- verify & publish ------------------------ */

export const markVerified = protectedEditorAction(async (formData, locale) => {
  const serviceId = z.string().uuid().parse(formData.get("serviceId"));
  const now = new Date();
  const reviewDueAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await db
    .update(services)
    .set({ lastVerifiedAt: now, reviewDueAt })
    .where(eq(services.id, serviceId));
  refresh(locale, serviceId);
});

export const setPublished = protectedEditorAction(async (formData, locale) => {
  const serviceId = z.string().uuid().parse(formData.get("serviceId"));
  const publish = formData.get("publish") === "true";

  if (publish) {
    // Publish gate (FR-P1-033 + honest-content rule): at least one active
    // provider and a French name. Verification is strongly encouraged but
    // the private instrument may show unverified rows with their state.
    const [translation] = await db
      .select({ name: serviceTranslations.name })
      .from(serviceTranslations)
      .where(
        and(
          eq(serviceTranslations.serviceId, serviceId),
          eq(serviceTranslations.languageCode, "fr"),
        ),
      );
    const providers = await db
      .select({ id: serviceProviders.id })
      .from(serviceProviders)
      .where(
        and(
          eq(serviceProviders.serviceId, serviceId),
          eq(serviceProviders.active, true),
        ),
      );
    if (!translation || providers.length === 0) {
      throw new Error(
        "Publish blocked: a French name and at least one active provider are required.",
      );
    }
  }

  await db
    .update(services)
    .set({ published: publish })
    .where(eq(services.id, serviceId));
  refresh(locale, serviceId);
});
