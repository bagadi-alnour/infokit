"use server";

import type { Locale } from "@infokit/shared/i18n";
import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "~/env";
import { localizedPath } from "~/i18n/routing";
import { editorialLanguageCodes } from "~/lib/editorial-languages";
import { EDITOR_CONTACT_OPTION_ID } from "~/lib/editor-contact";
import { recordAudit } from "~/server/audit";
import { verifyAssetUpload } from "~/server/assets/s3";
import { auth } from "~/server/auth";
import {
  getRoleTestState,
  hasActualPlatformPermission,
  platformPermissionsForUser,
} from "~/server/auth/authorization";
import { protectedPermissionAction } from "~/server/auth/require";
import { catalogueScopeKey } from "~/server/content/catalogue-scope";
import { sanitizeRichText } from "~/server/content/sanitize-rich-text";
import { hashContent } from "~/server/content/editorial";
import {
  classifyTranslation,
  translationPayloadHash,
} from "~/server/translation/provenance";
import { parseScheduledPublication } from "~/server/content/publication-schedule";
import { db } from "~/server/db";
import { sendMemberInvitation } from "~/server/invitations";
import {
  parseSkills,
  replaceMemberProfileFacets,
  validLanguageCodes,
} from "~/server/members";
import {
  hasScheduleRuleOverlap,
  scheduleRulesOverlap,
} from "~/lib/schedule-overlap";
import { uniqueSlug } from "~/lib/slug";
import {
  activities,
  activityAssets,
  activityContacts,
  activityCreatorOrganizations,
  activityMemberAssignments,
  activityPublications,
  activityProviders,
  activityServices,
  activityTags,
  activityTranslations,
  assets,
  assetTranslations,
  cities,
  cityTeamMembers,
  cityTeams,
  contacts,
  contactTranslations,
  languages as languageCatalog,
  organizationMembers,
  organizations,
  places,
  placeTranslations,
  scheduleExceptions,
  scheduleExceptionTranslations,
  scheduleRules,
  services,
  serviceTranslations,
  tags,
  translationSourceVersions,
  users,
} from "~/server/db/schema";

const optional = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value));

const editorialLanguageSchema = z.enum(editorialLanguageCodes);
const publicationModeSchema = z.enum(["draft", "now", "scheduled"]);

