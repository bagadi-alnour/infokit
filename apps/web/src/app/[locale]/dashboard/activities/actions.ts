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
import {
  activityLocationModes,
  activityScopes,
  placePrecisions,
  scheduleExceptionKinds,
} from "~/lib/activity-rules";
import { editorialLanguageCodes } from "~/lib/editorial-languages";
import { EDITOR_CONTACT_OPTION_ID } from "~/lib/editor-contact";
import { PLATFORM_OWNER_OPTION_ID } from "~/lib/platform-owner";
import { recordAudit } from "~/server/audit";
import { scanUploadedAsset } from "~/server/assets/scan";
import {
  hasActualPlatformPermission,
  platformPermissionsForUser,
  superadminPermission,
} from "~/server/auth/authorization";
import {
  hasPermission,
  protectedPermissionAction,
  requirePermission,
} from "~/server/auth/require";
import { catalogueScopeKey } from "~/server/content/catalogue-scope";
import {
  clearedLanguageReview,
  platformCleared,
  platformVerifyPermission,
} from "~/server/content/language-review";
import { sanitizeRichText } from "~/server/content/sanitize-rich-text";
import { hashContent } from "~/server/content/editorial";
import {
  classifyTranslation,
  translationPayloadHash,
} from "~/server/translation/provenance";
import {
  parseScheduledPublication,
  publishesOnSave,
  requestedReviewStage,
} from "~/server/content/publication-schedule";
import { db } from "~/server/db";
import { sendMemberInvitation } from "~/server/invitations";
import {
  insertMember,
  replaceMemberCapabilities,
  validLanguageCodes,
} from "~/server/members";
import { scheduleRulesOverlap } from "~/lib/schedule-overlap";
import {
  scheduleRowSchema,
  scheduleRowsIssue,
  scheduleTimingModeSchema,
  scheduleTypeSchema,
  timeOfDayPattern,
  weekdayNumberSchema,
} from "~/lib/schedule-rules";
import { uniqueSlug } from "~/lib/slug";
import {
  optionalText,
  optionalUuid,
  personName,
  phoneNumber,
} from "~/lib/form-fields";
import { parseTransitLinks } from "~/lib/transit-links";
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
  activityTransitLinks,
  activityTranslations,
  activityVerifications,
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

const editorialLanguageSchema = z.enum(editorialLanguageCodes);
const publicationModeSchema = z.enum([
  "draft",
  "team",
  "platform",
  "now",
  "scheduled",
]);

function stringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const createActivitySchema = z.object({
  /**
   * The custodian, or the sentinel that stands for the platform itself. It
   * travels as a sentinel rather than as an empty value so a lost or tampered
   * field cannot quietly turn an association's activity into a platform one.
   */
  organizationId: z.union([
    z.string().uuid(),
    z.literal(PLATFORM_OWNER_OPTION_ID),
  ]),
  /**
   * `global` is the rare case — a helpline or an online service that belongs to
   * no city. It carries no city, no city team, and no place.
   */
  scope: z.enum(activityScopes).default("city"),
  cityId: z.string().uuid().nullable(),
  sourceLanguage: editorialLanguageSchema,
  locationMode: z.enum(activityLocationModes),
  placeId: optionalText,
  placeName: optionalText,
  addressLine: optionalText,
  postalCode: optionalText,
  lat: optionalText,
  lng: optionalText,
  /**
   * Only a new place carries one — an existing place already has its own — so
   * the form posts it with the address block or not at all.
   */
  precision: z.enum(placePrecisions).default("exact"),
  teamName: optionalText,
  categoryId: z.string().uuid(),
  audienceCategoryId: z.string().uuid(),
  sourceNote: optionalText,
  scheduleType: scheduleTypeSchema,
  occurrenceDate: optionalText,
  validFrom: optionalText,
  validTo: optionalText,
  exceptionDate: optionalText,
  exceptionKind: z.enum(scheduleExceptionKinds).optional(),
  exceptionStartTime: optionalText,
  exceptionEndTime: optionalText,
  exceptionReason: optionalText,
  coverAssetId: optionalText,
  publicationMode: publicationModeSchema.default("draft"),
  publishAt: optionalText,
});

function refresh(locale: Locale) {
  revalidatePath(localizedPath("/dashboard", locale));
  revalidatePath(localizedPath("/dashboard/activities", locale));
}

/** The organisation an audit row belongs to, for actions that only hold an id. */
async function activityOrganization(activityId: string) {
  const [activity] = await db
    .select({ organizationId: activities.organizationId })
    .from(activities)
    .where(eq(activities.id, activityId))
    .limit(1);
  return activity?.organizationId ?? null;
}

