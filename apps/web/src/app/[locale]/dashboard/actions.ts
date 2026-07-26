"use server";

import type { Locale } from "@infokit/shared/i18n";
import { and, eq, inArray, isNull, lte, or, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import { parisToday } from "~/lib/freshness";
import { recordAudit } from "~/server/audit";
import { auth } from "~/server/auth";
import {
  getRoleTestState,
  platformPermissionsForUser,
} from "~/server/auth/authorization";
import { protectedPermissionAction } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  activities,
  activityOccurrenceConfirmations,
  activityProviders,
  activityVerifications,
  scheduleExceptions,
  scheduleRules,
} from "~/server/db/schema";

const activityIdSchema = z.string().uuid();
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function refresh(locale: Locale, activityId?: string) {
  revalidatePath(localizedPath("/dashboard", locale));
  revalidatePath(localizedPath("/dashboard/activities", locale));
  if (activityId) {
    revalidatePath(
      localizedPath(`/dashboard/activities/${activityId}`, locale),
    );
  }
}

async function eligibleToday(ids: string[]) {
  if (ids.length === 0) return [];
  const today = parisToday();
  return db
    .select({ id: activities.id, organizationId: activities.organizationId })
    .from(activities)
    .innerJoin(scheduleRules, eq(scheduleRules.activityId, activities.id))
    .where(
      and(
        inArray(activities.id, ids),
        isNull(activities.archivedAt),
        eq(scheduleRules.weekday, today.weekday),
        or(
          isNull(scheduleRules.validFrom),
          lte(scheduleRules.validFrom, today.isoDate),
        ),
        or(
          isNull(scheduleRules.validTo),
          gte(scheduleRules.validTo, today.isoDate),
        ),
      ),
    );
}

async function confirm(ids: string[], locale: Locale) {
  const eligible = await eligibleToday(ids);
  const uniqueActivities = [
    ...new Map(eligible.map((activity) => [activity.id, activity])).values(),
  ];
  if (uniqueActivities.length === 0) return;

  const session = await auth();
  const actorId = session?.user.id;
  if (!actorId) throw new Error("Authentication required");
  const [authorization, platformPermissions] = await Promise.all([
    getRoleTestState(actorId),
    platformPermissionsForUser(actorId),
  ]);
  const assumedOrganizationId = authorization.assumedOrganizationId;
  const verifyingAsPlatform =
    !assumedOrganizationId &&
    platformPermissions.has("content.activity.verify");
  const confirmations = uniqueActivities.map((activity) => ({
    activityId: activity.id,
    organizationId: verifyingAsPlatform
      ? null
      : (assumedOrganizationId ?? activity.organizationId),
    date: parisToday().isoDate,
    confirmedById: actorId,
    actorScope: verifyingAsPlatform
      ? ("platform" as const)
      : ("organization" as const),
  }));
  const organizationConfirmations = confirmations.filter(
    (
      confirmation,
    ): confirmation is typeof confirmation & { organizationId: string } =>
      confirmation.organizationId !== null,
  );
  if (organizationConfirmations.length > 0) {
    const providerRows = await db
      .select({
        activityId: activityProviders.activityId,
        organizationId: activityProviders.organizationId,
      })
      .from(activityProviders)
      .where(
        and(
          inArray(
            activityProviders.activityId,
            organizationConfirmations.map(({ activityId }) => activityId),
          ),
          inArray(
            activityProviders.organizationId,
            organizationConfirmations.map(
              ({ organizationId }) => organizationId,
            ),
          ),
          eq(activityProviders.state, "confirmed"),
          eq(activityProviders.active, true),
        ),
      );
    const providerKeys = new Set(
      providerRows.map((row) => `${row.activityId}:${row.organizationId}`),
    );
    if (
      organizationConfirmations.some(
        (confirmation) =>
          !providerKeys.has(
            `${confirmation.activityId}:${confirmation.organizationId}`,
          ),
      )
    ) {
      throw new Error("Only a confirmed provider may verify this activity");
    }
  }

  const now = new Date();
  const today = parisToday();
  const insertedConfirmations = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(activityOccurrenceConfirmations)
      .values(
        confirmations.map((confirmation) => ({
          ...confirmation,
          confirmedAt: now,
        })),
      )
      .onConflictDoNothing()
      .returning({
        activityId: activityOccurrenceConfirmations.activityId,
        organizationId: activityOccurrenceConfirmations.organizationId,
        actorScope: activityOccurrenceConfirmations.actorScope,
      });
    if (inserted.length === 0) return inserted;

    const activityIds = inserted.map(({ activityId }) => activityId);
    await tx
      .update(activities)
      .set({
        lastVerifiedAt: now,
        reviewDueAt: new Date(now.getTime() + THIRTY_DAYS_MS),
        verifiedById: actorId,
        manualStatus: "normal",
      })
      .where(inArray(activities.id, activityIds));
    await tx.insert(activityVerifications).values(
      inserted.map((confirmation) => ({
        activityId: confirmation.activityId,
        organizationId: confirmation.organizationId,
        verifiedById: actorId,
        actorScope: confirmation.actorScope,
        method: "same_day_occurrence_confirmation",
        verifiedAt: now,
        validUntil: new Date(now.getTime() + THIRTY_DAYS_MS),
      })),
    );
    await tx
      .delete(scheduleExceptions)
      .where(
        and(
          inArray(scheduleExceptions.activityId, activityIds),
          eq(scheduleExceptions.date, today.isoDate),
          eq(scheduleExceptions.kind, "uncertain"),
        ),
      );
    return inserted;
  });
  if (insertedConfirmations.length === 0) return;

  const confirmedActivityIds = new Set(
    insertedConfirmations.map(({ activityId }) => activityId),
  );
  await Promise.all(
    uniqueActivities
      .filter((activity) => confirmedActivityIds.has(activity.id))
      .map((activity) =>
        recordAudit({
          action: "activity.occurrence_confirmed",
          subjectType: "activity",
          subjectId: activity.id,
          organizationId: activity.organizationId,
          metadata: { date: today.isoDate, scope: "single_occurrence" },
        }),
      ),
  );
  refresh(locale);
}