const scheduleRowSchema = z.object({
  weekday: z.coerce.number().int().min(1).max(7),
  timingMode: z.enum(["fixed", "flexible"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

function stringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const createActivitySchema = z.object({
  organizationId: z.string().uuid(),
  /**
   * `global` is the rare case — a helpline or an online service that belongs to
   * no city. It carries no city, no city team, and no place.
   */
  scope: z.enum(["city", "global"]).default("city"),
  cityId: z.string().uuid().nullable(),
  sourceLanguage: editorialLanguageSchema,
  locationMode: z.enum(["existing", "new", "mobile"]),
  placeId: optional,
  placeName: optional,
  addressLine: optional,
  postalCode: optional,
  lat: optional,
  lng: optional,
  precision: z.enum(["exact", "area_only", "contact_to_learn"]),
  teamName: optional,
  categoryId: z.string().uuid(),
  audienceCategoryId: z.string().uuid(),
  sourceNote: optional,
  scheduleType: z.enum(["recurring", "one_off"]),
  occurrenceDate: optional,
  validFrom: optional,
  validTo: optional,
  exceptionDate: optional,
  exceptionKind: z
    .enum(["closure", "cancellation", "exceptional_opening", "uncertain"])
    .optional(),
  exceptionStartTime: optional,
  exceptionEndTime: optional,
  exceptionReason: optional,
  coverAssetId: optional,
  publicationMode: publicationModeSchema.default("draft"),
  publishAt: optional,
});

function refresh(locale: Locale) {
  revalidatePath(localizedPath("/dashboard", locale));
  revalidatePath(localizedPath("/dashboard/activities", locale));
}

export const createActivity = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const scope = formData.get("scope") === "global" ? "global" : "city";
    const parsed = createActivitySchema.parse({
      organizationId: formData.get("organizationId"),
      scope,
      // A global activity submits no city at all, and must not inherit one.
      cityId: scope === "global" ? null : formData.get("cityId"),
      sourceLanguage: formData.get("sourceLanguage"),
      locationMode:
        scope === "global" ? "mobile" : formData.get("locationMode"),
      placeId: formData.get("placeId") ?? "",
      placeName: formData.get("placeName") ?? "",
      addressLine: formData.get("addressLine") ?? "",
      postalCode: formData.get("postalCode") ?? "",
      lat: formData.get("lat") ?? "",
      lng: formData.get("lng") ?? "",
      precision: formData.get("precision"),
      teamName: formData.get("teamName") ?? "",
      categoryId: formData.get("categoryId"),
      audienceCategoryId: formData.get("audienceCategoryId"),
      sourceNote: formData.get("sourceNote") ?? "",
      scheduleType: formData.get("scheduleType"),
      occurrenceDate: formData.get("occurrenceDate") ?? "",
      validFrom: formData.get("validFrom") ?? "",
      validTo: formData.get("validTo") ?? "",
      exceptionDate: formData.get("exceptionDate") ?? "",
      exceptionKind: formData.get("exceptionKind") ?? undefined,
      exceptionStartTime: formData.get("exceptionStartTime") ?? "",
      exceptionEndTime: formData.get("exceptionEndTime") ?? "",
      exceptionReason: formData.get("exceptionReason") ?? "",
      coverAssetId: formData.get("coverAssetId") ?? "",
      publicationMode: formData.get("publicationMode") ?? "draft",
      publishAt: formData.get("publishAt") ?? "",
    });
    const scheduledFor = parseScheduledPublication(
      parsed.publicationMode,
      parsed.publishAt,
    );
    const weekdays = formData.getAll("scheduleWeekday");
    const timingModes = formData.getAll("scheduleTimingMode");
    const startTimes = formData.getAll("scheduleStartTime");
    const endTimes = formData.getAll("scheduleEndTime");
    const scheduleRows = z
      .array(scheduleRowSchema)
      .min(1)
      .max(7)
      .parse(
        timingModes.map((timingMode, index) => ({
          weekday: parsed.scheduleType === "one_off" ? 1 : weekdays[index],
          timingMode,
          startTime: startTimes[index],
          endTime: endTimes[index],
        })),
      );
    for (const row of scheduleRows) {
      if (row.startTime >= row.endTime) {
        throw new Error("The end time must be after the start time");
      }
    }
    if (parsed.scheduleType === "recurring") {
      for (const [index, row] of scheduleRows.entries()) {
        if (hasScheduleRuleOverlap(row, scheduleRows.slice(0, index))) {
          throw new Error("Schedule windows cannot overlap");
        }
      }
    }
    if (
      parsed.validFrom &&
      parsed.validTo &&
      parsed.validFrom > parsed.validTo
    ) {
      throw new Error("The schedule end date must be after its start date");
    }
    if (parsed.scheduleType === "one_off" && !parsed.occurrenceDate) {
      throw new Error("A one-off activity requires an occurrence date");
    }
    if (
      Boolean(parsed.exceptionStartTime) !== Boolean(parsed.exceptionEndTime)
    ) {
      throw new Error("An exceptional time window needs both times");
    }
    if (
      parsed.exceptionStartTime &&
      parsed.exceptionEndTime &&
      parsed.exceptionStartTime >= parsed.exceptionEndTime
    ) {
      throw new Error("The exceptional end time must follow its start time");
    }

    // An editor can generate translations before the first save, so creation
    // carries signed proposals exactly like an update does.
    const translations = editorialLanguageCodes
      .map((languageCode) => {
        const name = stringField(formData, `name_${languageCode}`);
        const description = sanitizeRichText(
          stringField(formData, `description_${languageCode}_html`),
        );
        return {
          languageCode,
          name,
          descriptionHtml: description.html,
          descriptionText: description.text,
          shortDescription: description.text?.slice(0, 500) ?? null,
          signature: optionalStringField(
            formData,
            `translation_proposal_${languageCode}`,
          ),
        };
      })
      .filter((translation) => translation.name.length > 0);
    /**
     * Alternative text is content, not metadata: it is what a screen-reader
     * user hears in place of the photograph, so it is translated alongside the
     * title and body and stored per language on the asset itself.
     */
    const imageAltTexts = editorialLanguageCodes
      .map((languageCode) => ({
        languageCode,
        altText: stringField(formData, `image_alt_${languageCode}`).slice(
          0,
          500,
        ),
        fromMachine: Boolean(
          optionalStringField(formData, `translation_proposal_${languageCode}`),
        ),
      }))
      .filter((row) => row.altText.length > 0);
    const sourceTranslation = translations.find(
      (translation) => translation.languageCode === parsed.sourceLanguage,
    );
    if (!sourceTranslation || sourceTranslation.name.length < 2) {
      throw new Error("The source language needs a title");
    }
    const sourceName = sourceTranslation.name;

    const serviceIds = z
      .array(z.string().uuid())
      .parse(formData.getAll("serviceId"));
    const uniqueServiceIds = [...new Set(serviceIds)];
    const tagIds = [
      ...new Set(z.array(z.string().uuid()).parse(formData.getAll("tagId"))),
    ];
    /**
     * Contacts, plus the option that stands for the editor themselves. That one
     * is not a stored contact yet, so it travels as a sentinel and is resolved
     * to a real row below rather than linked straight through.
     */
    const submittedContactIds = z
      .array(z.union([z.string().uuid(), z.literal(EDITOR_CONTACT_OPTION_ID)]))
      .parse(formData.getAll("contactId"));
    const wantsEditorContact = submittedContactIds.includes(
      EDITOR_CONTACT_OPTION_ID,
    );
    const contactIds = [
      ...new Set(
        submittedContactIds.filter((id) => id !== EDITOR_CONTACT_OPTION_ID),
      ),
    ];
    const creatorOrganizationIds = [
      ...new Set(
        z
          .array(z.string().uuid())
          .parse(formData.getAll("creatorOrganizationId")),
      ),
    ];
    const providerOrganizationIds = [
      ...new Set(
        z
          .array(z.string().uuid())
          .parse(formData.getAll("providerOrganizationId")),
      ),
    ];
    if (!creatorOrganizationIds.includes(parsed.organizationId)) {
      creatorOrganizationIds.unshift(parsed.organizationId);
    }
    if (!providerOrganizationIds.includes(parsed.organizationId)) {
      providerOrganizationIds.unshift(parsed.organizationId);
    }

    const session = await auth();
    const actorId = session?.user.id;
    if (!actorId) throw new Error("Authentication required");
    /**
     * What "reach me" publishes: the address the editor signs in with, which is
     * the only one the console knows. An account without one cannot stand in as
     * the contact for a whole activity.
     */
    const editorContactValue = session.user.email?.trim() ?? "";
    const editorContactLabel = session.user.name?.trim() ?? "";
    if (wantsEditorContact && !editorContactValue) {
      throw new Error("Your account has no address to publish as a contact");
    }
    const [authorization, platformPermissions] = await Promise.all([
      getRoleTestState(actorId, parsed.organizationId),
      platformPermissionsForUser(actorId),
    ]);
    const actingOrganizationId =
      authorization.assumedOrganizationId ??
      (platformPermissions.has("content.activity.manage")
        ? null
        : parsed.organizationId);
    const createdByScope = actingOrganizationId ? "organization" : "platform";
    const relationshipValues = (organizationId: string) => {
      const confirmed = organizationId === actingOrganizationId;
      return {
        organizationId,
        state: confirmed ? ("confirmed" as const) : ("proposed" as const),
        proposedById: actorId,
        confirmedById: confirmed ? actorId : null,
        confirmedAt: confirmed ? new Date() : null,
      };
    };
    if (parsed.publicationMode !== "draft") {
      const confirmedProviderIds = actingOrganizationId
        ? providerOrganizationIds.filter(
            (organizationId) => organizationId === actingOrganizationId,
          )
        : [];
      const verifiedProviders =
        confirmedProviderIds.length === 0
          ? []
          : await db
              .select({ id: organizations.id })
              .from(organizations)
              .where(
                and(
                  inArray(organizations.id, confirmedProviderIds),
                  eq(organizations.status, "verified"),
                  eq(organizations.publishingSuspended, false),
                ),
              );
      if (verifiedProviders.length === 0) {
        throw new Error(
          "Publication requires at least one confirmed, verified provider",
        );
      }
    }
    if (uniqueServiceIds.length > 0) {
      const validServices = await db
        .select({ id: services.id })
        .from(services)
        .where(
          and(
            inArray(services.id, uniqueServiceIds),
            eq(services.active, true),
            isNull(services.archivedAt),
            or(
              isNull(services.organizationId),
              eq(services.organizationId, parsed.organizationId),
            ),
          ),
        );
      if (validServices.length !== uniqueServiceIds.length) {
        throw new Error(
          "One or more services are unavailable in this organisation",
        );
      }
    }

    if (parsed.scope === "city" && !parsed.cityId) {
      throw new Error("Choose the city this activity happens in");
    }
    if (parsed.scope === "global" && parsed.locationMode !== "mobile") {
      throw new Error("A global activity cannot be attached to a place");
    }
    if (parsed.locationMode === "existing" && !parsed.placeId) {
      throw new Error("Choose an existing place");
    }
    if (parsed.locationMode === "new" && !parsed.placeName) {
      throw new Error("A new place needs a name");
    }
    if (
      parsed.locationMode === "new" &&
      parsed.precision === "exact" &&
      (!parsed.addressLine || !parsed.lat || !parsed.lng)
    ) {
      throw new Error("Select an address suggestion for an exact location");
    }
    if (
      parsed.locationMode === "new" &&
      parsed.precision === "contact_to_learn" &&
      contactIds.length === 0 &&
      !wantsEditorContact
    ) {
      throw new Error("Contact-to-learn locations require a safe contact");
    }
    if (parsed.locationMode === "existing" && parsed.placeId) {
      const [place] = await db
        .select({ cityId: places.cityId })
        .from(places)
        .where(eq(places.id, parsed.placeId));
      if (place?.cityId !== parsed.cityId) {
        throw new Error("The activity location must be in the selected city");
      }
    }

    if (tagIds.length > 0) {
      const allowedTags = await db
        .select({ id: tags.id })
        .from(tags)
        .where(
          and(
            inArray(tags.id, tagIds),
            eq(tags.active, true),
            eq(tags.visibility, "public"),
            or(
              isNull(tags.organizationId),
              eq(tags.organizationId, parsed.organizationId),
            ),
          ),
        );
      if (allowedTags.length !== tagIds.length) {
        throw new Error("One or more tags are unavailable in this scope");
      }
    }
    if (contactIds.length > 0) {
      const allowedContacts = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            inArray(contacts.id, contactIds),
            eq(contacts.organizationId, parsed.organizationId),
            eq(contacts.active, true),
            eq(contacts.visibility, "public"),
          ),
        );
      if (allowedContacts.length !== contactIds.length) {
        throw new Error("One or more contacts are unavailable");
      }
    }

    if (parsed.coverAssetId) {
      const [uploadedCover] = await db
        .select({
          storageKey: assets.storageKey,
          mimeType: assets.mimeType,
          byteSize: assets.byteSize,
        })
        .from(assets)
        .where(
          and(
            eq(assets.id, parsed.coverAssetId),
            eq(assets.uploaderId, actorId),
            eq(assets.kind, "image"),
            eq(assets.rightsConfirmed, true),
            isNull(assets.archivedAt),
          ),
        )
        .limit(1);
      if (!uploadedCover) throw new Error("The activity image is unavailable");
      await verifyAssetUpload(uploadedCover);
    }

    // Null exactly when the scope is global; the check above guarantees it.
    const cityId = parsed.cityId;

    const activity = await db.transaction(async (tx) => {
      // Teams are an organisation-and-city pair, so a global activity has none.
      let teamId: string | null = null;
      if (cityId) {
        let [team] = await tx
          .select({ id: cityTeams.id })
          .from(cityTeams)
          .where(
            and(
              eq(cityTeams.organizationId, parsed.organizationId),
              eq(cityTeams.cityId, cityId),
            ),
          );

        if (!team) {
          const [city] = await tx
            .select({ code: cities.code })
            .from(cities)
            .where(eq(cities.id, cityId));
          [team] = await tx
            .insert(cityTeams)
            .values({
              organizationId: parsed.organizationId,
              cityId,
              name:
                parsed.teamName ?? `${city?.code ?? "City"} publishing team`,
            })
            .returning({ id: cityTeams.id });
        }
        if (!team) throw new Error("City team insert returned no row");
        teamId = team.id;
      }

      let placeId = parsed.locationMode === "existing" ? parsed.placeId : null;
      if (parsed.locationMode === "new") {
        if (!cityId) throw new Error("A new place needs a city");
        const latitude = parsed.lat === null ? null : Number(parsed.lat);
        const longitude = parsed.lng === null ? null : Number(parsed.lng);
        if (
          (latitude !== null && !Number.isFinite(latitude)) ||
          (longitude !== null && !Number.isFinite(longitude))
        ) {
          throw new Error("The selected address coordinates are invalid");
        }
        const [createdPlace] = await tx
          .insert(places)
          .values({
            organizationId: parsed.organizationId,
            cityId,
            addressLine: parsed.addressLine,
            postalCode: parsed.postalCode,
            lat: latitude,
            lng: longitude,
            precision: parsed.precision,
          })
          .returning({ id: places.id });
        if (!createdPlace) throw new Error("Place insert returned no row");
        placeId = createdPlace.id;
        await tx.insert(placeTranslations).values({
          placeId,
          languageCode: parsed.sourceLanguage,
          name: parsed.placeName ?? sourceName,
          state: "draft",
        });
      }

      const [created] = await tx
        .insert(activities)
        .values({
          slug: uniqueSlug(sourceName, "activity"),
          organizationId: parsed.organizationId,
          cityId,
          teamId,
          placeId,
          categoryId: parsed.categoryId,
          audienceCategoryId: parsed.audienceCategoryId,
          sourceLanguageCode: parsed.sourceLanguage,
          sourceNote: parsed.sourceNote,
          createdById: actorId,
          createdByScope,
          provisionedByPlatform: createdByScope === "platform",
        })
        .returning({ id: activities.id });
      if (!created) throw new Error("Activity insert returned no row");

      const translationValues = translations;

      /**
       * Version 1 seals the authored language only — the same shape and hash
       * input `updateActivityContent` uses. Sealing the whole multilingual
       * payload here would make the very first edit look like a source change
       * and demote every translation that came with it.
       */
      const sourcePayload = {
        sourceLanguage: parsed.sourceLanguage,
        title: sourceTranslation.name,
        summary: sourceTranslation.shortDescription,
        bodyHtml: sourceTranslation.descriptionHtml,
        plainText: sourceTranslation.descriptionText,
      };
      const [sourceVersion] = await tx
        .insert(translationSourceVersions)
        .values({
          organizationId: parsed.organizationId,
          entityKind: "activity",
          entityId: created.id,
          version: 1,
          sourceLanguageCode: parsed.sourceLanguage,
          sourceContentJson: sourcePayload,
          sourceContentHash: hashContent(sourcePayload),
          impact: "initial",
          createdById: actorId,
        })
        .returning({ id: translationSourceVersions.id });
      if (!sourceVersion)
        throw new Error("Source version insert returned no row");

      await tx.insert(activityTranslations).values(
        translationValues.map(({ signature, ...translation }) => {
          const payload = {
            title: translation.name,
            bodyHtml: translation.descriptionHtml,
          };
          const isSource = translation.languageCode === parsed.sourceLanguage;
          const provenance = classifyTranslation({
            entityKind: "activity",
            targetLanguageCode: translation.languageCode,
            payload,
            signature,
            isSource,
          });
          return {
            activityId: created.id,
            ...translation,
            state: provenance.state,
            method: provenance.method,
            providerCode: provenance.providerCode,
            sourceVersionId: sourceVersion.id,
            contentHash: translationPayloadHash({
              languageCode: translation.languageCode,
              ...payload,
            }),
            ...(isSource
              ? { verifiedById: actorId, verifiedAt: new Date() }
              : {}),
          };
        }),
      );
      if (parsed.publicationMode !== "draft") {
        await tx.insert(activityPublications).values({
          activityId: created.id,
          languageCode: parsed.sourceLanguage,
          sourceVersionId: sourceVersion.id,
          translationContentHash: hashContent({
            languageCode: sourceTranslation.languageCode,
            title: sourceTranslation.name,
            descriptionHtml: sourceTranslation.descriptionHtml,
            descriptionText: sourceTranslation.descriptionText,
          }),
          publishedById: actorId,
          scheduledFor,
        });
        // The source language was already stamped verified on insert: it is
        // authored, not translated.
        if (!scheduledFor) {
          await tx
            .update(activities)
            .set({ published: true, updatedAt: new Date() })
            .where(eq(activities.id, created.id));
          if (parsed.coverAssetId) {
            await tx
              .update(assets)
              .set({ visibility: "public", updatedAt: new Date() })
              .where(eq(assets.id, parsed.coverAssetId));
          }
        }
      }
      await tx.insert(activityCreatorOrganizations).values(
        creatorOrganizationIds.map((organizationId) => ({
          activityId: created.id,
          ...relationshipValues(organizationId),
        })),
      );
      await tx.insert(activityProviders).values(
        providerOrganizationIds.map((organizationId, displayOrder) => ({
          activityId: created.id,
          displayOrder,
          ...relationshipValues(organizationId),
        })),
      );
      if (uniqueServiceIds.length > 0) {
        await tx.insert(activityServices).values(
          uniqueServiceIds.map((serviceId, displayOrder) => ({
            activityId: created.id,
            serviceId,
            displayOrder,
          })),
        );
      }
      if (tagIds.length > 0) {
        await tx.insert(activityTags).values(
          tagIds.map((tagId, displayOrder) => ({
            activityId: created.id,
            tagId,
            displayOrder,
          })),
        );
      }
      const linkedContactIds = [...contactIds];
      if (wantsEditorContact) {
        /**
         * The editor becomes a contact the organisation owns, reused on their
         * next activity instead of duplicated. The match is on the address, and
         * only against rows that are still public and active: a contact somebody
         * archived or made workspace-only on purpose is not quietly republished.
         */
        const [existingContact] = await tx
          .select({ id: contacts.id })
          .from(contacts)
          .where(
            and(
              eq(contacts.organizationId, parsed.organizationId),
              eq(contacts.kind, "email"),
              eq(contacts.value, editorContactValue),
              eq(contacts.active, true),
              eq(contacts.visibility, "public"),
            ),
          )
          .limit(1);
        let editorContactId = existingContact?.id;
        if (!editorContactId) {
          const [insertedContact] = await tx
            .insert(contacts)
            .values({
              organizationId: parsed.organizationId,
              kind: "email",
              value: editorContactValue,
            })
            .returning({ id: contacts.id });
          if (!insertedContact) {
            throw new Error("Could not save the contact for this activity");
          }
          editorContactId = insertedContact.id;
          await tx.insert(contactTranslations).values({
            contactId: editorContactId,
            languageCode: locale,
            label: (editorContactLabel.length > 0
              ? editorContactLabel
              : editorContactValue
            ).slice(0, 100),
          });
        }
        // The same row may already be in the list as a stored contact, and
        // `activity_contacts` is keyed on the pair.
        if (!linkedContactIds.includes(editorContactId)) {
          linkedContactIds.push(editorContactId);
        }
      }
      if (linkedContactIds.length > 0) {
        await tx.insert(activityContacts).values(
          linkedContactIds.map((contactId, displayOrder) => ({
            activityId: created.id,
            contactId,
            displayOrder,
          })),
        );
      }
      if (parsed.coverAssetId) {
        const [cover] = await tx
          .select({ id: assets.id })
          .from(assets)
          .where(
            and(
              eq(assets.id, parsed.coverAssetId),
              eq(assets.uploaderId, actorId),
              eq(assets.kind, "image"),
              eq(assets.rightsConfirmed, true),
              isNull(assets.archivedAt),
            ),
          )
          .limit(1);
        if (!cover) throw new Error("The activity image is unavailable");
        await tx.insert(activityAssets).values({
          activityId: created.id,
          assetId: cover.id,
          role: "cover",
          languageCode: parsed.sourceLanguage,
        });
        if (imageAltTexts.length > 0) {
          // The upload already wrote the source row, and the editor may have
          // reworded it since, so every language is an upsert.
          const altState = {
            authored: "verified",
            machine: "machine_generated",
            human: "draft",
          } as const;
          await tx
            .insert(assetTranslations)
            .values(
              imageAltTexts.map((row) => ({
                assetId: cover.id,
                languageCode: row.languageCode,
                altText: row.altText,
                state:
                  row.languageCode === parsed.sourceLanguage
                    ? altState.authored
                    : row.fromMachine
                      ? altState.machine
                      : altState.human,
              })),
            )
            .onConflictDoUpdate({
              target: [
                assetTranslations.assetId,
                assetTranslations.languageCode,
              ],
              set: {
                altText: sql`excluded.alt_text`,
                state: sql`excluded.state`,
              },
            });
        }
      }

      const occurrenceDate = parsed.occurrenceDate;
      const occurrenceWeekday = occurrenceDate
        ? new Date(`${occurrenceDate}T12:00:00Z`).getUTCDay() || 7
        : null;
      await tx.insert(scheduleRules).values(
        scheduleRows.map((row) => ({
          activityId: created.id,
          weekday:
            parsed.scheduleType === "one_off"
              ? (occurrenceWeekday ?? row.weekday)
              : row.weekday,
          timingMode: row.timingMode,
          startTime: row.startTime,
          endTime: row.endTime,
          validFrom:
            parsed.scheduleType === "one_off"
              ? occurrenceDate
              : parsed.validFrom,
          validTo:
            parsed.scheduleType === "one_off" ? occurrenceDate : parsed.validTo,
        })),
      );

      if (parsed.exceptionDate && parsed.exceptionKind) {
        const [exception] = await tx
          .insert(scheduleExceptions)
          .values({
            activityId: created.id,
            date: parsed.exceptionDate,
            kind: parsed.exceptionKind,
            startTime: parsed.exceptionStartTime,
            endTime: parsed.exceptionEndTime,
            createdById: actorId,
          })
          .returning({ id: scheduleExceptions.id });
        if (!exception)
          throw new Error("Schedule exception insert returned no row");
        if (parsed.exceptionReason) {
          await tx.insert(scheduleExceptionTranslations).values({
            exceptionId: exception.id,
            languageCode: parsed.sourceLanguage,
            publicReason: parsed.exceptionReason,
          });
        }
      }
      return created;
    });

    await recordAudit({
      action: "activity.created",
      subjectType: "activity",
      subjectId: activity.id,
      organizationId: parsed.organizationId,
      metadata: {
        scope: parsed.scope,
        cityId: parsed.cityId,
        createdByScope,
        creatorOrganizationIds: creatorOrganizationIds.join(","),
        providerOrganizationIds: providerOrganizationIds.join(","),
        provisionedByPlatform: createdByScope === "platform",
        sourceLanguage: parsed.sourceLanguage,
        scheduleType: parsed.scheduleType,
        publicationMode: parsed.publicationMode,
        scheduledFor: scheduledFor?.toISOString() ?? null,
      },
    });
    if (parsed.publicationMode !== "draft") {
      await recordAudit({
        action: scheduledFor
          ? "activity.language_scheduled"
          : "activity.language_published",
        subjectType: "activity",
        subjectId: activity.id,
        organizationId: parsed.organizationId,
        metadata: {
          languageCode: parsed.sourceLanguage,
          scheduledFor: scheduledFor?.toISOString() ?? null,
        },
      });
    }
    refresh(locale);
    redirect(
      `${localizedPath("/dashboard/activities", locale)}?activity=${activity.id}`,
    );
  },
);