export const createActivity = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale, user) => {
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
      precision: formData.get("precision") ?? undefined,
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
    const publishes = publishesOnSave(parsed.publicationMode);
    const requestedStage = requestedReviewStage(parsed.publicationMode);
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
    // The same check the form ran before posting, so a stale or tampered post
    // fails on the rule the editor was shown rather than on a database error.
    const scheduleIssue = scheduleRowsIssue(parsed.scheduleType, scheduleRows);
    if (scheduleIssue === "invalidRange") {
      throw new Error("The end time must be after the start time");
    }
    if (scheduleIssue === "overlap") {
      throw new Error("Schedule windows cannot overlap");
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
    /**
     * The custodian, or null when the platform holds the activity itself. The
     * platform owns no `organizations` row, so a platform-held activity has no
     * city team, no organisation catalogue entries, and — the point of the whole
     * arrangement — no creator or provider claiming to speak for an association.
     */
    const ownerOrganizationId =
      parsed.organizationId === PLATFORM_OWNER_OPTION_ID
        ? null
        : parsed.organizationId;
    const ownedByPlatform = ownerOrganizationId === null;
    if (ownerOrganizationId) {
      if (!creatorOrganizationIds.includes(ownerOrganizationId)) {
        creatorOrganizationIds.unshift(ownerOrganizationId);
      }
      if (!providerOrganizationIds.includes(ownerOrganizationId)) {
        providerOrganizationIds.unshift(ownerOrganizationId);
      }
    }

    /**
     * What "reach me" publishes: the address the editor signs in with, which is
     * the only one the console knows. An account without one cannot stand in as
     * the contact for a whole activity.
     */
    const editorContactValue = user.email.trim();
    const editorContactLabel = user.name.trim();
    if (wantsEditorContact && !editorContactValue) {
      throw new Error("Your account has no address to publish as a contact");
    }
    if (wantsEditorContact && ownedByPlatform) {
      throw new Error(
        "A platform-held activity cannot publish your address as its contact",
      );
    }
    const platformPermissions = await platformPermissionsForUser(user.id);
    const editsForPlatform = platformPermissions.has("content.activity.manage");
    const actingOrganizationId = editsForPlatform ? null : ownerOrganizationId;
    const createdByScope = actingOrganizationId ? "organization" : "platform";
    /**
     * Holding an activity for the platform is a platform editor's decision. An
     * organisation's own editor is acting for that organisation, so for them the
     * custodian is that organisation and the sentinel is not theirs to send.
     */
    if (ownedByPlatform && !editsForPlatform) {
      throw new Error("Choose the organisation this activity belongs to");
    }
    /**
     * Which of the named organisations could publish today: `verified`, not
     * suspended. Both the relationship state and the publication gate below ask
     * the same question, so it is asked once.
     */
    const relationshipOrganizationIds = [
      ...new Set([...creatorOrganizationIds, ...providerOrganizationIds]),
    ];
    const publishableOrganizationIds = new Set(
      relationshipOrganizationIds.length === 0
        ? []
        : (
            await db
              .select({ id: organizations.id })
              .from(organizations)
              .where(
                and(
                  inArray(organizations.id, relationshipOrganizationIds),
                  eq(organizations.status, "verified"),
                  eq(organizations.publishingSuspended, false),
                ),
              )
          ).map((organization) => organization.id),
    );
    /**
     * A relationship is confirmed by the organisation it names, which is why a
     * platform editor normally only proposes one (PRODUCT.md §11.5).
     *
     * Temporary launch allowance: until associations sign in and confirm their
     * own, nothing a platform editor enters on their behalf could ever be
     * published, so a platform editor confirms for an organisation that is
     * already verified — and is recorded as the actor who did. Drop this once
     * organisation acceptance exists; the proposed state is the honest one.
     */
    const confirmedOrganizationIds = actingOrganizationId
      ? new Set([actingOrganizationId])
      : publishableOrganizationIds;
    const relationshipValues = (organizationId: string) => {
      const confirmed = confirmedOrganizationIds.has(organizationId);
      return {
        organizationId,
        state: confirmed ? ("confirmed" as const) : ("proposed" as const),
        proposedById: user.id,
        confirmedById: confirmed ? user.id : null,
        confirmedAt: confirmed ? new Date() : null,
      };
    };
    /**
     * Publication needs somebody answerable for the facts: a confirmed provider
     * that is verified and not suspended, or the platform itself when it holds
     * the activity and no association stands behind it yet.
     */
    if (publishes && !ownedByPlatform) {
      const publishableProvider = providerOrganizationIds.some(
        (organizationId) =>
          confirmedOrganizationIds.has(organizationId) &&
          publishableOrganizationIds.has(organizationId),
      );
      if (!publishableProvider) {
        throw new Error(
          "Publication requires at least one confirmed, verified provider",
        );
      }
    }
    if (publishes) {
      // Nothing on a form that has never been saved has been reviewed by
      // anyone, so going public straight from it belongs to whoever holds the
      // platform's own check (server/content/language-review.ts). Everyone else
      // saves a draft and sends it up the chain from the language panel.
      await requirePermission(platformVerifyPermission, locale);
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
            // A platform-held activity has no organisation catalogue to draw
            // on, so only the shared entries are available to it.
            ownerOrganizationId
              ? or(
                  isNull(services.organizationId),
                  eq(services.organizationId, ownerOrganizationId),
                )
              : isNull(services.organizationId),
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
            ownerOrganizationId
              ? or(
                  isNull(tags.organizationId),
                  eq(tags.organizationId, ownerOrganizationId),
                )
              : isNull(tags.organizationId),
          ),
        );
      if (allowedTags.length !== tagIds.length) {
        throw new Error("One or more tags are unavailable in this scope");
      }
    }
    if (contactIds.length > 0) {
      // Every contact belongs to an organisation, so a platform-held activity
      // has none of its own to publish.
      if (!ownerOrganizationId) {
        throw new Error("One or more contacts are unavailable");
      }
      const allowedContacts = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            inArray(contacts.id, contactIds),
            eq(contacts.organizationId, ownerOrganizationId),
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
          id: assets.id,
          storageKey: assets.storageKey,
          mimeType: assets.mimeType,
          byteSize: assets.byteSize,
          scanState: assets.scanState,
        })
        .from(assets)
        .where(
          and(
            eq(assets.id, parsed.coverAssetId),
            eq(assets.uploaderId, user.id),
            eq(assets.kind, "image"),
            eq(assets.rightsConfirmed, true),
            isNull(assets.archivedAt),
          ),
        )
        .limit(1);
      if (!uploadedCover) throw new Error("The activity image is unavailable");
      await scanUploadedAsset(uploadedCover);
    }

    // Null exactly when the scope is global; the check above guarantees it.
    const cityId = parsed.cityId;

    const activity = await db.transaction(async (tx) => {
      /**
       * Teams are an organisation-and-city pair, so a global activity has none —
       * and neither has one the platform holds, which the database enforces
       * (`activities_team_requires_organization_check`).
       */
      let teamId: string | null = null;
      if (cityId && ownerOrganizationId) {
        let [team] = await tx
          .select({ id: cityTeams.id })
          .from(cityTeams)
          .where(
            and(
              eq(cityTeams.organizationId, ownerOrganizationId),
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
              organizationId: ownerOrganizationId,
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
            organizationId: ownerOrganizationId,
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
          organizationId: ownerOrganizationId,
          cityId,
          teamId,
          placeId,
          categoryId: parsed.categoryId,
          audienceCategoryId: parsed.audienceCategoryId,
          sourceLanguageCode: parsed.sourceLanguage,
          sourceNote: parsed.sourceNote,
          createdById: user.id,
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
          organizationId: ownerOrganizationId,
          entityKind: "activity",
          entityId: created.id,
          version: 1,
          sourceLanguageCode: parsed.sourceLanguage,
          sourceContentJson: sourcePayload,
          sourceContentHash: hashContent(sourcePayload),
          impact: "initial",
          createdById: user.id,
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
              ? { verifiedById: user.id, verifiedAt: new Date() }
              : {}),
            // Publishing from the creation form required the platform's own
            // check above, so the chain records that rather than leaving a live
            // language looking as though nobody had seen it.
            ...(isSource && publishes
              ? { reviewStage: "platform_verified" as const }
              : {}),
            // Asking for a read covers every language the form carried text
            // for: a reviewer opening this record is meant to read it, not
            // just the language it was drafted in.
            ...(requestedStage
              ? {
                  reviewStage: requestedStage,
                  reviewRequestedById: user.id,
                  reviewRequestedAt: new Date(),
                }
              : {}),
          };
        }),
      );
      if (publishes) {
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
          publishedById: user.id,
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
      /**
       * Both lists are empty when the platform holds the activity and no
       * association has been named yet: the platform is the publisher, and
       * inserting it here would make it a factual creator or provider of
       * something it only wrote down (PRODUCT.md §11.5).
       */
      if (creatorOrganizationIds.length > 0) {
        await tx.insert(activityCreatorOrganizations).values(
          creatorOrganizationIds.map((organizationId) => ({
            activityId: created.id,
            ...relationshipValues(organizationId),
          })),
        );
      }
      if (providerOrganizationIds.length > 0) {
        await tx.insert(activityProviders).values(
          providerOrganizationIds.map((organizationId, displayOrder) => ({
            activityId: created.id,
            displayOrder,
            ...relationshipValues(organizationId),
          })),
        );
      }
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
        // Refused before the transaction: a contact row always belongs to an
        // organisation, so a platform-held activity cannot own one.
        if (!ownerOrganizationId) {
          throw new Error(
            "A platform-held activity cannot publish your address as its contact",
          );
        }
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
              eq(contacts.organizationId, ownerOrganizationId),
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
              organizationId: ownerOrganizationId,
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
              eq(assets.uploaderId, user.id),
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
            createdById: user.id,
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
      organizationId: ownerOrganizationId,
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
    if (requestedStage) {
      await recordAudit({
        action: "translation.review_requested",
        subjectType: "activity",
        subjectId: activity.id,
        organizationId: ownerOrganizationId,
        metadata: {
          stage: requestedStage,
          languages: translations
            .map((translation) => translation.languageCode)
            .join(","),
        },
      });
    }
    if (publishes) {
      await recordAudit({
        action: scheduledFor
          ? "activity.language_scheduled"
          : "activity.language_published",
        subjectType: "activity",
        subjectId: activity.id,
        organizationId: ownerOrganizationId,
        metadata: {
          languageCode: parsed.sourceLanguage,
          scheduledFor: scheduledFor?.toISOString() ?? null,
        },
      });
    }
    refresh(locale);
    redirect(
      `${localizedPath("/dashboard/activities", locale)}?activity=${activity.id}&notice=activity-created`,
    );
  },
);