export const confirmActivityToday = protectedPermissionAction(
  "content.activity.verify",
  async (formData, locale) => {
    await confirm([activityIdSchema.parse(formData.get("activityId"))], locale);
  },
);

export const confirmActivitiesToday = protectedPermissionAction(
  "content.activity.verify",
  async (formData, locale) => {
    const ids = formData
      .getAll("activityId")
      .map((value) => activityIdSchema.parse(value));
    await confirm(ids, locale);
  },
);

export const cancelActivityToday = protectedPermissionAction(
  "content.activity.verify",
  async (formData, locale) => {
    const activityId = activityIdSchema.parse(formData.get("activityId"));
    const today = parisToday();
    const [existing] = await db
      .select({ id: scheduleExceptions.id })
      .from(scheduleExceptions)
      .where(
        and(
          eq(scheduleExceptions.activityId, activityId),
          eq(scheduleExceptions.date, today.isoDate),
          eq(scheduleExceptions.kind, "cancellation"),
        ),
      );
    if (!existing) {
      await db.insert(scheduleExceptions).values({
        activityId,
        date: today.isoDate,
        kind: "cancellation",
      });
    }
    refresh(locale, activityId);
  },
);

export const undoCancelActivityToday = protectedPermissionAction(
  "content.activity.verify",
  async (formData, locale) => {
    const activityId = activityIdSchema.parse(formData.get("activityId"));
    const today = parisToday();
    await db
      .delete(scheduleExceptions)
      .where(
        and(
          eq(scheduleExceptions.activityId, activityId),
          eq(scheduleExceptions.date, today.isoDate),
          eq(scheduleExceptions.kind, "cancellation"),
        ),
      );
    refresh(locale, activityId);
  },
);

export const markActivityUncertain = protectedPermissionAction(
  "content.activity.verify",
  async (formData, locale) => {
    const activityId = activityIdSchema.parse(formData.get("activityId"));
    const today = parisToday();
    await db
      .insert(scheduleExceptions)
      .values({ activityId, date: today.isoDate, kind: "uncertain" })
      .onConflictDoNothing();
    refresh(locale, activityId);
  },
);