const activityPublicationSchema = z.object({
  activityId: z.string().uuid(),
  languageCode: editorialLanguageSchema,
  publishAt: optional,
});

export const publishActivityLanguage = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const parsed = activityPublicationSchema.parse({
      activityId: formData.get("activityId"),
      languageCode: formData.get("languageCode"),
      publishAt: formData.get("publishAt") ?? "",
    });
    const scheduledFor = parsed.publishAt
      ? parseScheduledPublication("scheduled", parsed.publishAt)
      : null;
    const session = await auth();
    const publisherId = session?.user.id;
    if (!publisherId) throw new Error("A signed-in publisher is required");

    await db.transaction(async (tx) => {
      const [enabledLanguage] = await tx
        .select({ code: languageCatalog.code })
        .from(languageCatalog)
        .where(
          and(
            eq(languageCatalog.code, parsed.languageCode),
            eq(languageCatalog.enabled, true),
          ),
        )
        .limit(1);
      if (!enabledLanguage) {
        throw new Error("This language is not enabled for publication");
      }

      const [translation] = await tx
        .select()
        .from(activityTranslations)
        .where(
          and(
            eq(activityTranslations.activityId, parsed.activityId),
            eq(activityTranslations.languageCode, parsed.languageCode),
          ),
        )
        .limit(1);
      if (!translation?.name) {
        throw new Error("This language has no authored title to publish");
      }
      if (!translation.sourceVersionId || !translation.contentHash) {
        throw new Error("This translation is not tied to a source version");
      }

      const verifiedProviders = await tx
        .select({ id: organizations.id })
        .from(activityProviders)
        .innerJoin(
          organizations,
          eq(organizations.id, activityProviders.organizationId),
        )
        .where(
          and(
            eq(activityProviders.activityId, parsed.activityId),
            eq(activityProviders.state, "confirmed"),
            eq(activityProviders.active, true),
            eq(organizations.status, "verified"),
            eq(organizations.publishingSuspended, false),
          ),
        )
        .limit(1);
      if (verifiedProviders.length === 0) {
        throw new Error(
          "Publication requires at least one confirmed, verified provider",
        );
      }

      const attachedAssets = await tx
        .select({
          id: assets.id,
          scanState: assets.scanState,
          rightsConfirmed: assets.rightsConfirmed,
        })
        .from(activityAssets)
        .innerJoin(assets, eq(assets.id, activityAssets.assetId))
        .where(
          and(
            eq(activityAssets.activityId, parsed.activityId),
            eq(activityAssets.active, true),
          ),
        );
      if (
        attachedAssets.some(
          (asset) => !asset.rightsConfirmed || asset.scanState !== "clean",
        )
      ) {
        throw new Error(
          "Every attached asset must pass safety and rights checks before publication",
        );
      }

      await tx
        .update(activityPublications)
        .set({ unpublishedAt: new Date(), unpublishedById: publisherId })
        .where(
          and(
            eq(activityPublications.activityId, parsed.activityId),
            eq(activityPublications.languageCode, parsed.languageCode),
            isNull(activityPublications.unpublishedAt),
          ),
        );
      await tx.insert(activityPublications).values({
        activityId: parsed.activityId,
        languageCode: parsed.languageCode,
        sourceVersionId: translation.sourceVersionId,
        translationContentHash: translation.contentHash,
        publishedById: publisherId,
        scheduledFor,
      });
      await tx
        .update(activityTranslations)
        .set({
          state: "verified",
          verifiedById: publisherId,
          verifiedAt: new Date(),
        })
        .where(
          and(
            eq(activityTranslations.activityId, parsed.activityId),
            eq(activityTranslations.languageCode, parsed.languageCode),
          ),
        );
      if (!scheduledFor) {
        await tx
          .update(activities)
          .set({ published: true, updatedAt: new Date() })
          .where(eq(activities.id, parsed.activityId));
        if (attachedAssets.length > 0) {
          await tx
            .update(assets)
            .set({ visibility: "public", updatedAt: new Date() })
            .where(
              inArray(
                assets.id,
                attachedAssets.map((asset) => asset.id),
              ),
            );
        }
      }
    });

    await recordAudit({
      action: scheduledFor
        ? "activity.language_scheduled"
        : "activity.language_published",
      subjectType: "activity",
      subjectId: parsed.activityId,
      metadata: {
        languageCode: parsed.languageCode,
        scheduledFor: scheduledFor?.toISOString() ?? null,
      },
    });
    refresh(locale);
  },
);

