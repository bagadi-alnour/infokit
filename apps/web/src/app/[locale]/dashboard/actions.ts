"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { type Locale } from "@calais/shared/i18n";

import { localizedPath } from "~/i18n/routing";
import { parisToday } from "~/lib/freshness";
import { auth } from "~/server/auth";
import { protectedEditorAction } from "~/server/auth/require";
import { db } from "~/server/db";
import { scheduleExceptions, services } from "~/server/db/schema";

/**
 * One-tap freshness actions (PRODUCT.md §14.1, SUSTAINABILITY.md ops
 * commitments): confirming today's activity re-stamps verification so the
 * public "last verified" is the same day — freshness at its best for the
 * cost of a single click.
 */

const serviceIdSchema = z.string().uuid();

function refresh(locale: Locale, serviceId: string) {
  revalidatePath(localizedPath("/dashboard", locale));
  revalidatePath(localizedPath("/dashboard/services", locale));
  revalidatePath(localizedPath(`/dashboard/services/${serviceId}`, locale));
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const confirmServiceToday = protectedEditorAction(
  async (formData, locale) => {
    const serviceId = serviceIdSchema.parse(formData.get("serviceId"));
    const session = await auth();
    const [service] = await db
      .select({ manualStatus: services.manualStatus })
      .from(services)
      .where(eq(services.id, serviceId));
    if (!service) return;

    const now = new Date();
    await db
      .update(services)
      .set({
        lastVerifiedAt: now,
        reviewDueAt: new Date(now.getTime() + THIRTY_DAYS_MS),
        verifiedById: session?.user.id ?? null,
        // Confirming "it happens as planned" clears an uncertain flag;
        // a cancellation stays until explicitly undone.
        manualStatus:
          service.manualStatus === "uncertain"
            ? "normal"
            : service.manualStatus,
      })
      .where(eq(services.id, serviceId));
    refresh(locale, serviceId);
  },
);

export const cancelServiceToday = protectedEditorAction(
  async (formData, locale) => {
    const serviceId = serviceIdSchema.parse(formData.get("serviceId"));
    const today = parisToday();
    const existing = await db
      .select({ id: scheduleExceptions.id })
      .from(scheduleExceptions)
      .where(
        and(
          eq(scheduleExceptions.serviceId, serviceId),
          eq(scheduleExceptions.date, today.isoDate),
          eq(scheduleExceptions.kind, "cancellation"),
        ),
      );
    if (existing.length === 0) {
      await db.insert(scheduleExceptions).values({
        serviceId,
        date: today.isoDate,
        kind: "cancellation",
      });
    }
    refresh(locale, serviceId);
  },
);

export const undoCancelServiceToday = protectedEditorAction(
  async (formData, locale) => {
    const serviceId = serviceIdSchema.parse(formData.get("serviceId"));
    const today = parisToday();
    await db
      .delete(scheduleExceptions)
      .where(
        and(
          eq(scheduleExceptions.serviceId, serviceId),
          eq(scheduleExceptions.date, today.isoDate),
          eq(scheduleExceptions.kind, "cancellation"),
        ),
      );
    refresh(locale, serviceId);
  },
);

export const markServiceUncertain = protectedEditorAction(
  async (formData, locale) => {
    const serviceId = serviceIdSchema.parse(formData.get("serviceId"));
    await db
      .update(services)
      .set({ manualStatus: "uncertain" })
      .where(eq(services.id, serviceId));
    refresh(locale, serviceId);
  },
);
