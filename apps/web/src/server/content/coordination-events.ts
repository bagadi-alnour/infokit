import type { PublicLocale } from "@infokit/shared/i18n";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { type StewardContactValues } from "~/lib/steward-contact";
import { db } from "~/server/db";
import { getRoleTestState, isPlatformAdmin } from "~/server/auth/authorization";
import {
  coordinationEvents,
  coordinationEventTranslations,
  organizationMembers,
  organizationProfiles,
  organizations,
  placeTranslations,
  places,
  users,
} from "~/server/db/schema";

export const COORDINATION_MANAGE_PERMISSION = "coordination.event.manage";

export type CoordinationVisibility =
  (typeof coordinationEvents.$inferSelect)["visibility"];
export type CoordinationStatus =
  (typeof coordinationEvents.$inferSelect)["status"];
/** How precisely the linked place may be shown (RISKS.md R5). */
export type LocationPrecision = (typeof places.$inferSelect)["precision"];

export interface CoordinationEventText {
  title: string;
  description: string | null;
  cancellationReason: string | null;
}

/**
 * A row as the console reads it: everything public callers get, plus the
 * workspace-only steward contact. The two types are separate on purpose — the
 * public read model cannot return what its type does not carry.
 */
export interface CoordinationEventDetail
  extends CoordinationEventRecord, StewardContactValues {}

/**
 * A row as the console agenda lists it: the record plus who entered it. The
 * creator is a person's name, so it is not part of `CoordinationEventRecord` —
 * that type is what the public agenda returns, and it must not be able to
 * carry a member of staff.
 */
export interface CoordinationEventListRecord extends CoordinationEventRecord {
  createdByName: string | null;
}

export interface CoordinationEventRecord extends CoordinationEventText {
  id: string;
  hostOrganizationId: string | null;
  hostName: string | null;
  /**
   * The host's public page slug — present only when that page actually exists,
   * so "organised by" is never a link to a 404.
   */
  hostPageSlug: string | null;
  cityId: string;
  visibility: CoordinationVisibility;
  status: CoordinationStatus;
  placeId: string | null;
  placeName: string | null;
  /**
   * Enough of the place to point at a map — and `placePrecision`, which says
   * whether pointing at one is allowed at all (RISKS.md R5).
   */
  placeAddressLine: string | null;
  placeLat: number | null;
  placeLng: number | null;
  placePrecision: LocationPrecision | null;
  locationLabel: string | null;
  contactLabel: string | null;
  contactValue: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  sourceLanguageCode: string;
  archivedAt: Date | null;
  /** Every authored language, keyed by code — the editor needs all of them. */
  translations: Record<string, CoordinationEventText>;
}

/**
 * What one signed-in person may read from the agenda. Membership is the whole
 * answer: the tiers are evaluated against these facts and nothing else.
 */
export interface CoordinationViewer {
  userId: string;
  /** Active memberships — the hosts whose `organization` tier they may read. */
  organizationIds: string[];
  /** Active member of at least one *verified* organisation (FR-P2-023). */
  inVerifiedOrganization: boolean;
  /**
   * Platform stewards read every tier. They already maintain organisations,
   * activities and places in this console and are the only steward a
   * platform-hosted event has; the tier boundary they must never cross is the
   * public one, and that is a per-event decision made by the host.
   */
  isPlatformSteward: boolean;
}

export async function coordinationViewer(
  userId: string,
): Promise<CoordinationViewer> {
  const [memberships, steward] = await Promise.all([
    db
      .select({
        organizationId: organizationMembers.organizationId,
        status: organizations.status,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationMembers.organizationId),
      )
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.status, "active"),
        ),
      ),
    isPlatformAdmin(userId),
  ]);
  return {
    userId,
    organizationIds: memberships.map((row) => row.organizationId),
    inVerifiedOrganization: memberships.some(
      (row) => row.status === "verified",
    ),
    isPlatformSteward: steward,
  };
}

