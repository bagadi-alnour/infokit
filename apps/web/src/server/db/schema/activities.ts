import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { assets } from "./assets";
import { organizationMembers } from "./access";
import { cities, languages } from "./catalog";
import { contacts, organizations } from "./organizations";
import { places } from "./places";
import { services } from "./services";
import { tags } from "./tags";
import {
  archival,
  activityActorScope,
  activityClaimState,
  activityRelationshipState,
  content,
  contactVisibility,
  core,
  holidayBehavior,
  scheduleExceptionKind,
  serviceManualStatus,
  stewardContact,
  timestamps,
  translationMethod,
  translationState,
  verification,
} from "./schemas";
import { audienceCategories, serviceCategories } from "./taxonomies";
import { translationSourceVersions } from "./translation-sources";

/**
 * The full publishing/operations team for one organisation and city. It owns
 * the organisation's work across every activity in that city and never spans
 * cities; per-activity teams are subsets represented by member assignments.
 */
export const cityTeams = core.table(
  "city_teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id),
    name: varchar("name", { length: 150 }).notNull(),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    unique("city_teams_org_city_uq").on(t.organizationId, t.cityId),
    unique("city_teams_org_scope_uq").on(t.id, t.organizationId),
  ],
);

/** Private membership of the full organisation/city team. */
export const cityTeamMembers = core.table(
  "city_team_members",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => cityTeams.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull(),
    /** At most one lead per team, enforced by a partial unique index. */
    isLead: boolean("is_lead").notNull().default(false),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.memberId] }),
    uniqueIndex("city_team_members_lead_uq")
      .on(t.teamId)
      .where(sql`${t.isLead} and ${t.active}`),
    foreignKey({
      name: "city_team_members_team_scope_fk",
      columns: [t.teamId, t.organizationId],
      foreignColumns: [cityTeams.id, cityTeams.organizationId],
    }).onDelete("cascade"),
    foreignKey({
      name: "city_team_members_member_scope_fk",
      columns: [t.memberId, t.organizationId],
      foreignColumns: [
        organizationMembers.id,
        organizationMembers.organizationId,
      ],
    }).onDelete("cascade"),
    index("city_team_members_member_idx").on(t.memberId),
  ],
);

/**
 * A public activity is the scheduled, confirmable offering. Reusable service
 * capabilities are attached through `activity_services`; freshness never
 * transfers automatically between activities that share a capability.
 */
export const activities = content.table(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stable, human-readable public URL key; unique across activities. */
    slug: varchar("slug", { length: 160 }).unique(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    /**
     * The city this activity happens in, or null when it is global.
     *
     * Almost everything is local: one city, one team, usually one address. A
     * nationwide helpline or an online service is the rare exception, and it
     * belongs to no city — the same nullable-city convention editorial entries
     * already use. A global activity therefore has no city team either.
     */
    cityId: uuid("city_id").references(() => cities.id),
    teamId: uuid("team_id"),
    placeId: uuid("place_id").references(() => places.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => serviceCategories.id),
    audienceCategoryId: uuid("audience_category_id")
      .notNull()
      .references(() => audienceCategories.id),
    sourceLanguageCode: varchar("source_language_code", { length: 35 })
      .notNull()
      .default("fr")
      .references(() => languages.code),
    minAge: smallint("min_age"),
    maxAge: smallint("max_age"),
    manualStatus: serviceManualStatus("manual_status")
      .notNull()
      .default("normal"),
    published: boolean("published").notNull().default(false),
    createdById: varchar("created_by_id", { length: 255 }).references(
      () => users.id,
    ),
    createdByScope: activityActorScope("created_by_scope")
      .notNull()
      .default("organization"),
    provisionedByPlatform: boolean("provisioned_by_platform")
      .notNull()
      .default(false),
    verifiedById: varchar("verified_by_id", { length: 255 }).references(
      () => users.id,
    ),
    sourceNote: text("source_note"),
    ...stewardContact,
    ...verification,
    ...archival,
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "activities_team_scope_fk",
      columns: [t.teamId, t.organizationId],
      foreignColumns: [cityTeams.id, cityTeams.organizationId],
    }).onDelete("restrict"),
    check(
      "activities_team_requires_organization_check",
      sql`${t.teamId} is null or ${t.organizationId} is not null`,
    ),
    check(
      "activities_platform_origin_check",
      sql`${t.createdByScope} <> 'platform' or ${t.provisionedByPlatform}`,
    ),
    // A team is an organisation-and-city pair, so a global activity cannot have
    // one; the database refuses the combination rather than trusting callers.
    check(
      "activities_global_has_no_team_check",
      sql`${t.cityId} is not null or ${t.teamId} is null`,
    ),
    index("activities_org_city_idx").on(t.organizationId, t.cityId),
    index("activities_team_idx").on(t.teamId),
    index("activities_place_idx").on(t.placeId),
    index("activities_category_idx").on(t.categoryId),
    index("activities_published_idx").on(t.published),
  ],
);

