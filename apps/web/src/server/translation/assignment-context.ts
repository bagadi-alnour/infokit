import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { createAssetReadUrl } from "~/server/assets/s3";
import { db } from "~/server/db";
import {
  activities,
  activityAssets,
  activityServices,
  activityTags,
  assetTranslations,
  assets,
  audienceCategories,
  audienceCategoryTranslations,
  editorialEntryAssets,
  editorialEntryTags,
  editorialRelatedServices,
  serviceCategories,
  serviceCategoryTranslations,
  serviceTranslations,
  tagTranslations,
  tags,
} from "~/server/db/schema";
import type { TranslationEntityKind } from "./provenance";

/**
 * Everything around the words a translator is asked for: the photo the text sits
 * under, and the labels the record already carries.
 *
 * None of it is work. A tag, a category and a service are catalogue rows the
 * platform translates once, centrally — a translator asked to render them again
 * would be inventing a second wording for something that already has one — so
 * they arrive *in the target language*, as reading matter, with no field to type
 * them into. What they buy is the difference between translating three
 * paragraphs and translating three paragraphs about a women-only shower service.
 *
 * The labels are read live rather than pinned to the assignment's source
 * version: they are not what the assignment is about, and a catalogue correction
 * landing mid-errand should reach the translator rather than wait behind a
 * snapshot. The translatable text stays pinned, as it always was.
 */
export interface AssignmentContext {
  /** The record's cover image, if it has one, and its alt text. */
  cover: { url: string; altText: string | null } | null;
  /** What kind of thing this is: its service category and its audience. */
  categories: string[];
  tags: string[];
  services: string[];
}

const empty: AssignmentContext = {
  cover: null,
  categories: [],
  tags: [],
  services: [],
};

/** One catalogue row joined to one of its translations, possibly none. */
interface LabelRow {
  id: string;
  /** Read when no translation of this row is usable — a code names it at least. */
  fallback: string;
  languageCode: string | null;
  label: string | null;
}

/**
 * Collapse a translations join to one label per row, keeping the order the rows
 * arrived in: the translator's own language, then the language the record was
 * written in, then whatever translation exists, then the row's code.
 *
 * The last two steps matter for a catalogue nobody has finished translating: a
 * tag showing as `showers` still tells a translator what they are working on,
 * and a blank chip tells them nothing.
 */
function bestLabels(
  rows: LabelRow[],
  targetLanguage: string,
  sourceLanguage: string,
): string[] {
  const order: string[] = [];
  const byId = new Map<string, Map<string, string>>();
  const fallbacks = new Map<string, string>();
  for (const row of rows) {
    let labels = byId.get(row.id);
    if (!labels) {
      labels = new Map();
      byId.set(row.id, labels);
      fallbacks.set(row.id, row.fallback);
      order.push(row.id);
    }
    if (row.languageCode && row.label) labels.set(row.languageCode, row.label);
  }
  return order
    .map((id) => {
      const labels = byId.get(id) ?? new Map<string, string>();
      return (
        labels.get(targetLanguage) ??
        labels.get(sourceLanguage) ??
        [...labels.values()][0] ??
        fallbacks.get(id) ??
        ""
      );
    })
    .filter((label) => label.length > 0);
}

/** One cover asset joined to its alt texts: a short-lived signed read URL. */
async function bestCover(
  rows: {
    storageKey: string;
    mimeType: string;
    languageCode: string | null;
    altText: string | null;
  }[],
  targetLanguage: string,
  sourceLanguage: string,
): Promise<AssignmentContext["cover"]> {
  const first = rows[0];
  if (!first) return null;
  const alts = new Map(
    rows.flatMap((row) =>
      row.languageCode && row.altText ? [[row.languageCode, row.altText]] : [],
    ),
  );
  return {
    url: await createAssetReadUrl(first.storageKey, {
      contentType: first.mimeType,
    }),
    altText: alts.get(targetLanguage) ?? alts.get(sourceLanguage) ?? null,
  };
}