/**
 * Whether the console should offer the create/edit controls. Mirrors what
 * `protectedPermissionAction` enforces on the mutations, so the UI never shows
 * a button the server would refuse.
 */
export async function canManageCoordinationEvents(
  userId: string,
): Promise<boolean> {
  const authorization = await getRoleTestState(userId);
  return (
    !authorization.isSuperadmin ||
    authorization.effectivePermissions.has(COORDINATION_MANAGE_PERMISSION)
  );
}

/**
 * The one place the three tiers turn into SQL. `public` is readable by
 * everyone, so it is the only branch a signed-out visitor gets — see
 * `listPublicCoordinationEvents`.
 */
function visibleTo(viewer: CoordinationViewer): SQL | undefined {
  if (viewer.isPlatformSteward) return undefined;
  const branches: SQL[] = [eq(coordinationEvents.visibility, "public")];
  if (viewer.inVerifiedOrganization) {
    branches.push(eq(coordinationEvents.visibility, "inter_organization"));
  }
  if (viewer.organizationIds.length > 0) {
    const ownTier = and(
      eq(coordinationEvents.visibility, "organization"),
      inArray(coordinationEvents.hostOrganizationId, viewer.organizationIds),
    );
    if (ownTier) branches.push(ownTier);
  }
  return or(...branches);
}

/** Which hosts this person may create or edit an event for. */
export function hostChoicesFor(
  viewer: CoordinationViewer,
  allOrganizations: readonly { id: string; name: string }[],
): { id: string; name: string }[] {
  if (viewer.isPlatformSteward) return [...allOrganizations];
  return allOrganizations.filter((organization) =>
    viewer.organizationIds.includes(organization.id),
  );
}

function resolveText(
  rows: readonly {
    languageCode: string;
    title: string;
    description: string | null;
    cancellationReason: string | null;
  }[],
  locale: string,
  sourceLanguageCode: string,
): CoordinationEventText {
  const pick =
    rows.find((row) => row.languageCode === locale) ??
    rows.find((row) => row.languageCode === sourceLanguageCode) ??
    rows.find((row) => row.languageCode === "fr") ??
    rows[0];
  return {
    title: pick?.title ?? "",
    description: pick?.description ?? null,
    cancellationReason: pick?.cancellationReason ?? null,
  };
}

const eventColumns = {
  id: coordinationEvents.id,
  hostOrganizationId: coordinationEvents.hostOrganizationId,
  hostName: organizations.displayName,
  /**
   * Mirrors `loadPublishedOrganization`'s conditions: a verified organisation,
   * not suspended, with a published profile. Anything else has no public page,
   * and the agenda must not pretend otherwise.
   */
  hostPageSlug: sql<
    string | null
  >`case when ${organizations.status} = 'verified' and ${organizations.publishingSuspended} = false and ${organizationProfiles.published} then ${organizations.slug} end`,
  cityId: coordinationEvents.cityId,
  visibility: coordinationEvents.visibility,
  status: coordinationEvents.status,
  placeId: coordinationEvents.placeId,
  placeName: placeTranslations.name,
  placeAddressLine: places.addressLine,
  placeLat: places.lat,
  placeLng: places.lng,
  placePrecision: places.precision,
  locationLabel: coordinationEvents.locationLabel,
  contactLabel: coordinationEvents.contactLabel,
  contactValue: coordinationEvents.contactValue,
  startsAt: coordinationEvents.startsAt,
  endsAt: coordinationEvents.endsAt,
  allDay: coordinationEvents.allDay,
  sourceLanguageCode: coordinationEvents.sourceLanguageCode,
  archivedAt: coordinationEvents.archivedAt,
} as const;

/**
 * Who to ask about this event when something looks wrong. Selected only by the
 * console query below: `eventColumns` feeds the public agenda too, and these
 * three are workspace-only (docs/DATABASE-SCHEMA.md §2).
 */
const stewardColumns = {
  stewardName: coordinationEvents.stewardName,
  stewardPhone: coordinationEvents.stewardPhone,
  stewardEmail: coordinationEvents.stewardEmail,
} as const;