export const unpublishActivityLanguage = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const parsed = activityPublicationSchema.parse({
      activityId: formData.get("activityId"),
      languageCode: formData.get("languageCode"),
      publishAt: "",
    });
    const session = await auth();
    const publisherId = session?.user.id;
    if (!publisherId) throw new Error("A signed-in publisher is required");

    await db.transaction(async (tx) => {
      await tx
        .update(activityPublications)
        .set({ unpublishedAt: new Date(), unpublishedById: publisherId })
        .where(
          and(
            eq(activityPublications.activityId, parsed.activityId),
            eq(activityPublications.languageCode, parsed.languageCode),
            isNull(activityPublications.unpublishedAt),
          ),
        );
      const [stillLive] = await tx
        .select({ id: activityPublications.id })
        .from(activityPublications)
        .where(
          and(
            eq(activityPublications.activityId, parsed.activityId),
            isNull(activityPublications.unpublishedAt),
            or(
              isNull(activityPublications.scheduledFor),
              lte(activityPublications.scheduledFor, new Date()),
            ),
          ),
        )
        .limit(1);
      if (!stillLive) {
        await tx
          .update(activities)
          .set({ published: false, updatedAt: new Date() })
          .where(eq(activities.id, parsed.activityId));
      }
    });

    await recordAudit({
      action: "activity.language_unpublished",
      subjectType: "activity",
      subjectId: parsed.activityId,
      metadata: { languageCode: parsed.languageCode },
    });
    refresh(locale);
  },
);

const updateActivityContentSchema = z.object({
  activityId: z.string().uuid(),
  sourceLanguage: editorialLanguageSchema,
  categoryId: z.string().uuid(),
  audienceCategoryId: z.string().uuid(),
});