export const activityTranslations = content.table(
  "activity_translations",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    name: varchar("name", { length: 150 }).notNull(),
    descriptionHtml: text("description_html"),
    descriptionText: text("description_text"),
    shortDescription: text("short_description"),
    instructions: text("instructions"),
    cancellationNote: text("cancellation_note"),
    state: translationState("state").notNull().default("draft"),
    method: translationMethod("method").notNull().default("human"),
    sourceVersionId: uuid("source_version_id"),
    contentHash: varchar("content_hash", { length: 64 }),
    providerCode: varchar("provider_code", { length: 100 }),
    providerJobReference: varchar("provider_job_reference", { length: 255 }),
    carriedForwardFromSourceVersionId: uuid(
      "carried_forward_from_source_version_id",
    ),
    verifiedById: varchar("verified_by_id", { length: 255 }).references(
      () => users.id,
    ),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.activityId, t.languageCode] }),
    foreignKey({
      name: "activity_translations_source_scope_fk",
      columns: [t.sourceVersionId],
      foreignColumns: [translationSourceVersions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "activity_translations_carried_source_scope_fk",
      columns: [t.carriedForwardFromSourceVersionId],
      foreignColumns: [translationSourceVersions.id],
    }).onDelete("restrict"),
  ],
);

/**
 * Locale activation stays separate from translation quality. The source
 * version and localized payload hash pin the exact text approved for public
 * use; the immutable publication-snapshot layer freezes the full activity.
 */