const activityPublicationSchema = z.object({
  activityId: z.string().uuid(),
  languageCode: editorialLanguageSchema,
  publishAt: optionalText,
});

export const publishActivityLanguage = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale, user) => {
    const parsed = activityPublicationSchema.parse({
      activityId: formData.get("activityId"),
      languageCode: formData.get("languageCode"),
      publishAt: formData.get("publishAt") ?? "",
    });
    const scheduledFor = parsed.publishAt
      ? parseScheduledPublication("scheduled", parsed.publishAt)
      : null;
    /**
     * The platform's own check is the last gate before a visitor reads this
     * (server/content/language-review.ts). Whoever holds that grant *is* the
     * check, so they are not asked to send the text to themselves first.
     */
    const asPlatformVerifier = await hasPermission(platformVerifyPermission);

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
      if (
        !platformCleared({
          stage: translation.reviewStage,
          bypass: asPlatformVerifier,
        })
      ) {
        throw new Error(
          "The platform must verify this language before it is published",
        );
      }

      /**
       * Publication needs somebody answerable for the facts: a confirmed
       * provider that is verified and not suspended, or the platform itself
       * when it holds the activity and no association stands behind it
       * (docs/PRODUCT.md §11.5). A platform-held activity has no custodian and
       * no provider rows by design, so there is nothing here to require of it.
       */
      const [owner] = await tx
        .select({ organizationId: activities.organizationId })
        .from(activities)
        .where(eq(activities.id, parsed.activityId))
        .limit(1);
      if (!owner) {
        throw new Error("This activity no longer exists");
      }
      if (owner.organizationId) {
        const publishableProviders = await tx
          .select({
            id: activityProviders.id,
            organizationId: activityProviders.organizationId,
            state: activityProviders.state,
          })
          .from(activityProviders)
          .innerJoin(
            organizations,
            eq(organizations.id, activityProviders.organizationId),
          )
          .where(
            and(
              eq(activityProviders.activityId, parsed.activityId),
              inArray(activityProviders.state, ["confirmed", "proposed"]),
              eq(activityProviders.active, true),
              eq(organizations.status, "verified"),
              eq(organizations.publishingSuspended, false),
            ),
          );
        const alreadyConfirmed = publishableProviders.some(
          (provider) => provider.state === "confirmed",
        );
        if (!alreadyConfirmed) {
          /**
           * A relationship is confirmed by the organisation it names, so an
           * organisation's own editor confirms their own row and nobody
           * else's.
           *
           * Temporary launch allowance: until associations sign in and accept
           * what was entered for them, a platform editor's proposals could
           * never be published, so publishing as the platform confirms the
           * proposals naming an organisation that is already verified — and
           * records who did. Drop this once organisation acceptance exists;
           * `proposed` is the honest state for a claim nobody agreed to.
           */
          const platformPermissions = await platformPermissionsForUser(user.id);
          const actingOrganizationId = platformPermissions.has(
            "content.activity.manage",
          )
            ? null
            : owner.organizationId;
          const promotable = publishableProviders
            .filter(
              (provider) =>
                provider.state === "proposed" &&
                (actingOrganizationId === null ||
                  provider.organizationId === actingOrganizationId),
            )
            .map((provider) => provider.id);
          if (promotable.length === 0) {
            throw new Error(
              "Publication requires at least one confirmed, verified provider",
            );
          }
          await tx
            .update(activityProviders)
            .set({
              state: "confirmed",
              confirmedById: user.id,
              confirmedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(inArray(activityProviders.id, promotable));
        }
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
        .set({ unpublishedAt: new Date(), unpublishedById: user.id })
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
        publishedById: user.id,
        scheduledFor,
      });
      await tx
        .update(activityTranslations)
        .set({
          state: "verified",
          reviewStage: "platform_verified",
          verifiedById: user.id,
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
  async (formData, locale, user) => {
    const parsed = activityPublicationSchema.parse({
      activityId: formData.get("activityId"),
      languageCode: formData.get("languageCode"),
      publishAt: "",
    });

    await db.transaction(async (tx) => {
      await tx
        .update(activityPublications)
        .set({ unpublishedAt: new Date(), unpublishedById: user.id })
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

const activitySchema = z.object({ activityId: z.string().uuid() });

/**
 * Take an activity out of the workspace. Two conditions, both checked here and
 * not only in the menu that offers it:
 *
 * - Nothing of it may be published. What the public has been told stays true
 *   until someone takes each language down deliberately, so a deletion cannot
 *   be the thing that quietly unpublishes it. A language waiting for its date is
 *   a promise too.
 * - The person who entered it, or a platform administrator, is who may do it —
 *   the second because an activity outlives the account that created it, and a
 *   seeded activity was created by nobody at all.
 *
 * The row is archived rather than erased: the list reads `archived_at is null`,
 * so it disappears from the workspace while its publication history, audit
 * trail and translations stay intact for whoever asks later.
 */
export const deleteActivity = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale, user) => {
    const parsed = activitySchema.parse({
      activityId: formData.get("activityId"),
    });
    const [activity] = await db
      .select({
        createdById: activities.createdById,
        organizationId: activities.organizationId,
      })
      .from(activities)
      .where(
        and(
          eq(activities.id, parsed.activityId),
          isNull(activities.archivedAt),
        ),
      )
      .limit(1);
    if (!activity) throw new Error("Unknown activity");

    const isPlatformAdministrator = await hasActualPlatformPermission(
      user.id,
      superadminPermission,
    );
    if (activity.createdById !== user.id && !isPlatformAdministrator) {
      throw new Error("Forbidden");
    }

    const [live] = await db
      .select({ id: activityPublications.id })
      .from(activityPublications)
      .where(
        and(
          eq(activityPublications.activityId, parsed.activityId),
          isNull(activityPublications.unpublishedAt),
        ),
      )
      .limit(1);
    if (live) throw new Error("Unpublish every language first");

    await db
      .update(activities)
      .set({ archivedAt: new Date(), published: false, updatedAt: new Date() })
      .where(eq(activities.id, parsed.activityId));
    await recordAudit({
      action: "activity.archived",
      subjectType: "activity",
      subjectId: parsed.activityId,
      organizationId: activity.organizationId,
    });
    refresh(locale);
  },
);

const updateActivityContentSchema = z.object({
  activityId: z.string().uuid(),
  sourceLanguage: editorialLanguageSchema,
});

/**
 * Edit an existing activity's per-language name and description. Mirrors the
 * article content save: a changed source payload seals a new immutable
 * translation source version (so publication pinning stays coherent) and the
 * working translation rows are upserted. Locale publication is a separate,
 * out-of-scope action, so this never flips the `published` flag.
 *
 * Classification remains a separate server operation because choosing a tag
 * has no business sealing a new source version of the text. The activity editor
 * invokes it from the same page-level Save action after this content operation.
 */
export const updateActivityContent = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale, user) => {
    const parsed = updateActivityContentSchema.parse({
      activityId: formData.get("activityId"),
      sourceLanguage: formData.get("sourceLanguage"),
    });
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
            createdById: user.id,
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
          contentHash: activityTranslations.contentHash,
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
        const contentHash = translationPayloadHash({
          languageCode: translation.languageCode,
          ...payload,
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
          contentHash,
          // Words that moved lose the approvals that were about the old ones
          // (server/content/language-review.ts); a language nobody touched keeps
          // its place in the queue.
          ...(existing?.contentHash === contentHash
            ? {}
            : clearedLanguageReview),
          ...(provenance.state === "verified" &&
          translation.languageCode === parsed.sourceLanguage
            ? { verifiedById: user.id, verifiedAt: new Date() }
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
            ...clearedLanguageReview,
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

      await tx
        .update(activities)
        .set({ updatedAt: new Date() })
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

/**
 * Category, audience and public tags: three panels in the editor, so three
 * actions rather than one that guesses which field the form meant to change.
 * None of them touches a word of the record's text.
 */

const activityCategorySchema = z.object({
  activityId: z.string().uuid(),
  categoryId: z.string().uuid(),
});

export const updateActivityCategory = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const parsed = activityCategorySchema.parse({
      activityId: formData.get("activityId"),
      categoryId: formData.get("categoryId"),
    });
    const [row] = await db
      .update(activities)
      .set({ categoryId: parsed.categoryId, updatedAt: new Date() })
      .where(eq(activities.id, parsed.activityId))
      .returning({
        id: activities.id,
        organizationId: activities.organizationId,
      });
    if (!row) throw new Error("Unknown activity");
    await recordAudit({
      action: "activity.category_saved",
      subjectType: "activity",
      subjectId: row.id,
      organizationId: row.organizationId,
    });
    refresh(locale);
  },
);

const activityAudienceSchema = z.object({
  activityId: z.string().uuid(),
  audienceCategoryId: z.string().uuid(),
});

export const updateActivityAudience = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const parsed = activityAudienceSchema.parse({
      activityId: formData.get("activityId"),
      audienceCategoryId: formData.get("audienceCategoryId"),
    });
    const [row] = await db
      .update(activities)
      .set({
        audienceCategoryId: parsed.audienceCategoryId,
        updatedAt: new Date(),
      })
      .where(eq(activities.id, parsed.activityId))
      .returning({
        id: activities.id,
        organizationId: activities.organizationId,
      });
    if (!row) throw new Error("Unknown activity");
    await recordAudit({
      action: "activity.audience_saved",
      subjectType: "activity",
      subjectId: row.id,
      organizationId: row.organizationId,
    });
    refresh(locale);
  },
);

export const updateActivityTags = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const activityId = z.string().uuid().parse(formData.get("activityId"));
    const tagIds = [
      ...new Set(z.array(z.string().uuid()).parse(formData.getAll("tagId"))),
    ].slice(0, 3);

    await db.transaction(async (tx) => {
      const [activity] = await tx
        .select({
          id: activities.id,
          organizationId: activities.organizationId,
        })
        .from(activities)
        .where(eq(activities.id, activityId))
        .limit(1);
      if (!activity) throw new Error("Unknown activity");

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
        .set({ updatedAt: new Date() })
        .where(eq(activities.id, activity.id));
    });

    await recordAudit({
      action: "activity.tags_saved",
      subjectType: "activity",
      subjectId: activityId,
      organizationId: await activityOrganization(activityId),
      // How many, never which: the set itself is on the record already.
      metadata: { count: tagIds.length },
    });
    refresh(locale);
  },
);

/**
 * The compact activity editor presents category, audience, tags and included
 * services as one record-details group. Save them atomically so its single
 * button cannot leave half of the group updated when one choice is invalid.
 */
const activityDetailsSchema = z.object({
  activityId: z.string().uuid(),
  categoryId: z.string().uuid(),
  audienceCategoryId: z.string().uuid(),
  tagIds: z.array(z.string().uuid()).max(3),
  serviceIds: z.array(z.string().uuid()),
});

export const updateActivityDetails = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const parsed = activityDetailsSchema.parse({
      activityId: formData.get("activityId"),
      categoryId: formData.get("categoryId"),
      audienceCategoryId: formData.get("audienceCategoryId"),
      tagIds: [...new Set(formData.getAll("tagId"))],
      serviceIds: [...new Set(formData.getAll("serviceId"))],
    });

    const organizationId = await db.transaction(async (tx) => {
      const [activity] = await tx
        .select({ organizationId: activities.organizationId })
        .from(activities)
        .where(eq(activities.id, parsed.activityId))
        .limit(1);
      if (!activity) throw new Error("Unknown activity");

      const validTagIds =
        parsed.tagIds.length > 0
          ? (
              await tx
                .select({ id: tags.id })
                .from(tags)
                .where(
                  and(
                    inArray(tags.id, parsed.tagIds),
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
      const orderedTagIds = parsed.tagIds.filter((id) =>
        validTagIds.includes(id),
      );

      if (parsed.serviceIds.length > 0) {
        const allowedServices = await tx
          .select({ id: services.id })
          .from(services)
          .where(
            and(
              inArray(services.id, parsed.serviceIds),
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
        if (allowedServices.length !== parsed.serviceIds.length) {
          throw new Error(
            "One or more services are unavailable in this organisation",
          );
        }
      }

      await tx
        .update(activities)
        .set({
          categoryId: parsed.categoryId,
          audienceCategoryId: parsed.audienceCategoryId,
          updatedAt: new Date(),
        })
        .where(eq(activities.id, parsed.activityId));

      await tx
        .delete(activityTags)
        .where(eq(activityTags.activityId, parsed.activityId));
      if (orderedTagIds.length > 0) {
        await tx.insert(activityTags).values(
          orderedTagIds.map((tagId, displayOrder) => ({
            activityId: parsed.activityId,
            tagId,
            displayOrder,
          })),
        );
      }

      await tx
        .update(activityServices)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(activityServices.activityId, parsed.activityId));
      for (const [displayOrder, serviceId] of parsed.serviceIds.entries()) {
        await tx
          .insert(activityServices)
          .values({
            activityId: parsed.activityId,
            serviceId,
            displayOrder,
          })
          .onConflictDoUpdate({
            target: [activityServices.activityId, activityServices.serviceId],
            set: { active: true, displayOrder, updatedAt: new Date() },
          });
      }

      return activity.organizationId;
    });

    await recordAudit({
      action: "activity.details_saved",
      subjectType: "activity",
      subjectId: parsed.activityId,
      organizationId,
      metadata: {
        tags: parsed.tagIds.length,
        services: parsed.serviceIds.length,
      },
    });
    refresh(locale);
  },
);

/**
 * Where the activity happens, changed after the fact.
 *
 * The same three answers the creation form asks — city, then an existing place,
 * a new one, or none — because a service that moves premises, or was filed
 * against the wrong city on the day it was entered, must be correctable without
 * re-creating the record and losing its translations, schedule and photo with
 * it.
 */
const activityLocationSchema = z.object({
  activityId: z.string().uuid(),
  scope: z.enum(activityScopes).default("city"),
  cityId: optionalUuid,
  locationMode: z.enum(activityLocationModes),
  placeId: optionalUuid,
  placeName: optionalText,
  addressLine: optionalText,
  postalCode: optionalText,
  lat: optionalText,
  lng: optionalText,
  precision: z.enum(placePrecisions).default("exact"),
});

export const updateActivityLocation = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const scope = formData.get("scope") === "global" ? "global" : "city";
    const parsed = activityLocationSchema.parse({
      activityId: formData.get("activityId"),
      scope,
      // A global activity submits no city, and must not inherit the old one.
      cityId: scope === "global" ? "" : (formData.get("cityId") ?? ""),
      locationMode:
        scope === "global" ? "mobile" : formData.get("locationMode"),
      placeId: formData.get("placeId") ?? "",
      placeName: formData.get("placeName") ?? "",
      addressLine: formData.get("addressLine") ?? "",
      postalCode: formData.get("postalCode") ?? "",
      lat: formData.get("lat") ?? "",
      lng: formData.get("lng") ?? "",
      precision: formData.get("precision") ?? undefined,
    });

    // The same refusals the creation form makes, in the same order: this screen
    // may not write a shape that one could not have produced.
    if (parsed.scope === "city" && !parsed.cityId) {
      throw new Error("Choose the city this activity happens in");
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

    const organizationId = await db.transaction(async (tx) => {
      const [activity] = await tx
        .select({
          organizationId: activities.organizationId,
          cityId: activities.cityId,
          teamId: activities.teamId,
          sourceLanguageCode: activities.sourceLanguageCode,
        })
        .from(activities)
        .where(eq(activities.id, parsed.activityId))
        .limit(1);
      if (!activity) throw new Error("Unknown activity");

      const cityId = parsed.scope === "global" ? null : parsed.cityId;

      if (parsed.locationMode === "existing" && parsed.placeId) {
        const [place] = await tx
          .select({ cityId: places.cityId })
          .from(places)
          .where(eq(places.id, parsed.placeId))
          .limit(1);
        if (place?.cityId !== cityId) {
          throw new Error("The activity location must be in the selected city");
        }
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
            organizationId: activity.organizationId,
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
          languageCode: activity.sourceLanguageCode,
          name: parsed.placeName ?? "",
          state: "draft",
        });
      }

      /**
       * A city team is an organisation-and-city pair, so a team from the city
       * this activity is leaving cannot come with it — and a global activity
       * may hold none at all (`activities_global_has_no_team_check`). Moving
       * the record therefore drops the team rather than carrying a wrong one;
       * the new city's team is picked up the next time one is assigned.
       */
      const teamId = cityId === activity.cityId ? activity.teamId : null;

      await tx
        .update(activities)
        .set({ cityId, teamId, placeId, updatedAt: new Date() })
        .where(eq(activities.id, parsed.activityId));

      return activity.organizationId;
    });

    await recordAudit({
      action: "activity.location_saved",
      subjectType: "activity",
      subjectId: parsed.activityId,
      organizationId,
      // Which shape it took, never the address itself: the record holds that.
      metadata: { scope: parsed.scope, locationMode: parsed.locationMode },
    });
    refresh(locale);
  },
);

/** How long a confirmed activity stays fresh, matching the runbook's window. */
const FRESHNESS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * "I have checked this and it is still right."
 *
 * An activity goes stale on a timer, and until now the only thing that could
 * reset it was confirming a *scheduled occurrence on the day it ran*
 * (`dashboard/actions.ts`). An editor reading the record and finding it correct
 * had nothing to click: the banner said it was due and then said it again
 * tomorrow. So the same bookkeeping is offered from the record itself.
 *
 * "Uncertain" clears with it, exactly as confirming an occurrence clears it.
 * The notification bell reads `manual_status` *before* freshness
 * (`~/lib/freshness`), so leaving it set would have kept the record in the
 * queue after the editor had just answered the question the queue was asking —
 * the "count never goes down" complaint that comment was written about.
 *
 * "Cancelled" is the one status left alone. A cancelled activity is not in the
 * queue to begin with, and quietly un-cancelling it to tidy a badge would
 * change what the public is told.
 */
export const confirmActivityFreshness = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale, user) => {
    const id = z.string().uuid().parse(formData.get("activityId"));
    const now = new Date();
    const validUntil = new Date(now.getTime() + FRESHNESS_WINDOW_MS);

    const organizationId = await db.transaction(async (tx) => {
      const [activity] = await tx
        .select({
          organizationId: activities.organizationId,
          manualStatus: activities.manualStatus,
        })
        .from(activities)
        .where(eq(activities.id, id))
        .limit(1);
      if (!activity) throw new Error("Unknown activity");

      await tx
        .update(activities)
        .set({
          lastVerifiedAt: now,
          reviewDueAt: validUntil,
          verifiedById: user.id,
          ...(activity.manualStatus === "uncertain"
            ? { manualStatus: "normal" as const }
            : {}),
          updatedAt: now,
        })
        .where(eq(activities.id, id));

      /**
       * The verification trail is scoped by a foreign key onto
       * `activity_providers`: an organisation-scoped row may only name an
       * organisation that actually provides this activity. Most activities have
       * no provider row at all, so the trail entry is written when it can be
       * attributed truthfully and skipped when it cannot — the audit entry below
       * records the check either way, and it is the audit log that answers "who
       * said this was current".
       */
      if (!activity.organizationId) {
        await tx.insert(activityVerifications).values({
          activityId: id,
          organizationId: null,
          verifiedById: user.id,
          actorScope: "platform",
          method: "editor_freshness_check",
          verifiedAt: now,
          validUntil,
        });
        return null;
      }
      const [provider] = await tx
        .select({ organizationId: activityProviders.organizationId })
        .from(activityProviders)
        .where(
          and(
            eq(activityProviders.activityId, id),
            eq(activityProviders.organizationId, activity.organizationId),
            eq(activityProviders.state, "confirmed"),
            eq(activityProviders.active, true),
          ),
        )
        .limit(1);
      if (provider) {
        await tx.insert(activityVerifications).values({
          activityId: id,
          organizationId: provider.organizationId,
          verifiedById: user.id,
          actorScope: "organization",
          method: "editor_freshness_check",
          verifiedAt: now,
          validUntil,
        });
      }
      return activity.organizationId;
    });

    await recordAudit({
      action: "activity.freshness_confirmed",
      subjectType: "activity",
      subjectId: id,
      organizationId,
      metadata: { validUntil: validUntil.toISOString() },
    });
    refresh(locale);
  },
);