/**
 * Who entered the event. Selected only by the console list, for the same reason
 * as the steward contact: the name of a person who works here is not part of an
 * event, and the public queries cannot return what they do not select.
 */
const creatorColumns = {
  createdByName: users.name,
} as const;

/** The columns every read returns, before the authored text is attached. */
interface EventRow {
  id: string;
  hostOrganizationId: string | null;
  hostName: string | null;
  hostPageSlug: string | null;
  cityId: string;
  visibility: CoordinationVisibility;
  status: CoordinationStatus;
  placeId: string | null;
  placeName: string | null;
  placeAddressLine: string | null;
  placeLat: number | null;
  placeLng: number | null;
  placePrecision: LocationPrecision | null;
  locationLabel: string | null;
  contactLabel: string | null;
  contactValue: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  sourceLanguageCode: string;
  archivedAt: Date | null;
}

async function hydrate<Row extends EventRow>(
  rows: Row[],
  locale: string,
): Promise<(Row & CoordinationEventRecord)[]> {
  if (rows.length === 0) return [];
  const translationRows = await db
    .select({
      eventId: coordinationEventTranslations.eventId,
      languageCode: coordinationEventTranslations.languageCode,
      title: coordinationEventTranslations.title,
      description: coordinationEventTranslations.description,
      cancellationReason: coordinationEventTranslations.cancellationReason,
    })
    .from(coordinationEventTranslations)
    .where(
      inArray(
        coordinationEventTranslations.eventId,
        rows.map((row) => row.id),
      ),
    );
  const byEvent = new Map<string, typeof translationRows>();
  for (const row of translationRows) {
    const list = byEvent.get(row.eventId) ?? [];
    list.push(row);
    byEvent.set(row.eventId, list);
  }
  return rows.map((row) => {
    const languages = byEvent.get(row.id) ?? [];
    return {
      ...row,
      ...resolveText(languages, locale, row.sourceLanguageCode),
      translations: Object.fromEntries(
        languages.map((language) => [
          language.languageCode,
          {
            title: language.title,
            description: language.description,
            cancellationReason: language.cancellationReason,
          },
        ]),
      ),
    };
  });
}

function baseQuery(locale: string) {
  return db
    .select(eventColumns)
    .from(coordinationEvents)
    .leftJoin(
      organizations,
      eq(organizations.id, coordinationEvents.hostOrganizationId),
    )
    .leftJoin(
      organizationProfiles,
      eq(organizationProfiles.organizationId, organizations.id),
    )
    .leftJoin(places, eq(places.id, coordinationEvents.placeId))
    .leftJoin(
      placeTranslations,
      and(
        eq(placeTranslations.placeId, places.id),
        eq(placeTranslations.languageCode, locale),
      ),
    );
}

/** The same query with the steward contact — never used by a public surface. */
function workspaceQuery(locale: string) {
  return db
    .select({ ...eventColumns, ...stewardColumns })
    .from(coordinationEvents)
    .leftJoin(
      organizations,
      eq(organizations.id, coordinationEvents.hostOrganizationId),
    )
    .leftJoin(
      organizationProfiles,
      eq(organizationProfiles.organizationId, organizations.id),
    )
    .leftJoin(places, eq(places.id, coordinationEvents.placeId))
    .leftJoin(
      placeTranslations,
      and(
        eq(placeTranslations.placeId, places.id),
        eq(placeTranslations.languageCode, locale),
      ),
    );
}

/**
 * The same query with the creator's name — the console list, where "who entered
 * this" is part of answering for the agenda.
 */