export const activityPublications = content.table(
  "activity_publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    sourceVersionId: uuid("source_version_id").notNull(),
    translationContentHash: varchar("translation_content_hash", {
      length: 64,
    }).notNull(),
    publishedById: varchar("published_by_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Null activates immediately; a future value delays public visibility. */
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    unpublishedById: varchar("unpublished_by_id", { length: 255 }).references(
      () => users.id,
    ),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: "activity_publications_source_scope_fk",
      columns: [t.sourceVersionId],
      foreignColumns: [translationSourceVersions.id],
    }).onDelete("restrict"),
    check(
      "activity_publications_content_hash_check",
      sql`${t.translationContentHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "activity_publications_schedule_check",
      sql`${t.scheduledFor} is null or ${t.scheduledFor} > ${t.publishedAt}`,
    ),
    check(
      "activity_publications_unpublish_check",
      sql`(${t.unpublishedAt} is null and ${t.unpublishedById} is null) or (${t.unpublishedAt} >= ${t.publishedAt} and ${t.unpublishedById} is not null)`,
    ),
    uniqueIndex("activity_publications_active_uq")
      .on(t.activityId, t.languageCode)
      .where(sql`${t.unpublishedAt} is null`),
  ],
);

/** Provider-supplied audience wording belongs to the activity occurrence. */
export const activityAudienceTranslations = content.table(
  "activity_audience_translations",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    eligibilityDetails: text("eligibility_details").notNull(),
    state: translationState("state").notNull().default("draft"),
  },
  (t) => [primaryKey({ columns: [t.activityId, t.languageCode] })],
);

/** Reusable services/capabilities assigned to an activity (many-to-many). */
export const activityServices = content.table(
  "activity_services",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    displayOrder: integer("display_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.activityId, t.serviceId] }),
    index("activity_services_service_idx").on(t.serviceId),
  ],
);

/** Flexible public labels attached to an activity; tags never grant access. */
export const activityTags = content.table(
  "activity_tags",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "restrict" }),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.activityId, t.tagId] })],
);

/** Organisation-approved safe contacts shown as an activity's next step. */
export const activityContacts = content.table(
  "activity_contacts",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.activityId, t.contactId] })],
);

/** Organisations that originated or co-authored an activity. */
export const activityCreatorOrganizations = content.table(
  "activity_creator_organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    state: activityRelationshipState("state").notNull().default("proposed"),
    proposedById: varchar("proposed_by_id", { length: 255 }).references(
      () => users.id,
    ),
    confirmedById: varchar("confirmed_by_id", { length: 255 }).references(
      () => users.id,
    ),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("activity_creator_organizations_activity_org_uq").on(
      t.activityId,
      t.organizationId,
    ),
    check(
      "activity_creator_organizations_state_time_check",
      sql`(${t.state} = 'confirmed' and ${t.confirmedAt} is not null) or (${t.state} = 'retired' and ${t.retiredAt} is not null) or ${t.state} in ('proposed', 'rejected')`,
    ),
  ],
);

/** Every published activity has one or more confirmed, verified providers. */
export const activityProviders = content.table(
  "activity_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    state: activityRelationshipState("state").notNull().default("proposed"),
    providerRole: varchar("provider_role", { length: 80 })
      .notNull()
      .default("provider"),
    displayOrder: integer("display_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    proposedById: varchar("proposed_by_id", { length: 255 }).references(
      () => users.id,
    ),
    confirmedById: varchar("confirmed_by_id", { length: 255 }).references(
      () => users.id,
    ),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("activity_providers_activity_org_uq").on(
      t.activityId,
      t.organizationId,
    ),
    check(
      "activity_providers_state_time_check",
      sql`(${t.state} = 'confirmed' and ${t.confirmedAt} is not null) or (${t.state} = 'retired' and ${t.retiredAt} is not null) or ${t.state} in ('proposed', 'rejected')`,
    ),
    check(
      "activity_providers_effective_dates_check",
      sql`${t.effectiveTo} is null or ${t.effectiveFrom} is null or ${t.effectiveTo} >= ${t.effectiveFrom}`,
    ),
  ],
);

/**
 * Append-only organisation-scoped verification evidence. A nullable
 * organisation represents a platform intake check and never impersonates an
 * organisation's own verification.
 */
export const activityVerifications = content.table(
  "activity_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id").references(() => organizations.id),
    verifiedById: varchar("verified_by_id", { length: 255 }).references(
      () => users.id,
    ),
    verifiedByMemberId: uuid("verified_by_member_id"),
    actorScope: activityActorScope("actor_scope").notNull(),
    method: varchar("method", { length: 80 }).notNull(),
    sourceVersionId: uuid("source_version_id"),
    scopeHash: varchar("scope_hash", { length: 64 }),
    verifiedAt: timestamp("verified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    validUntil: timestamp("valid_until", { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: "activity_verifications_provider_scope_fk",
      columns: [t.activityId, t.organizationId],
      foreignColumns: [
        activityProviders.activityId,
        activityProviders.organizationId,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "activity_verifications_member_scope_fk",
      columns: [t.verifiedByMemberId, t.organizationId],
      foreignColumns: [
        organizationMembers.id,
        organizationMembers.organizationId,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "activity_verifications_source_scope_fk",
      columns: [t.sourceVersionId],
      foreignColumns: [translationSourceVersions.id],
    }).onDelete("restrict"),
    check(
      "activity_verifications_organization_scope_check",
      sql`${t.actorScope} <> 'organization' or ${t.organizationId} is not null`,
    ),
    check(
      "activity_verifications_actor_check",
      sql`${t.actorScope} = 'system' or ${t.verifiedById} is not null`,
    ),
    check(
      "activity_verifications_hash_check",
      sql`${t.scopeHash} is null or ${t.scopeHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "activity_verifications_validity_check",
      sql`${t.validUntil} is null or ${t.validUntil} >= ${t.verifiedAt}`,
    ),
    index("activity_verifications_activity_time_idx").on(
      t.activityId,
      t.verifiedAt,
    ),
    index("activity_verifications_org_time_idx").on(
      t.organizationId,
      t.verifiedAt,
    ),
  ],
);

/** Mutable authoring attachments; publication bundles freeze exact variants. */
export const activityAssets = content.table(
  "activity_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    role: varchar("role", { length: 50 }).notNull(),
    languageCode: varchar("language_code", { length: 35 }).references(
      () => languages.code,
    ),
    displayOrder: integer("display_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    unique("activity_assets_activity_asset_role_uq").on(
      t.activityId,
      t.assetId,
      t.role,
    ),
  ],
);