const createServiceSchema = z.object({
  organizationId: optionalUuid,
  categoryId: z.string().uuid(),
  icon: z.string().trim().min(1).max(50).default("help"),
  nameFr: z.string().trim().min(2),
  nameEn: optionalText,
  nameAr: optionalText,
  descriptionFr: optionalText,
  descriptionEn: optionalText,
  descriptionAr: optionalText,
  sourceNote: optionalText,
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

/**
 * A service with no owning organisation is platform-wide, so only an actual
 * superadmin grant may create, edit or retire one — a role test that merely
 * selected the role may not. Organisation-owned services are already covered by
 * the action's own permission gate, so they pass straight through.
 */
async function assertGlobalServiceAccess(
  organizationId: string | null,
  actorId: string,
  verb: "create" | "edit" | "manage" = "manage",
) {
  if (organizationId) return;
  if (!(await hasActualPlatformPermission(actorId, "support.superadmin"))) {
    throw new Error(`Only a superadmin can ${verb} global services`);
  }
}

/** Create a reusable capability and attach it to one activity immediately. */
export const createAndAssignService = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale, user) => {
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
    await assertGlobalServiceAccess(parsed.organizationId, user.id, "create");

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
      `${localizedPath("/dashboard/activities", locale)}?activity=${activityId}&notice=service-created`,
    );
  },
);

