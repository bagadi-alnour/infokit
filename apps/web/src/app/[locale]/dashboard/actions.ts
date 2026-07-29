"use server";

import type { Locale } from "@infokit/shared/i18n";
import { and, eq, inArray, isNull, lte, or, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { localizedPath } from "~/i18n/routing";
import { parisToday } from "~/lib/freshness";
import { recordAudit } from "~/server/audit";
import { platformPermissionsForUser } from "~/server/auth/authorization";
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

/**
 * The organisation an audit row belongs to. Read for its own sake because the
 * daily-status buttons only ever receive an activity id, and a trail row without
 * an organisation is invisible to every association reading their own history.
 */
async function owningOrganization(activityId: string): Promise<string | null> {
  const [activity] = await db
    .select({ organizationId: activities.organizationId })
    .from(activities)
    .where(eq(activities.id, activityId))
    .limit(1);
  return activity?.organizationId ?? null;
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

async function confirm(ids: string[], locale: Locale, actorId: string) {
  const eligible = await eligibleToday(ids);
  const uniqueActivities = [
    ...new Map(eligible.map((activity) => [activity.id, activity])).values(),
  ];
  if (uniqueActivities.length === 0) return;

  const platformPermissions = await platformPermissionsForUser(actorId);
  const verifyingAsPlatform = platformPermissions.has(
    "content.activity.verify",
  );
  const confirmations = uniqueActivities.map((activity) => ({
    activityId: activity.id,
    organizationId: verifyingAsPlatform ? null : activity.organizationId,
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
  async (formData, locale, user) => {
    await confirm(
      [activityIdSchema.parse(formData.get("activityId"))],
      locale,
      user.id,
    );
  },
);

export const confirmActivitiesToday = protectedPermissionAction(
  "content.activity.verify",
  async (formData, locale, user) => {
    const ids = formData
      .getAll("activityId")
      .map((value) => activityIdSchema.parse(value));
    await confirm(ids, locale, user.id);
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
    // Only the first press is an event: pressing an already-cancelled day again
    // changes nothing, and a row per press would say something happened twice.
    if (!existing) {
      await db.insert(scheduleExceptions).values({
        activityId,
        date: today.isoDate,
        kind: "cancellation",
      });
      await recordAudit({
        action: "activity.occurrence_cancelled",
        subjectType: "activity",
        subjectId: activityId,
        organizationId: await owningOrganization(activityId),
        metadata: { date: today.isoDate, scope: "single_occurrence" },
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
    const removed = await db
      .delete(scheduleExceptions)
      .where(
        and(
          eq(scheduleExceptions.activityId, activityId),
          eq(scheduleExceptions.date, today.isoDate),
          eq(scheduleExceptions.kind, "cancellation"),
        ),
      )
      .returning({ id: scheduleExceptions.id });
    if (removed.length > 0) {
      await recordAudit({
        action: "activity.occurrence_cancellation_undone",
        subjectType: "activity",
        subjectId: activityId,
        organizationId: await owningOrganization(activityId),
        metadata: { date: today.isoDate, scope: "single_occurrence" },
      });
    }
    refresh(locale, activityId);
  },
);

export const markActivityUncertain = protectedPermissionAction(
  "content.activity.verify",
  async (formData, locale) => {
    const activityId = activityIdSchema.parse(formData.get("activityId"));
    const today = parisToday();
    const marked = await db
      .insert(scheduleExceptions)
      .values({ activityId, date: today.isoDate, kind: "uncertain" })
      .onConflictDoNothing()
      .returning({ id: scheduleExceptions.id });
    if (marked.length > 0) {
      await recordAudit({
        action: "activity.occurrence_marked_uncertain",
        subjectType: "activity",
        subjectId: activityId,
        organizationId: await owningOrganization(activityId),
        metadata: { date: today.isoDate, scope: "single_occurrence" },
      });
    }
    refresh(locale, activityId);
  },
);