/**
 * Edit an existing activity's per-language name and description. Mirrors the
 * article content save: a changed source payload seals a new immutable
 * translation source version (so publication pinning stays coherent) and the
 * working translation rows are upserted. Locale publication is a separate,
 * out-of-scope action, so this never flips the `published` flag.
 */
export const updateActivityContent = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const parsed = updateActivityContentSchema.parse({
      activityId: formData.get("activityId"),
      sourceLanguage: formData.get("sourceLanguage"),
      categoryId: formData.get("categoryId"),
      audienceCategoryId: formData.get("audienceCategoryId"),
    });
    const tagIds = [
      ...new Set(z.array(z.string().uuid()).parse(formData.getAll("tagId"))),
    ].slice(0, 3);
    // Provenance is decided on the server (see ~/server/translation/provenance):
    // the form carries the text and, for freshly generated languages, a signed
    // proposal token — never the `method` or `state` that gets stored.
    const submitted = editorialLanguageCodes
      .map((languageCode) => {
        const name = stringField(formData, `name_${languageCode}`);
        const description = sanitizeRichText(
          stringField(formData, `description_${languageCode}_html`),
        );
        return {
          languageCode,
          name,
          descriptionHtml: description.html,
          descriptionText: description.text,
          shortDescription: description.text?.slice(0, 500) ?? null,
          signature: optionalStringField(
            formData,
            `translation_proposal_${languageCode}`,
          ),
        };
      })
      .filter((translation) => translation.name.length > 0);
    const source = submitted.find(
      (translation) => translation.languageCode === parsed.sourceLanguage,
    );
    if (!source || source.name.length < 2) {
      throw new Error("The source language needs a title");
    }
    const keptCodes = submitted.map((translation) => translation.languageCode);

    const session = await auth();
    const actorId = session?.user.id;
    if (!actorId) throw new Error("Authentication required");

    await db.transaction(async (tx) => {
      const [activity] = await tx
        .select({
          id: activities.id,
          organizationId: activities.organizationId,
        })
        .from(activities)
        .where(eq(activities.id, parsed.activityId))
        .limit(1);
      if (!activity) throw new Error("Unknown activity");

      const [latest] = await tx
        .select({
          id: translationSourceVersions.id,
          version: translationSourceVersions.version,
          hash: translationSourceVersions.sourceContentHash,
        })
        .from(translationSourceVersions)
        .where(
          and(
            eq(translationSourceVersions.entityKind, "activity"),
            eq(translationSourceVersions.entityId, activity.id),
          ),
        )
        .orderBy(desc(translationSourceVersions.version))
        .limit(1);

      /**
       * A source version seals the *authored* language only. Sealing the whole
       * multilingual payload would stamp a new version — and so declare every
       * translation stale — every time a translator touched a single target
       * language, which is why `impact` was never usable before.
       */
      const sourcePayload = {
        sourceLanguage: parsed.sourceLanguage,
        title: source.name,
        summary: source.shortDescription,
        bodyHtml: source.descriptionHtml,
        plainText: source.descriptionText,
      };
      const sourceHash = hashContent(sourcePayload);
      const sourceChanged = latest?.hash !== sourceHash;

      let sourceVersionId = latest?.id ?? null;
      if (sourceChanged) {
        const [created] = await tx
          .insert(translationSourceVersions)
          .values({
            organizationId: activity.organizationId,
            entityKind: "activity",
            entityId: activity.id,
            version: latest ? latest.version + 1 : 1,
            previousVersionId: latest?.id ?? null,
            sourceLanguageCode: parsed.sourceLanguage,
            sourceContentJson: sourcePayload,
            sourceContentHash: sourceHash,
            impact: latest ? "review_required" : "initial",
            createdById: actorId,
          })
          .returning({ id: translationSourceVersions.id });
        if (!created) throw new Error("Source version insert returned no row");
        sourceVersionId = created.id;
      }

      const existingRows = await tx
        .select({
          languageCode: activityTranslations.languageCode,
          name: activityTranslations.name,
          descriptionHtml: activityTranslations.descriptionHtml,
          state: activityTranslations.state,
          method: activityTranslations.method,
          providerCode: activityTranslations.providerCode,
        })
        .from(activityTranslations)
        .where(eq(activityTranslations.activityId, activity.id));
      const existingByLanguage = new Map(
        existingRows.map((row) => [row.languageCode, row]),
      );

      // Drop languages whose title was cleared (the source language always
      // survives the earlier guard), then upsert the remaining rows.
      await tx
        .delete(activityTranslations)
        .where(
          and(
            eq(activityTranslations.activityId, activity.id),
            notInArray(activityTranslations.languageCode, keptCodes),
          ),
        );
      for (const translation of submitted) {
        // Canonical shape shared with ~/server/translation so a signed
        // proposal hashes identically here and at generation time.
        const payload = {
          title: translation.name,
          bodyHtml: translation.descriptionHtml,
        };
        const existing = existingByLanguage.get(translation.languageCode);
        const provenance = classifyTranslation({
          entityKind: "activity",
          targetLanguageCode: translation.languageCode,
          payload,
          signature: translation.signature,
          existing: existing
            ? {
                method: existing.method,
                state: existing.state,
                providerCode: existing.providerCode,
                payload: {
                  title: existing.name,
                  bodyHtml: existing.descriptionHtml ?? "",
                },
              }
            : null,
          isSource: translation.languageCode === parsed.sourceLanguage,
        });
        const row = {
          name: translation.name,
          descriptionHtml: translation.descriptionHtml,
          descriptionText: translation.descriptionText,
          shortDescription: translation.shortDescription,
          state: provenance.state,
          method: provenance.method,
          providerCode: provenance.providerCode,
          sourceVersionId,
          contentHash: translationPayloadHash({
            languageCode: translation.languageCode,
            ...payload,
          }),
          ...(provenance.state === "verified" &&
          translation.languageCode === parsed.sourceLanguage
            ? { verifiedById: actorId, verifiedAt: new Date() }
            : {}),
        };
        await tx
          .insert(activityTranslations)
          .values({
            activityId: activity.id,
            languageCode: translation.languageCode,
            ...row,
          })
          .onConflictDoUpdate({
            target: [
              activityTranslations.activityId,
              activityTranslations.languageCode,
            ],
            set: row,
          });
      }

      /**
       * The source moved, so every target language now describes text that no
       * longer exists. Anything that claimed to be checked drops back into the
       * review queue, keeping a pointer to the version it was checked against
       * so the rail can show what it is behind.
       */
      if (sourceChanged && latest && sourceVersionId) {
        await tx
          .update(activityTranslations)
          .set({
            state: "needs_review",
            verifiedById: null,
            verifiedAt: null,
            carriedForwardFromSourceVersionId: latest.id,
          })
          .where(
            and(
              eq(activityTranslations.activityId, activity.id),
              notInArray(activityTranslations.languageCode, [
                parsed.sourceLanguage,
              ]),
              inArray(activityTranslations.state, [
                "verified",
                "machine_generated",
              ]),
            ),
          );
      }

      // Replace the public tag set, keeping only globals or this org's tags.
      const validTagIds =
        tagIds.length > 0
          ? (
              await tx
                .select({ id: tags.id })
                .from(tags)
                .where(
                  and(
                    inArray(tags.id, tagIds),
                    eq(tags.active, true),
                    eq(tags.visibility, "public"),
                    activity.organizationId
                      ? or(
                          isNull(tags.organizationId),
                          eq(tags.organizationId, activity.organizationId),
                        )
                      : isNull(tags.organizationId),
                  ),
                )
            ).map((tag) => tag.id)
          : [];
      const orderedTagIds = tagIds.filter((id) => validTagIds.includes(id));
      await tx
        .delete(activityTags)
        .where(eq(activityTags.activityId, activity.id));
      if (orderedTagIds.length > 0) {
        await tx.insert(activityTags).values(
          orderedTagIds.map((tagId, displayOrder) => ({
            activityId: activity.id,
            tagId,
            displayOrder,
          })),
        );
      }

      await tx
        .update(activities)
        .set({
          categoryId: parsed.categoryId,
          audienceCategoryId: parsed.audienceCategoryId,
          updatedAt: new Date(),
        })
        .where(eq(activities.id, activity.id));
    });

    await recordAudit({
      action: "activity.content_saved",
      subjectType: "activity",
      subjectId: parsed.activityId,
    });
    refresh(locale);
  },
);