const updateServiceSchema = createServiceSchema.extend({
  serviceId: z.string().uuid(),
});

/** Update an organisation-owned reusable service and its authored languages. */
export const updateReusableService = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale, user) => {
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
    await assertGlobalServiceAccess(owned.organizationId, user.id, "edit");

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
  organizationId: optionalUuid,
});

export const archiveReusableService = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale, user) => {
    const parsed = serviceLifecycleSchema.parse({
      serviceId: formData.get("serviceId"),
      organizationId: formData.get("organizationId"),
    });
    await assertGlobalServiceAccess(parsed.organizationId, user.id);
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
  async (formData, locale, user) => {
    const parsed = serviceLifecycleSchema.parse({
      serviceId: formData.get("serviceId"),
      organizationId: formData.get("organizationId"),
    });
    await assertGlobalServiceAccess(parsed.organizationId, user.id);
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
    await recordAudit({
      action: "activity.service_assigned",
      subjectType: "activity",
      subjectId: parsed.activityId,
      organizationId: scope.activityOrganizationId,
      metadata: { serviceId: parsed.serviceId },
    });
    refresh(locale);
  },
);

const addScheduleSchema = z.object({
  activityId: z.string().uuid(),
  scheduleType: scheduleTypeSchema,
  weekday: weekdayNumberSchema.optional(),
  occurrenceDate: z.string().date().optional(),
  timingMode: scheduleTimingModeSchema,
  startTime: z.string().regex(timeOfDayPattern),
  endTime: z.string().regex(timeOfDayPattern),
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

        const [rule] = await tx
          .insert(scheduleRules)
          .values(candidate)
          .returning({ id: scheduleRules.id });
        return rule ?? null;
      });

      if (!inserted) {
        return { result: "error", error: "overlap", values: parsed };
      }

      // The counterpart of `activity.schedule_rule_deleted`: an opening hour that
      // appeared and one that disappeared read the same way in the trail.
      await recordAudit({
        action: "activity.schedule_rule_added",
        subjectType: "activity",
        subjectId: parsed.activityId,
        organizationId: await activityOrganization(parsed.activityId),
        metadata: {
          scheduleRuleId: inserted.id,
          scheduleType: parsed.scheduleType,
          weekday: candidate.weekday,
          startTime: candidate.startTime,
          endTime: candidate.endTime,
          occurrenceDate: parsed.occurrenceDate ?? null,
        },
      });
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
  reasonFr: optionalText,
});