/** Secure claim or coordinating-custody transfer request. */
export const activityClaimRequests = content.table(
  "activity_claim_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "restrict" }),
    destinationOrganizationId: uuid("destination_organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    destinationTeamId: uuid("destination_team_id"),
    previousOrganizationId: uuid("previous_organization_id").references(
      () => organizations.id,
      { onDelete: "restrict" },
    ),
    previousTeamId: uuid("previous_team_id"),
    representativeMemberId: uuid("representative_member_id"),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    state: activityClaimState("state").notNull().default("pending"),
    requestedById: varchar("requested_by_id", { length: 255 }).references(
      () => users.id,
    ),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    decidedById: varchar("decided_by_id", { length: 255 }).references(
      () => users.id,
    ),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "activity_claim_requests_destination_team_scope_fk",
      columns: [t.destinationTeamId, t.destinationOrganizationId],
      foreignColumns: [cityTeams.id, cityTeams.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "activity_claim_requests_previous_team_scope_fk",
      columns: [t.previousTeamId, t.previousOrganizationId],
      foreignColumns: [cityTeams.id, cityTeams.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "activity_claim_requests_representative_scope_fk",
      columns: [t.representativeMemberId, t.destinationOrganizationId],
      foreignColumns: [
        organizationMembers.id,
        organizationMembers.organizationId,
      ],
    }).onDelete("restrict"),
    check(
      "activity_claim_requests_token_hash_check",
      sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "activity_claim_requests_expiry_check",
      sql`${t.expiresAt} > ${t.createdAt}`,
    ),
    check(
      "activity_claim_requests_decision_check",
      sql`(${t.state} in ('accepted', 'declined') and ${t.decidedAt} is not null and ${t.decidedById} is not null) or (${t.state} in ('pending', 'expired', 'cancelled'))`,
    ),
    uniqueIndex("activity_claim_requests_active_uq")
      .on(t.activityId, t.destinationOrganizationId)
      .where(sql`${t.state} = 'pending'`),
    index("activity_claim_requests_expiry_idx").on(t.state, t.expiresAt),
  ],
);

/**
 * Immutable typed history for claim/transfer decisions. Global audit receives
 * a parallel security event, while these rows preserve domain old/new values.
 */
export const activityCustodyEvents = content.table(
  "activity_custody_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "restrict" }),
    claimRequestId: uuid("claim_request_id").references(
      () => activityClaimRequests.id,
      { onDelete: "restrict" },
    ),
    action: varchar("action", { length: 80 }).notNull(),
    actorUserId: varchar("actor_user_id", { length: 255 }).references(
      () => users.id,
    ),
    actorScope: activityActorScope("actor_scope").notNull(),
    previousOrganizationId: uuid("previous_organization_id").references(
      () => organizations.id,
      { onDelete: "restrict" },
    ),
    newOrganizationId: uuid("new_organization_id").references(
      () => organizations.id,
      { onDelete: "restrict" },
    ),
    previousTeamId: uuid("previous_team_id"),
    newTeamId: uuid("new_team_id"),
    assetDisposition: varchar("asset_disposition", { length: 50 }),
    assignmentDisposition: varchar("assignment_disposition", { length: 50 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "activity_custody_events_previous_team_scope_fk",
      columns: [t.previousTeamId, t.previousOrganizationId],
      foreignColumns: [cityTeams.id, cityTeams.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "activity_custody_events_new_team_scope_fk",
      columns: [t.newTeamId, t.newOrganizationId],
      foreignColumns: [cityTeams.id, cityTeams.organizationId],
    }).onDelete("restrict"),
    check(
      "activity_custody_events_actor_check",
      sql`${t.actorScope} = 'system' or ${t.actorUserId} is not null`,
    ),
    index("activity_custody_events_activity_time_idx").on(
      t.activityId,
      t.occurredAt,
    ),
  ],
);

/**
 * One member of an activity team, which is an operational subset of the
 * activity's city team. Assignment actions add or reactivate city-team
 * membership first. Email, account identity, and the organisation member
 * record are never projected publicly; public mode exposes only the approved
 * display label and expertise written specifically for this activity.
 */
export const activityMemberAssignments = content.table(
  "activity_member_assignments",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull(),
    expertise: varchar("expertise", { length: 160 }).notNull(),
    visibility: contactVisibility("visibility").notNull().default("workspace"),
    publicDisplayName: varchar("public_display_name", { length: 160 }),
    publicExpertise: varchar("public_expertise", { length: 160 }),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.activityId, t.memberId] }),
    foreignKey({
      name: "activity_member_assignments_member_scope_fk",
      columns: [t.memberId, t.organizationId],
      foreignColumns: [
        organizationMembers.id,
        organizationMembers.organizationId,
      ],
    }).onDelete("cascade"),
    check(
      "activity_member_assignments_public_projection_check",
      sql`${t.visibility} <> 'public' or (${t.publicDisplayName} is not null and ${t.publicExpertise} is not null)`,
    ),
    index("activity_member_assignments_member_idx").on(t.memberId),
  ],
);