const createServiceSchema = z.object({
  organizationId: z
    .union([z.literal(""), z.string().uuid()])
    .transform((value) => value || null),
  categoryId: z.string().uuid(),
  icon: z.string().trim().min(1).max(50).default("help"),
  nameFr: z.string().trim().min(2),
  nameEn: optional,
  nameAr: optional,
  descriptionFr: optional,
  descriptionEn: optional,
  descriptionAr: optional,
  sourceNote: optional,
});

function reusableServiceCode(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
  return normalized || `service-${hashContent(name).slice(0, 10)}`;
}

/** Create a reusable capability and attach it to one activity immediately. */
export const createAndAssignService = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const activityId = z.string().uuid().parse(formData.get("activityId"));
    const parsed = createServiceSchema.parse({
      organizationId: formData.get("organizationId"),
      categoryId: formData.get("categoryId"),
      icon: formData.get("icon") ?? "help",
      nameFr: formData.get("nameFr"),
      nameEn: formData.get("nameEn") ?? "",
      nameAr: formData.get("nameAr") ?? "",
      descriptionFr: formData.get("descriptionFr") ?? "",
      descriptionEn: formData.get("descriptionEn") ?? "",
      descriptionAr: formData.get("descriptionAr") ?? "",
      sourceNote: formData.get("sourceNote") ?? "",
    });

    const [activity] = await db
      .select({ organizationId: activities.organizationId })
      .from(activities)
      .where(eq(activities.id, activityId));
    if (
      parsed.organizationId &&
      activity?.organizationId !== parsed.organizationId
    ) {
      throw new Error(
        "The service and activity must belong to one organisation",
      );
    }
    if (!parsed.organizationId) {
      const actor = await auth();
      if (
        !actor?.user.id ||
        !(await hasActualPlatformPermission(
          actor.user.id,
          "support.superadmin",
        ))
      ) {
        throw new Error("Only a superadmin can create global services");
      }
    }

    const service = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(services)
        .values({
          organizationId: parsed.organizationId,
          code: reusableServiceCode(parsed.nameFr),
          categoryId: parsed.categoryId,
          icon: parsed.icon,
          sourceNote: parsed.sourceNote,
        })
        .returning({ id: services.id });
      if (!created) throw new Error("Service insert returned no row");

      const names = [
        {
          languageCode: "fr",
          name: parsed.nameFr,
          description: parsed.descriptionFr,
        },
      ];
      if (parsed.nameEn) {
        names.push({
          languageCode: "en",
          name: parsed.nameEn,
          description: parsed.descriptionEn,
        });
      }
      if (parsed.nameAr) {
        names.push({
          languageCode: "ar",
          name: parsed.nameAr,
          description: parsed.descriptionAr,
        });
      }
      await tx.insert(serviceTranslations).values(
        names.map((translation) => ({
          serviceId: created.id,
          scopeKey: catalogueScopeKey(parsed.organizationId),
          ...translation,
        })),
      );
      await tx.insert(activityServices).values({
        activityId,
        serviceId: created.id,
      });
      return created;
    });

    await recordAudit({
      action: "service.created_and_assigned",
      subjectType: "service",
      subjectId: service.id,
      organizationId: parsed.organizationId,
      metadata: { activityId },
    });
    refresh(locale);
    redirect(
      `${localizedPath("/dashboard/activities", locale)}?activity=${activityId}`,
    );
  },
);

const updateServiceSchema = createServiceSchema.extend({
  serviceId: z.string().uuid(),
});

/** Update an organisation-owned reusable service and its authored languages. */
export const updateReusableService = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const parsed = updateServiceSchema.parse({
      serviceId: formData.get("serviceId"),
      organizationId: formData.get("organizationId"),
      categoryId: formData.get("categoryId"),
      icon: formData.get("icon") ?? "help",
      nameFr: formData.get("nameFr"),
      nameEn: formData.get("nameEn") ?? "",
      nameAr: formData.get("nameAr") ?? "",
      descriptionFr: formData.get("descriptionFr") ?? "",
      descriptionEn: formData.get("descriptionEn") ?? "",
      descriptionAr: formData.get("descriptionAr") ?? "",
      sourceNote: formData.get("sourceNote") ?? "",
    });
    const [owned] = await db
      .select({ id: services.id, organizationId: services.organizationId })
      .from(services)
      .where(eq(services.id, parsed.serviceId));
    if (!owned)
      throw new Error("Only organisation-owned services can be edited");
    if (owned.organizationId !== parsed.organizationId) {
      throw new Error("The service scope cannot be changed");
    }
    if (!owned.organizationId) {
      const actor = await auth();
      if (
        !actor?.user.id ||
        !(await hasActualPlatformPermission(
          actor.user.id,
          "support.superadmin",
        ))
      ) {
        throw new Error("Only a superadmin can edit global services");
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(services)
        .set({
          categoryId: parsed.categoryId,
          icon: parsed.icon,
          sourceNote: parsed.sourceNote,
          updatedAt: new Date(),
        })
        .where(eq(services.id, parsed.serviceId));

      const translations = [
        {
          languageCode: "fr",
          name: parsed.nameFr,
          description: parsed.descriptionFr,
        },
        {
          languageCode: "en",
          name: parsed.nameEn,
          description: parsed.descriptionEn,
        },
        {
          languageCode: "ar",
          name: parsed.nameAr,
          description: parsed.descriptionAr,
        },
      ].filter(
        (
          translation,
        ): translation is {
          languageCode: string;
          name: string;
          description: string | null;
        } => translation.name !== null,
      );
      for (const translation of translations) {
        await tx
          .insert(serviceTranslations)
          .values({
            serviceId: parsed.serviceId,
            scopeKey: catalogueScopeKey(parsed.organizationId),
            ...translation,
          })
          .onConflictDoUpdate({
            target: [
              serviceTranslations.serviceId,
              serviceTranslations.languageCode,
            ],
            set: {
              scopeKey: catalogueScopeKey(parsed.organizationId),
              name: translation.name,
              description: translation.description,
            },
          });
      }
      const removedAuthoredLanguages = ["fr", "en", "ar"].filter(
        (languageCode) =>
          !translations.some(
            (translation) => translation.languageCode === languageCode,
          ),
      );
      if (removedAuthoredLanguages.length > 0) {
        await tx
          .delete(serviceTranslations)
          .where(
            and(
              eq(serviceTranslations.serviceId, parsed.serviceId),
              inArray(
                serviceTranslations.languageCode,
                removedAuthoredLanguages,
              ),
            ),
          );
      }
    });

    await recordAudit({
      action: "service.updated",
      subjectType: "service",
      subjectId: parsed.serviceId,
      organizationId: parsed.organizationId,
    });
    refresh(locale);
  },
);

const serviceLifecycleSchema = z.object({
  serviceId: z.string().uuid(),
  organizationId: z
    .union([z.literal(""), z.string().uuid()])
    .transform((value) => value || null),
});

async function assertGlobalServiceAccess(organizationId: string | null) {
  if (organizationId) return;
  const actor = await auth();
  if (
    !actor?.user.id ||
    !(await hasActualPlatformPermission(actor.user.id, "support.superadmin"))
  ) {
    throw new Error("Only a superadmin can manage global services");
  }
}

export const archiveReusableService = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const parsed = serviceLifecycleSchema.parse({
      serviceId: formData.get("serviceId"),
      organizationId: formData.get("organizationId"),
    });
    await assertGlobalServiceAccess(parsed.organizationId);
    const [archived] = await db
      .update(services)
      .set({ active: false, archivedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(services.id, parsed.serviceId),
          parsed.organizationId
            ? eq(services.organizationId, parsed.organizationId)
            : isNull(services.organizationId),
        ),
      )
      .returning({ id: services.id });
    if (!archived)
      throw new Error("Only organisation-owned services can be archived");
    await db
      .update(activityServices)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(activityServices.serviceId, parsed.serviceId));
    await recordAudit({
      action: "service.archived",
      subjectType: "service",
      subjectId: parsed.serviceId,
      organizationId: parsed.organizationId,
    });
    refresh(locale);
  },
);

export const restoreReusableService = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const parsed = serviceLifecycleSchema.parse({
      serviceId: formData.get("serviceId"),
      organizationId: formData.get("organizationId"),
    });
    await assertGlobalServiceAccess(parsed.organizationId);
    const [restored] = await db
      .update(services)
      .set({ active: true, archivedAt: null, updatedAt: new Date() })
      .where(
        and(
          eq(services.id, parsed.serviceId),
          parsed.organizationId
            ? eq(services.organizationId, parsed.organizationId)
            : isNull(services.organizationId),
        ),
      )
      .returning({ id: services.id });
    if (!restored)
      throw new Error("Only organisation-owned services can be restored");
    await recordAudit({
      action: "service.restored",
      subjectType: "service",
      subjectId: parsed.serviceId,
      organizationId: parsed.organizationId,
    });
    refresh(locale);
  },
);