/** Add a date-scoped closure without changing the recurring activity. */
export const addExceptionalClosure = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale, user) => {
    const parsed = exceptionalClosureSchema.parse({
      activityId: formData.get("activityId"),
      date: formData.get("date"),
      reasonFr: formData.get("reasonFr") ?? "",
    });
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
          .set({ createdById: user.id })
          .where(eq(scheduleExceptions.id, existing.id))
          .returning({ id: scheduleExceptions.id });
      }
      return tx
        .insert(scheduleExceptions)
        .values({
          activityId: parsed.activityId,
          date: parsed.date,
          kind: "closure",
          createdById: user.id,
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

/**
 * How to get to the activity without a car, replacing whatever was recorded
 * before.
 *
 * Wholesale, like the event's rows and for the same reason: the editor owns the
 * list, and a row edited from "bus 5" into "train, Calais-Ville" is a different
 * journey rather than a correction to that one — nothing on it, no publication
 * and no translation, is worth keeping an id alive for. Positions come from the
 * list itself, so the order the editor put the rows in is the order a visitor
 * reads them.
 *
 * The trail counts the rows and nothing else: a bus line is not a fact about a
 * person, but it is also not worth copying into the log.
 */
export const updateActivityTransit = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale) => {
    const activityId = z.string().uuid().parse(formData.get("recordId"));
    const links = parseTransitLinks(formData);
    const [activity] = await db
      .select({ organizationId: activities.organizationId })
      .from(activities)
      .where(eq(activities.id, activityId));
    if (!activity) throw new Error("Unknown activity");

    await db.transaction(async (tx) => {
      await tx
        .delete(activityTransitLinks)
        .where(eq(activityTransitLinks.activityId, activityId));
      if (links.length === 0) return;
      await tx.insert(activityTransitLinks).values(
        links.map((link, displayOrder) => ({
          activityId,
          ...link,
          displayOrder,
        })),
      );
    });
    await recordAudit({
      action: "activity.transit_replaced",
      subjectType: "activity",
      subjectId: activityId,
      organizationId: activity.organizationId,
      metadata: { links: links.length },
    });
    refresh(locale);
  },
);