async function activityContext(
  entityId: string,
  targetLanguage: string,
  sourceLanguage: string,
): Promise<AssignmentContext> {
  const [activity] = await db
    .select({
      categoryId: activities.categoryId,
      audienceCategoryId: activities.audienceCategoryId,
    })
    .from(activities)
    .where(eq(activities.id, entityId))
    .limit(1);
  if (!activity) return empty;

  const [categoryRows, audienceRows, tagRows, serviceRows, coverRows] =
    await Promise.all([
      db
        .select({
          id: serviceCategories.id,
          fallback: serviceCategories.code,
          languageCode: serviceCategoryTranslations.languageCode,
          label: serviceCategoryTranslations.label,
        })
        .from(serviceCategories)
        .leftJoin(
          serviceCategoryTranslations,
          eq(serviceCategoryTranslations.categoryId, serviceCategories.id),
        )
        .where(eq(serviceCategories.id, activity.categoryId)),
      db
        .select({
          id: audienceCategories.id,
          fallback: audienceCategories.code,
          languageCode: audienceCategoryTranslations.languageCode,
          label: audienceCategoryTranslations.label,
        })
        .from(audienceCategories)
        .leftJoin(
          audienceCategoryTranslations,
          eq(
            audienceCategoryTranslations.audienceCategoryId,
            audienceCategories.id,
          ),
        )
        .where(eq(audienceCategories.id, activity.audienceCategoryId)),
      db
        .select({
          id: tags.id,
          fallback: tags.code,
          languageCode: tagTranslations.languageCode,
          label: tagTranslations.label,
        })
        .from(activityTags)
        .innerJoin(tags, eq(tags.id, activityTags.tagId))
        .leftJoin(tagTranslations, eq(tagTranslations.tagId, tags.id))
        .where(eq(activityTags.activityId, entityId))
        .orderBy(asc(activityTags.displayOrder)),
      db
        .select({
          id: activityServices.serviceId,
          languageCode: serviceTranslations.languageCode,
          label: serviceTranslations.name,
        })
        .from(activityServices)
        .leftJoin(
          serviceTranslations,
          eq(serviceTranslations.serviceId, activityServices.serviceId),
        )
        .where(
          and(
            eq(activityServices.activityId, entityId),
            eq(activityServices.active, true),
          ),
        )
        .orderBy(asc(activityServices.displayOrder)),
      db
        .select({
          storageKey: assets.storageKey,
          mimeType: assets.mimeType,
          languageCode: assetTranslations.languageCode,
          altText: assetTranslations.altText,
        })
        .from(activityAssets)
        .innerJoin(assets, eq(assets.id, activityAssets.assetId))
        .leftJoin(
          assetTranslations,
          eq(assetTranslations.assetId, activityAssets.assetId),
        )
        .where(
          and(
            eq(activityAssets.activityId, entityId),
            eq(activityAssets.role, "cover"),
            eq(activityAssets.active, true),
          ),
        ),
    ]);

  return {
    cover: await bestCover(coverRows, targetLanguage, sourceLanguage),
    categories: [
      ...bestLabels(categoryRows, targetLanguage, sourceLanguage),
      ...bestLabels(audienceRows, targetLanguage, sourceLanguage),
    ],
    tags: bestLabels(tagRows, targetLanguage, sourceLanguage),
    // A service is named by its translations only: there is no code to fall
    // back to that a reader would recognise.
    services: bestLabels(
      serviceRows.map((row) => ({ ...row, fallback: "" })),
      targetLanguage,
      sourceLanguage,
    ),
  };
}

async function editorialEntryContext(
  entityId: string,
  targetLanguage: string,
  sourceLanguage: string,
): Promise<AssignmentContext> {
  const [tagRows, serviceRows, coverRows] = await Promise.all([
    db
      .select({
        id: tags.id,
        fallback: tags.code,
        languageCode: tagTranslations.languageCode,
        label: tagTranslations.label,
      })
      .from(editorialEntryTags)
      .innerJoin(tags, eq(tags.id, editorialEntryTags.tagId))
      .leftJoin(tagTranslations, eq(tagTranslations.tagId, tags.id))
      .where(eq(editorialEntryTags.entryId, entityId))
      .orderBy(asc(editorialEntryTags.displayOrder)),
    db
      .select({
        id: editorialRelatedServices.serviceId,
        languageCode: serviceTranslations.languageCode,
        label: serviceTranslations.name,
      })
      .from(editorialRelatedServices)
      .leftJoin(
        serviceTranslations,
        eq(serviceTranslations.serviceId, editorialRelatedServices.serviceId),
      )
      .where(eq(editorialRelatedServices.entryId, entityId))
      .orderBy(asc(editorialRelatedServices.displayOrder)),
    db
      .select({
        storageKey: assets.storageKey,
        mimeType: assets.mimeType,
        languageCode: assetTranslations.languageCode,
        altText: assetTranslations.altText,
      })
      .from(editorialEntryAssets)
      .innerJoin(assets, eq(assets.id, editorialEntryAssets.assetId))
      .leftJoin(
        assetTranslations,
        eq(assetTranslations.assetId, editorialEntryAssets.assetId),
      )
      .where(
        and(
          eq(editorialEntryAssets.entryId, entityId),
          eq(editorialEntryAssets.role, "cover"),
        ),
      ),
  ]);

  return {
    cover: await bestCover(coverRows, targetLanguage, sourceLanguage),
    // An article is classified by its tags, not by a category row.
    categories: [],
    tags: bestLabels(tagRows, targetLanguage, sourceLanguage),
    services: bestLabels(
      serviceRows.map((row) => ({ ...row, fallback: "" })),
      targetLanguage,
      sourceLanguage,
    ),
  };
}

/**
 * The reference matter for one assignment, or nothing for a kind that carries
 * none: a simulator flow and an organisation narrative are their own whole
 * picture, with no photo and no label to set beside them.
 *
 * A failure here never costs the translator their page — the words are the
 * errand and this is the margin around them — so the caller is handed an empty
 * context rather than an error.
 */
export async function loadAssignmentContext(input: {
  kind: TranslationEntityKind;
  entityId: string;
  targetLanguage: string;
  sourceLanguage: string;
}): Promise<AssignmentContext> {
  const { kind, entityId, targetLanguage, sourceLanguage } = input;
  try {
    if (kind === "activity") {
      return await activityContext(entityId, targetLanguage, sourceLanguage);
    }
    if (kind === "editorial_entry") {
      return await editorialEntryContext(
        entityId,
        targetLanguage,
        sourceLanguage,
      );
    }
    return empty;
  } catch {
    return empty;
  }
}

/** Whether there is anything at all worth drawing a panel for. */
export function hasAssignmentContext(context: AssignmentContext): boolean {
  return (
    context.cover !== null ||
    context.categories.length > 0 ||
    context.tags.length > 0 ||
    context.services.length > 0
  );
}