export const replaceActivityServices = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const activityId = z.string().uuid().parse(formData.get("activityId"));
    const serviceIds = z
      .array(z.string().uuid())
      .parse(formData.getAll("serviceId"));
    const uniqueServiceIds = [...new Set(serviceIds)];
    const [activity] = await db
      .select({ organizationId: activities.organizationId })
      .from(activities)
      .where(eq(activities.id, activityId));
    if (!activity) throw new Error("Unknown activity");

    if (uniqueServiceIds.length > 0) {
      const allowed = await db
        .select({ id: services.id })
        .from(services)
        .where(
          and(
            inArray(services.id, uniqueServiceIds),
            eq(services.active, true),
            isNull(services.archivedAt),
            activity.organizationId
              ? or(
                  isNull(services.organizationId),
                  eq(services.organizationId, activity.organizationId),
                )
              : isNull(services.organizationId),
          ),
        );
      if (allowed.length !== uniqueServiceIds.length) {
        throw new Error(
          "One or more services are unavailable in this organisation",
        );
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(activityServices)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(activityServices.activityId, activityId));
      for (const [displayOrder, serviceId] of uniqueServiceIds.entries()) {
        await tx
          .insert(activityServices)
          .values({ activityId, serviceId, displayOrder })
          .onConflictDoUpdate({
            target: [activityServices.activityId, activityServices.serviceId],
            set: { active: true, displayOrder, updatedAt: new Date() },
          });
      }
    });
    await recordAudit({
      action: "activity.services_replaced",
      subjectType: "activity",
      subjectId: activityId,
      organizationId: activity.organizationId,
      metadata: { serviceIds: uniqueServiceIds.join(",") },
    });
    refresh(locale);
  },
);

const assignmentSchema = z.object({
  activityId: z.string().uuid(),
  serviceId: z.string().uuid(),
});

export const assignServiceToActivity = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const parsed = assignmentSchema.parse({
      activityId: formData.get("activityId"),
      serviceId: formData.get("serviceId"),
    });
    const [scope] = await db
      .select({
        activityOrganizationId: activities.organizationId,
        serviceOrganizationId: services.organizationId,
        serviceActive: services.active,
        serviceArchivedAt: services.archivedAt,
      })
      .from(activities)
      .innerJoin(
        services,
        and(
          eq(services.id, parsed.serviceId),
          or(
            isNull(services.organizationId),
            eq(services.organizationId, activities.organizationId),
          ),
        ),
      )
      .where(eq(activities.id, parsed.activityId));
    if (!scope || !scope.serviceActive || scope.serviceArchivedAt) {
      throw new Error("This service is unavailable for the selected activity");
    }
    await db
      .insert(activityServices)
      .values(parsed)
      .onConflictDoUpdate({
        target: [activityServices.activityId, activityServices.serviceId],
        set: { active: true },
      });
    refresh(locale);
  },
);

const addScheduleSchema = z.object({
  activityId: z.string().uuid(),
  scheduleType: z.enum(["recurring", "one_off"]),
  weekday: z.coerce.number().int().min(1).max(7).optional(),
  occurrenceDate: z.string().date().optional(),
  timingMode: z.enum(["fixed", "flexible"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

type ScheduleValues = z.infer<typeof addScheduleSchema>;

export type AddActivityScheduleResult =
  | { result: "idle" }
  | { result: "success"; values: ScheduleValues }
  | {
      result: "error";
      error: "invalid" | "invalidRange" | "overlap";
      values?: ScheduleValues;
    };

export const addActivitySchedule =
  protectedPermissionAction<AddActivityScheduleResult>(
    "content.activity.manage",
    async (formData, locale) => {
      const weekdayValue = stringField(formData, "weekday");
      const occurrenceDateValue = stringField(formData, "occurrenceDate");
      const result = addScheduleSchema.safeParse({
        activityId: formData.get("activityId"),
        scheduleType: formData.get("scheduleType"),
        weekday: weekdayValue === "" ? undefined : weekdayValue,
        occurrenceDate:
          occurrenceDateValue === "" ? undefined : occurrenceDateValue,
        timingMode: formData.get("timingMode"),
        startTime: formData.get("startTime"),
        endTime: formData.get("endTime"),
      });
      if (!result.success) return { result: "error", error: "invalid" };

      const parsed = result.data;
      if (
        (parsed.scheduleType === "recurring" && !parsed.weekday) ||
        (parsed.scheduleType === "one_off" && !parsed.occurrenceDate)
      ) {
        return { result: "error", error: "invalid", values: parsed };
      }
      if (parsed.startTime >= parsed.endTime) {
        return {
          result: "error",
          error: "invalidRange",
          values: parsed,
        };
      }

      const occurrenceWeekday = parsed.occurrenceDate
        ? new Date(`${parsed.occurrenceDate}T12:00:00Z`).getUTCDay() || 7
        : null;
      const candidate = {
        activityId: parsed.activityId,
        weekday: occurrenceWeekday ?? parsed.weekday ?? 1,
        timingMode: parsed.timingMode,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        validFrom:
          parsed.scheduleType === "one_off" ? parsed.occurrenceDate : null,
        validTo:
          parsed.scheduleType === "one_off" ? parsed.occurrenceDate : null,
      };

      const inserted = await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${parsed.activityId}, 0))`,
        );
        const existingRules = await tx
          .select({
            weekday: scheduleRules.weekday,
            startTime: scheduleRules.startTime,
            endTime: scheduleRules.endTime,
            endsNextDay: scheduleRules.endsNextDay,
            validFrom: scheduleRules.validFrom,
            validTo: scheduleRules.validTo,
          })
          .from(scheduleRules)
          .where(eq(scheduleRules.activityId, parsed.activityId));

        const overlaps = existingRules.some((rule) => {
          const dateRangesOverlap =
            (!candidate.validTo ||
              !rule.validFrom ||
              candidate.validTo >= rule.validFrom) &&
            (!rule.validTo ||
              !candidate.validFrom ||
              rule.validTo >= candidate.validFrom);
          return (
            dateRangesOverlap &&
            scheduleRulesOverlap({ ...candidate, endsNextDay: false }, rule)
          );
        });
        if (overlaps) {
          return false;
        }

        await tx.insert(scheduleRules).values(candidate);
        return true;
      });

      if (!inserted) {
        return { result: "error", error: "overlap", values: parsed };
      }

      refresh(locale);
      return { result: "success", values: parsed };
    },
  );

const deleteScheduleSchema = z.object({
  activityId: z.string().uuid(),
  scheduleRuleId: z.string().uuid(),
});

export const deleteActivitySchedule = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const parsed = deleteScheduleSchema.parse({
      activityId: formData.get("activityId"),
      scheduleRuleId: formData.get("scheduleRuleId"),
    });
    const [activity] = await db
      .select({ organizationId: activities.organizationId })
      .from(activities)
      .where(eq(activities.id, parsed.activityId));
    if (!activity) throw new Error("Unknown activity");

    const deleted = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${parsed.activityId}, 0))`,
      );
      const [rule] = await tx
        .delete(scheduleRules)
        .where(
          and(
            eq(scheduleRules.id, parsed.scheduleRuleId),
            eq(scheduleRules.activityId, parsed.activityId),
          ),
        )
        .returning({
          id: scheduleRules.id,
          weekday: scheduleRules.weekday,
          startTime: scheduleRules.startTime,
          endTime: scheduleRules.endTime,
        });
      return rule;
    });

    if (deleted) {
      await recordAudit({
        action: "activity.schedule_rule_deleted",
        subjectType: "activity",
        subjectId: parsed.activityId,
        organizationId: activity.organizationId,
        metadata: {
          scheduleRuleId: deleted.id,
          weekday: deleted.weekday,
          startTime: deleted.startTime,
          endTime: deleted.endTime,
        },
      });
    }
    refresh(locale);
  },
);

const exceptionalClosureSchema = z.object({
  activityId: z.string().uuid(),
  date: z.string().date(),
  reasonFr: optional,
});

