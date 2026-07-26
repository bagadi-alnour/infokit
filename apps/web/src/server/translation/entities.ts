import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type { EditorialLanguage } from "~/lib/editorial-languages";
import { db } from "~/server/db";
import {
  activities,
  activityTranslations,
  organizationProfileTranslations,
  organizationProfiles,
  translationSourceVersions,
} from "~/server/db/schema";
import type {
  TranslationEntityKind,
  TranslationMethod,
  TranslationState,
} from "./provenance";

/**
 * One adapter per translatable entity, so the translation workflow (generate,
 * request, review, verify) is written once instead of once per content type.
 *
 * The adapters stay hand-written rather than generically plumbed over Drizzle
 * columns: each entity translates a different set of fields, and a concrete
 * function per entity keeps that mapping type-checked.
 */

/** The translatable fields of one language, normalised for the workflow. */
export interface TranslationPayload {
  /** Short label — a name, title, or heading. */
  title: string;
  /** Rich body, already sanitised HTML. Null when the entity has none. */
  bodyHtml: string | null;
  /** Plain-text rendering of `bodyHtml`, used for hashing and previews. */
  plainText: string | null;
}

export interface TargetTranslation extends TranslationPayload {
  languageCode: EditorialLanguage;
  state: TranslationState;
  method: TranslationMethod;
  providerCode: string | null;
  sourceVersionId: string | null;
  /** Set when the source moved after this language was last checked. */
  carriedForwardFromSourceVersionId: string | null;
  verifiedAt: Date | null;
  verifiedByName: string | null;
}

export interface SourceTranslation extends TranslationPayload {
  organizationId: string | null;
  sourceLanguageCode: EditorialLanguage;
}

export interface TranslationEntityAdapter {
  kind: TranslationEntityKind;
  /** Permission that lets an editor author and generate for this entity. */
  managePermission: string;
  /** The authored language and its content, or null when nothing is saved. */
  loadSource(entityId: string): Promise<SourceTranslation | null>;
  /** One target language's stored row, or null when it does not exist yet. */
  loadTarget(
    entityId: string,
    languageCode: EditorialLanguage,
  ): Promise<TargetTranslation | null>;
  /** Promote a checked translation. Returns false when the row is missing. */
  markVerified(input: {
    entityId: string;
    languageCode: EditorialLanguage;
    userId: string;
    sourceVersionId: string;
  }): Promise<boolean>;
}