function consoleListQuery(locale: string) {
  return (
    db
      .select({ ...eventColumns, ...creatorColumns })
      .from(coordinationEvents)
      .leftJoin(
        organizations,
        eq(organizations.id, coordinationEvents.hostOrganizationId),
      )
      .leftJoin(
        organizationProfiles,
        eq(organizationProfiles.organizationId, organizations.id),
      )
      .leftJoin(places, eq(places.id, coordinationEvents.placeId))
      .leftJoin(
        placeTranslations,
        and(
          eq(placeTranslations.placeId, places.id),
          eq(placeTranslations.languageCode, locale),
        ),
      )
      // Outer: the creator may have been removed, and seeded events never had one.
      .leftJoin(users, eq(users.id, coordinationEvents.createdById))
  );
}

/** The workspace agenda for one person, newest schedule first. */
export async function listCoordinationEvents({
  viewer,
  locale,
  cityId,
  includeArchived = false,
}: {
  viewer: CoordinationViewer;
  locale: PublicLocale;
  cityId?: string;
  includeArchived?: boolean;
}): Promise<CoordinationEventListRecord[]> {
  const rows = await consoleListQuery(locale)
    .where(
      and(
        visibleTo(viewer),
        cityId ? eq(coordinationEvents.cityId, cityId) : undefined,
        includeArchived ? undefined : isNull(coordinationEvents.archivedAt),
      ),
    )
    .orderBy(asc(coordinationEvents.startsAt));
  return hydrate(rows, locale);
}

/** One event, only if this person may read it. */
export async function findCoordinationEvent({
  eventId,
  viewer,
  locale,
}: {
  eventId: string;
  viewer: CoordinationViewer;
  locale: PublicLocale;
}): Promise<CoordinationEventDetail | null> {
  const rows = await workspaceQuery(locale)
    .where(and(eq(coordinationEvents.id, eventId), visibleTo(viewer)))
    .limit(1);
  const [record] = await hydrate(rows, locale);
  return record ?? null;
}

/**
 * The public surface. Filters on the `public` tier and nothing else, so an
 * organisation- or network-scoped event can never leak here even if a caller
 * forgets a condition (AGENTS.md never-public invariants).
 */
export async function listPublicCoordinationEvents({
  locale,
  from,
  cityId,
}: {
  locale: PublicLocale;
  /** Events still running at or after this instant. */
  from: Date;
  cityId?: string;
}): Promise<CoordinationEventRecord[]> {
  const rows = await baseQuery(locale)
    .where(
      and(
        eq(coordinationEvents.visibility, "public"),
        isNull(coordinationEvents.archivedAt),
        gte(coordinationEvents.endsAt, from),
        cityId ? eq(coordinationEvents.cityId, cityId) : undefined,
      ),
    )
    .orderBy(asc(coordinationEvents.startsAt));
  return hydrate(rows, locale);
}

/**
 * One public event for its own shareable page. Same single condition as the
 * list: an event that is not on the `public` tier is not found here, so a
 * guessed id reveals nothing.
 */
export async function findPublicCoordinationEvent({
  eventId,
  locale,
}: {
  eventId: string;
  locale: PublicLocale;
}): Promise<CoordinationEventRecord | null> {
  const rows = await baseQuery(locale)
    .where(
      and(
        eq(coordinationEvents.id, eventId),
        eq(coordinationEvents.visibility, "public"),
        isNull(coordinationEvents.archivedAt),
      ),
    )
    .limit(1);
  const [record] = await hydrate(rows, locale);
  return record ?? null;
}

/** Past public events, most recent first — the archive tail of the agenda. */
export async function listPastPublicCoordinationEvents({
  locale,
  before,
  cityId,
  limit = 6,
}: {
  locale: PublicLocale;
  before: Date;
  cityId?: string;
  limit?: number;
}): Promise<CoordinationEventRecord[]> {
  const rows = await baseQuery(locale)
    .where(
      and(
        eq(coordinationEvents.visibility, "public"),
        isNull(coordinationEvents.archivedAt),
        lt(coordinationEvents.endsAt, before),
        cityId ? eq(coordinationEvents.cityId, cityId) : undefined,
      ),
    )
    .orderBy(desc(coordinationEvents.startsAt))
    .limit(limit);
  return hydrate(rows, locale);
}