/** Add a date-scoped closure without changing the recurring activity. */
export const addExceptionalClosure = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const parsed = exceptionalClosureSchema.parse({
      activityId: formData.get("activityId"),
      date: formData.get("date"),
      reasonFr: formData.get("reasonFr") ?? "",
    });
    const session = await auth();
    const [activity] = await db
      .select({ organizationId: activities.organizationId })
      .from(activities)
      .where(eq(activities.id, parsed.activityId));
    if (!activity) throw new Error("Unknown activity");

    const [exception] = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: scheduleExceptions.id })
        .from(scheduleExceptions)
        .where(
          and(
            eq(scheduleExceptions.activityId, parsed.activityId),
            eq(scheduleExceptions.date, parsed.date),
            eq(scheduleExceptions.kind, "closure"),
            isNull(scheduleExceptions.startTime),
            isNull(scheduleExceptions.endTime),
          ),
        )
        .limit(1);
      if (existing) {
        return tx
          .update(scheduleExceptions)
          .set({ createdById: session?.user.id ?? null })
          .where(eq(scheduleExceptions.id, existing.id))
          .returning({ id: scheduleExceptions.id });
      }
      return tx
        .insert(scheduleExceptions)
        .values({
          activityId: parsed.activityId,
          date: parsed.date,
          kind: "closure",
          createdById: session?.user.id ?? null,
        })
        .returning({ id: scheduleExceptions.id });
    });
    if (exception && parsed.reasonFr) {
      await db
        .insert(scheduleExceptionTranslations)
        .values({
          exceptionId: exception.id,
          languageCode: "fr",
          publicReason: parsed.reasonFr,
        })
        .onConflictDoUpdate({
          target: [
            scheduleExceptionTranslations.exceptionId,
            scheduleExceptionTranslations.languageCode,
          ],
          set: { publicReason: parsed.reasonFr },
        });
    }
    await recordAudit({
      action: "activity.exceptional_closure_added",
      subjectType: "activity",
      subjectId: parsed.activityId,
      organizationId: activity.organizationId,
      metadata: { date: parsed.date },
    });
    refresh(locale);
  },
);

const assignMemberSchema = z
  .object({
    activityId: z.string().uuid(),
    email: z.string().trim().toLowerCase().email(),
    displayName: optional,
    title: optional,
    skills: optional,
    languages: z.array(z.string().min(2).max(35)).max(30),
    expertise: z.string().trim().min(2).max(160),
    visibility: z.enum(["workspace", "public"]),
    publicDisplayName: optional,
    publicExpertise: optional,
  })
  .superRefine((value, context) => {
    if (
      value.visibility === "public" &&
      (!value.publicDisplayName || !value.publicExpertise)
    ) {
      context.addIssue({
        code: "custom",
        message: "Public assignments need an approved name and expertise",
      });
    }
  });

/**
 * Assign by email whether or not an account exists. The private membership is
 * ready for identity linking later; public attribution uses separate approved
 * fields and never exposes the member email or account record.
 */
export const assignMemberToActivity = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    if (!env.ENABLE_PHASE3_MEMBER_ASSIGNMENTS) {
      throw new Error("Phase 3 member assignments are not enabled");
    }
    const parsed = assignMemberSchema.parse({
      activityId: formData.get("activityId"),
      email: formData.get("email"),
      displayName: formData.get("displayName") ?? "",
      title: formData.get("title") ?? "",
      skills: formData.get("skills") ?? "",
      languages: formData.getAll("languages"),
      expertise: formData.get("expertise"),
      visibility: formData.get("visibility"),
      publicDisplayName: formData.get("publicDisplayName") ?? "",
      publicExpertise: formData.get("publicExpertise") ?? "",
    });
    const skills = parseSkills(parsed.skills);
    const languageCodes = await validLanguageCodes(parsed.languages);
    const [activity] = await db
      .select({
        organizationId: activities.organizationId,
        teamId: activities.teamId,
        organizationName: organizations.displayName,
        teamName: cityTeams.name,
      })
      .from(activities)
      .innerJoin(organizations, eq(activities.organizationId, organizations.id))
      .innerJoin(cityTeams, eq(activities.teamId, cityTeams.id))
      .where(eq(activities.id, parsed.activityId));
    if (!activity) throw new Error("Unknown activity");
    if (!activity.organizationId || !activity.teamId) {
      throw new Error(
        "The activity must be claimed before members can be assigned",
      );
    }
    const activityOrganizationId = activity.organizationId;
    const activityTeamId = activity.teamId;

    const [account] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(sql`lower(${users.email}) = ${parsed.email}`)
      .limit(1);

    const { member, created } = await db.transaction(async (tx) => {
      const identityMatch = account
        ? or(
            eq(organizationMembers.contactEmail, parsed.email),
            eq(organizationMembers.userId, account.id),
          )
        : eq(organizationMembers.contactEmail, parsed.email);
      let created = false;
      let [existing] = await tx
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, activityOrganizationId),
            identityMatch,
          ),
        )
        .limit(1);

      if (!existing) {
        created = true;
        [existing] = await tx
          .insert(organizationMembers)
          .values({
            organizationId: activityOrganizationId,
            userId: account?.id ?? null,
            displayName:
              parsed.displayName ??
              account?.name ??
              parsed.email.split("@")[0] ??
              parsed.email,
            contactEmail: parsed.email,
            status: account ? "active" : "invited",
          })
          .returning({ id: organizationMembers.id });
      } else if (account) {
        await tx
          .update(organizationMembers)
          .set({ userId: account.id, status: "active" })
          .where(eq(organizationMembers.id, existing.id));
      }
      if (!existing) throw new Error("Member insert returned no row");

      if (parsed.displayName && !created) {
        await tx
          .update(organizationMembers)
          .set({ displayName: parsed.displayName })
          .where(eq(organizationMembers.id, existing.id));
      }
      await replaceMemberProfileFacets(tx, existing.id, {
        title: parsed.title,
        skills,
        languageCodes,
      });

      await tx
        .insert(cityTeamMembers)
        .values({
          teamId: activityTeamId,
          organizationId: activityOrganizationId,
          memberId: existing.id,
        })
        .onConflictDoUpdate({
          target: [cityTeamMembers.teamId, cityTeamMembers.memberId],
          set: { active: true },
        });
      await tx
        .insert(activityMemberAssignments)
        .values({
          activityId: parsed.activityId,
          organizationId: activityOrganizationId,
          memberId: existing.id,
          expertise: parsed.expertise,
          visibility: parsed.visibility,
          publicDisplayName:
            parsed.visibility === "public" ? parsed.publicDisplayName : null,
          publicExpertise:
            parsed.visibility === "public" ? parsed.publicExpertise : null,
        })
        .onConflictDoUpdate({
          target: [
            activityMemberAssignments.activityId,
            activityMemberAssignments.memberId,
          ],
          set: {
            expertise: parsed.expertise,
            visibility: parsed.visibility,
            publicDisplayName:
              parsed.visibility === "public" ? parsed.publicDisplayName : null,
            publicExpertise:
              parsed.visibility === "public" ? parsed.publicExpertise : null,
            active: true,
          },
        });
      return { member: existing, created };
    });

    if (!account && created) {
      const session = await auth();
      await sendMemberInvitation({
        organizationId: activityOrganizationId,
        email: parsed.email,
        memberId: member.id,
        invitedById: session?.user.id ?? null,
        locale,
        organizationName: activity.organizationName,
        teamName: activity.teamName,
        inviterName:
          session?.user.name ?? session?.user.email ?? activity.teamName,
      });
    }

    await recordAudit({
      action: "activity.member_assigned",
      subjectType: "activity",
      subjectId: parsed.activityId,
      organizationId: activityOrganizationId,
      metadata: {
        memberId: member.id,
        visibility: parsed.visibility,
        accountLinked: Boolean(account),
        invited: !account && created,
      },
    });
    refresh(locale);
  },
);

const unassignMemberSchema = z.object({
  activityId: z.string().uuid(),
  memberId: z.string().uuid(),
});

/** Deactivate one assignment; membership and team history stay intact. */
export const unassignMemberFromActivity = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    if (!env.ENABLE_PHASE3_MEMBER_ASSIGNMENTS) {
      throw new Error("Phase 3 member assignments are not enabled");
    }
    const parsed = unassignMemberSchema.parse({
      activityId: formData.get("activityId"),
      memberId: formData.get("memberId"),
    });
    const [assignment] = await db
      .update(activityMemberAssignments)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(activityMemberAssignments.activityId, parsed.activityId),
          eq(activityMemberAssignments.memberId, parsed.memberId),
        ),
      )
      .returning({ organizationId: activityMemberAssignments.organizationId });
    if (!assignment) throw new Error("Unknown assignment");
    await recordAudit({
      action: "activity.member_unassigned",
      subjectType: "activity",
      subjectId: parsed.activityId,
      organizationId: assignment.organizationId,
      metadata: { memberId: parsed.memberId },
    });
    refresh(locale);
  },
);