const activityAdapter: TranslationEntityAdapter = {
  kind: "activity",
  managePermission: "content.activity.manage",
  async loadSource(entityId) {
    const [row] = await db
      .select({
        organizationId: activities.organizationId,
        sourceLanguageCode: activities.sourceLanguageCode,
        title: activityTranslations.name,
        bodyHtml: activityTranslations.descriptionHtml,
        plainText: activityTranslations.descriptionText,
      })
      .from(activities)
      .innerJoin(
        activityTranslations,
        and(
          eq(activityTranslations.activityId, activities.id),
          eq(activityTranslations.languageCode, activities.sourceLanguageCode),
        ),
      )
      .where(eq(activities.id, entityId))
      .limit(1);
    if (!row) return null;
    return {
      organizationId: row.organizationId,
      sourceLanguageCode: row.sourceLanguageCode as EditorialLanguage,
      title: row.title,
      bodyHtml: row.bodyHtml,
      plainText: row.plainText,
    };
  },
  async loadTarget(entityId, languageCode) {
    const [row] = await db
      .select({
        languageCode: activityTranslations.languageCode,
        title: activityTranslations.name,
        bodyHtml: activityTranslations.descriptionHtml,
        plainText: activityTranslations.descriptionText,
        state: activityTranslations.state,
        method: activityTranslations.method,
        providerCode: activityTranslations.providerCode,
        sourceVersionId: activityTranslations.sourceVersionId,
        carriedForwardFromSourceVersionId:
          activityTranslations.carriedForwardFromSourceVersionId,
        verifiedAt: activityTranslations.verifiedAt,
      })
      .from(activityTranslations)
      .where(
        and(
          eq(activityTranslations.activityId, entityId),
          eq(activityTranslations.languageCode, languageCode),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      ...row,
      languageCode: row.languageCode as EditorialLanguage,
      verifiedByName: null,
    };
  },
  async markVerified({ entityId, languageCode, userId, sourceVersionId }) {
    const updated = await db
      .update(activityTranslations)
      .set({
        state: "verified",
        verifiedById: userId,
        verifiedAt: new Date(),
        // Verifying is a statement about the current source, so the row stops
        // trailing an older version.
        carriedForwardFromSourceVersionId: null,
        sourceVersionId,
      })
      .where(
        and(
          eq(activityTranslations.activityId, entityId),
          eq(activityTranslations.languageCode, languageCode),
        ),
      )
      .returning({ languageCode: activityTranslations.languageCode });
    return updated.length > 0;
  },
};

const organizationProfileAdapter: TranslationEntityAdapter = {
  kind: "organization_profile",
  managePermission: "organization.profile.manage",
  async loadSource(entityId) {
    const [org] = await db
      .select({
        organizationId: organizationProfiles.organizationId,
        sourceLanguageCode: organizationProfiles.narrativeSourceLanguage,
      })
      .from(organizationProfiles)
      .where(eq(organizationProfiles.organizationId, entityId))
      .limit(1);
    if (!org) return null;
    const [row] = await db
      .select({
        title: organizationProfileTranslations.purpose,
        bodyHtml: organizationProfileTranslations.presentationHtml,
        plainText: organizationProfileTranslations.presentationText,
      })
      .from(organizationProfileTranslations)
      .where(
        and(
          eq(organizationProfileTranslations.organizationId, entityId),
          eq(
            organizationProfileTranslations.languageCode,
            org.sourceLanguageCode,
          ),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      organizationId: org.organizationId,
      sourceLanguageCode: org.sourceLanguageCode as EditorialLanguage,
      title: row.title,
      bodyHtml: row.bodyHtml,
      plainText: row.plainText,
    };
  },
  async loadTarget(entityId, languageCode) {
    const [row] = await db
      .select({
        languageCode: organizationProfileTranslations.languageCode,
        title: organizationProfileTranslations.purpose,
        bodyHtml: organizationProfileTranslations.presentationHtml,
        plainText: organizationProfileTranslations.presentationText,
        state: organizationProfileTranslations.state,
        method: organizationProfileTranslations.method,
        providerCode: organizationProfileTranslations.providerCode,
        sourceVersionId: organizationProfileTranslations.sourceVersionId,
        carriedForwardFromSourceVersionId:
          organizationProfileTranslations.carriedForwardFromSourceVersionId,
        verifiedAt: organizationProfileTranslations.verifiedAt,
      })
      .from(organizationProfileTranslations)
      .where(
        and(
          eq(organizationProfileTranslations.organizationId, entityId),
          eq(organizationProfileTranslations.languageCode, languageCode),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      ...row,
      languageCode: row.languageCode as EditorialLanguage,
      verifiedByName: null,
    };
  },
  async markVerified({ entityId, languageCode, userId, sourceVersionId }) {
    const updated = await db
      .update(organizationProfileTranslations)
      .set({
        state: "verified",
        verifiedById: userId,
        verifiedAt: new Date(),
        carriedForwardFromSourceVersionId: null,
        sourceVersionId,
      })
      .where(
        and(
          eq(organizationProfileTranslations.organizationId, entityId),
          eq(organizationProfileTranslations.languageCode, languageCode),
        ),
      )
      .returning({
        languageCode: organizationProfileTranslations.languageCode,
      });
    return updated.length > 0;
  },
};

const adapters: Partial<
  Record<TranslationEntityKind, TranslationEntityAdapter>
> = {
  activity: activityAdapter,
  organization_profile: organizationProfileAdapter,
};

export function translationAdapter(
  kind: TranslationEntityKind,
): TranslationEntityAdapter {
  const adapter = adapters[kind];
  if (!adapter) {
    throw new Error(`No translation adapter for ${kind}`);
  }
  return adapter;
}

/** The newest sealed source version for an entity, or null before first save. */
export async function latestSourceVersion(
  kind: TranslationEntityKind,
  entityId: string,
) {
  const [row] = await db
    .select({
      id: translationSourceVersions.id,
      version: translationSourceVersions.version,
      hash: translationSourceVersions.sourceContentHash,
      sourceLanguageCode: translationSourceVersions.sourceLanguageCode,
    })
    .from(translationSourceVersions)
    .where(
      and(
        eq(translationSourceVersions.entityKind, kind),
        eq(translationSourceVersions.entityId, entityId),
      ),
    )
    .orderBy(desc(translationSourceVersions.version))
    .limit(1);
  return row ?? null;
}