/** Weekly recurring hours; weekday is ISO (1 = Monday … 7 = Sunday). */
export const scheduleRules = content.table(
  "schedule_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    timingMode: varchar("timing_mode", { length: 20 })
      .$type<"fixed" | "flexible">()
      .notNull()
      .default("fixed"),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    endsNextDay: boolean("ends_next_day").notNull().default(false),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    holidayBehavior: holidayBehavior("holiday_behavior")
      .notNull()
      .default("closed"),
    ...timestamps,
  },
  (t) => [
    index("schedule_rules_activity_idx").on(t.activityId),
    check("schedule_rules_weekday_range", sql`${t.weekday} between 1 and 7`),
    check(
      "schedule_rules_timing_mode_check",
      sql`${t.timingMode} in ('fixed', 'flexible')`,
    ),
    check(
      "schedule_rules_time_order",
      sql`${t.endsNextDay} or ${t.startTime} < ${t.endTime}`,
    ),
  ],
);

/** Closures, cancellations, exceptional openings, uncertainty — per date. */
export const scheduleExceptions = content.table(
  "schedule_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    kind: scheduleExceptionKind("kind").notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    createdById: varchar("created_by_id", { length: 255 }).references(
      () => users.id,
    ),
    ...timestamps,
  },
  (t) => [
    index("schedule_exceptions_activity_date_idx").on(t.activityId, t.date),
    check(
      "schedule_exceptions_time_pair_check",
      sql`(${t.startTime} is null and ${t.endTime} is null) or (${t.startTime} is not null and ${t.endTime} is not null and ${t.startTime} < ${t.endTime})`,
    ),
    uniqueIndex("schedule_exceptions_full_day_uq")
      .on(t.activityId, t.date, t.kind)
      .where(sql`${t.startTime} is null and ${t.endTime} is null`),
    uniqueIndex("schedule_exceptions_partial_window_uq")
      .on(t.activityId, t.date, t.kind, t.startTime, t.endTime)
      .where(sql`${t.startTime} is not null and ${t.endTime} is not null`),
  ],
);

export const scheduleExceptionTranslations = content.table(
  "schedule_exception_translations",
  {
    exceptionId: uuid("exception_id")
      .notNull()
      .references(() => scheduleExceptions.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 35 })
      .notNull()
      .references(() => languages.code),
    publicReason: text("public_reason").notNull(),
    state: translationState("state").notNull().default("draft"),
  },
  (t) => [primaryKey({ columns: [t.exceptionId, t.languageCode] })],
);

/**
 * Immutable, date-scoped evidence for the one-tap freshness loop. Keeping an
 * occurrence row means a later confirmation never erases the calendar history
 * of an earlier day. The activity-level verification columns remain the quick
 * answer for public "last checked" messaging.
 */
export const activityOccurrenceConfirmations = content.table(
  "activity_occurrence_confirmations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id").references(() => organizations.id),
    date: date("date").notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedById: varchar("confirmed_by_id", { length: 255 }).references(
      () => users.id,
    ),
    actorScope: activityActorScope("actor_scope").notNull(),
  },
  (t) => [
    foreignKey({
      name: "activity_occurrence_confirmations_provider_scope_fk",
      columns: [t.activityId, t.organizationId],
      foreignColumns: [
        activityProviders.activityId,
        activityProviders.organizationId,
      ],
    }).onDelete("restrict"),
    check(
      "activity_occurrence_confirmations_organization_scope_check",
      sql`${t.actorScope} <> 'organization' or ${t.organizationId} is not null`,
    ),
    check(
      "activity_occurrence_confirmations_actor_check",
      sql`${t.actorScope} = 'system' or ${t.confirmedById} is not null`,
    ),
    uniqueIndex("activity_occurrence_confirmations_org_date_uq")
      .on(t.activityId, t.date, t.organizationId)
      .where(sql`${t.organizationId} is not null`),
    uniqueIndex("activity_occurrence_confirmations_platform_date_uq")
      .on(t.activityId, t.date)
      .where(sql`${t.organizationId} is null`),
    index("activity_occurrence_confirmations_date_idx").on(t.date),
  ],
);