const assignMemberSchema = z
  .object({
    activityId: z.string().uuid(),
    email: z.string().trim().toLowerCase().email(),
    /** Catalogue ids; `replaceSkillRecords` keeps only the reachable ones. */
    skillIds: z.array(z.string().uuid()).max(40),
    languages: z.array(z.string().min(2).max(35)).max(30),
    expertise: z.string().trim().min(2).max(160),
    visibility: z.enum(["workspace", "public"]),
    publicDisplayName: optionalText,
    publicExpertise: optionalText,
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
 * Who a person is, asked only when the address matches nobody on the books:
 * `core.organization_members` requires all five of these, so a new member cannot
 * be conjured out of an email address the way a placeholder display name used to
 * allow. An address that does match keeps the identity the roster holds — an
 * activity assignment says what somebody brings to Tuesday, not what their name
 * is.
 */
const newMemberSchema = z.object({
  firstName: personName,
  lastName: personName,
  phone: phoneNumber,
  title: z.string().trim().min(2).max(160),
});

/**
 * Assign by email whether or not an account exists. The private membership is
 * ready for identity linking later; public attribution uses separate approved
 * fields and never exposes the member email or account record.
 */
export const assignMemberToActivity = protectedPermissionAction(
  "content.activity.manage",
  async (formData, locale, user) => {
    if (!env.ENABLE_PHASE3_MEMBER_ASSIGNMENTS) {
      throw new Error("Phase 3 member assignments are not enabled");
    }
    const parsed = assignMemberSchema.parse({
      activityId: formData.get("activityId"),
      email: formData.get("email"),
      skillIds: formData.getAll("skillIds"),
      languages: formData.getAll("languages"),
      expertise: formData.get("expertise"),
      visibility: formData.get("visibility"),
      publicDisplayName: formData.get("publicDisplayName") ?? "",
      publicExpertise: formData.get("publicExpertise") ?? "",
    });
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
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${parsed.email}`)
      .limit(1);

    const { memberId, created } = await db.transaction(async (tx) => {
      const identityMatch = account
        ? or(
            eq(organizationMembers.contactEmail, parsed.email),
            eq(organizationMembers.userId, account.id),
          )
        : eq(organizationMembers.contactEmail, parsed.email);
      const [existing] = await tx
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, activityOrganizationId),
            identityMatch,
          ),
        )
        .limit(1);

      /**
       * Parsed here rather than with the rest of the form because it is only
       * required of somebody new: nothing has been written yet, so a missing
       * name fails the whole assignment instead of half-creating a member.
       */
      const memberId =
        existing?.id ??
        (await insertMember(tx, {
          organizationId: activityOrganizationId,
          userId: account?.id ?? null,
          identity: {
            ...newMemberSchema.parse({
              firstName: formData.get("firstName"),
              lastName: formData.get("lastName"),
              phone: formData.get("phone"),
              title: formData.get("title"),
            }),
            contactEmail: parsed.email,
          },
        }));
      if (existing && account) {
        await tx
          .update(organizationMembers)
          .set({ userId: account.id, status: "active" })
          .where(eq(organizationMembers.id, memberId));
      }
      await replaceMemberCapabilities(tx, memberId, {
        skillIds: parsed.skillIds,
        languageCodes,
      });

      await tx
        .insert(cityTeamMembers)
        .values({
          teamId: activityTeamId,
          organizationId: activityOrganizationId,
          memberId,
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
          memberId,
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
      return { memberId, created: !existing };
    });

    if (!account && created) {
      await sendMemberInvitation({
        organizationId: activityOrganizationId,
        email: parsed.email,
        memberId,
        invitedById: user.id,
        locale,
        organizationName: activity.organizationName,
        teamName: activity.teamName,
        // An account may never have been given a name; its address still tells
        // the invited person who is asking.
        inviterName: user.name || user.email,
      });
    }

    await recordAudit({
      action: "activity.member_assigned",
      subjectType: "activity",
      subjectId: parsed.activityId,
      organizationId: activityOrganizationId,
      metadata: {
        memberId,
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
