/**
 * The members' side of the phone app: who is signed in, the agenda they may
 * read, and one meeting in full.
 *
 * Every tier decision is made here, on the server, by asking
 * `coordination-events` — the app receives only events it is allowed to see,
 * each already carrying the words for who else sees it. Nothing on the device
 * filters anything, so a stale build cannot widen a reach.
 */
import { localeMetadata, type PublicLocale } from "@infokit/shared/i18n";
import {
  loadPageCatalog,
  type PageCatalog,
} from "@infokit/shared/i18n/catalogs";
import { formatMessage } from "@infokit/shared/i18n";
import type {
  MemberAgendaPayload,
  MemberDoorLabels,
  MemberEventPayload,
  MemberIdentityPayload,
  MemberLabels,
  MemberOrganization,
  MemberSessionPayload,
} from "@infokit/shared/public-content";
import { and, eq } from "drizzle-orm";

import { localizedPath } from "~/i18n/routing";
import type { DeviceViewer } from "~/server/auth/device-session";
import {
  coordinationViewer,
  findCoordinationEvent,
  listCoordinationEvents,
} from "~/server/content/coordination-events";
import {
  defaultMonth,
  eventLabels,
  presentEvent,
  reachLabelFor,
} from "~/server/content/public-event-payload";
import { listCityViews } from "~/server/content/event-presentation";
import { db } from "~/server/db";
import { organizationMembers, organizations, users } from "~/server/db/schema";

type Messages = PageCatalog<"member">;

export function memberLabels(messages: Messages): MemberLabels {
  return {
    agendaTitle: messages["member.agenda.title"],
    agendaDescription: messages["member.agenda.description"],
    filterAll: messages["member.filter.all"],
    filterOwn: messages["member.filter.own"],
    filterShared: messages["member.filter.shared"],
    filterPublic: messages["member.filter.public"],
    empty: messages["member.empty"],
    whoSees: messages["member.whoSees"],
    reachOrganization: messages["member.reach.organizationAny"],
    reachInterOrganization: messages["member.reach.interOrganization"],
    reachPublic: messages["member.reach.public"],
    reachOrganizationHint: messages["member.reach.organization.hint"],
    reachInterOrganizationHint: messages["member.reach.interOrganization.hint"],
    reachPublicHint: messages["member.reach.public.hint"],
    organizations: messages["member.organizations"],
    organizationVerified: messages["member.organization.verified"],
    organizationVerifiedHint: messages["member.organization.verified.hint"],
    organizationPending: messages["member.organization.pending"],
    organizationPendingHint: messages["member.organization.pending.hint"],
    readOnly: messages["member.readOnly"],
    signOut: messages["member.signOut"],
    sessionEnds: messages["member.sessionEnds"],
    account: messages["member.account"],
  };
}

/**
 * The words a signed-out app needs: the quiet row at the foot of the events
 * list and the sign-in sheet behind it. They travel with the answer to "who is
 * reading this device", so a phone that has never signed in still speaks the
 * reader's language without shipping member strings in the bundle.
 */
export function memberDoorLabels(messages: Messages): MemberDoorLabels {
  return {
    doorTitle: messages["member.door.title"],
    doorBody: messages["member.door.body"],
    signInTitle: messages["member.signIn.title"],
    signInBody: messages["member.signIn.body"],
    signInButton: messages["member.signIn.button"],
    signInPrivacy: messages["member.signIn.privacy"],
    signInCancelled: messages["member.signIn.cancelled"],
    signInFailed: messages["member.signIn.failed"],
  };
}

/**
 * The first *character* a reader would point at, which is not the first code
 * unit: an Arabic letter with a mark, or a name beginning with an emoji, is one
 * grapheme made of several.
 */
function firstGrapheme(value: string, locale: PublicLocale): string {
  const segmenter = new Intl.Segmenter(locale, { granularity: "grapheme" });
  for (const { segment } of segmenter.segment(value)) return segment;
  return "";
}

/** Two letters for the header button: initials, or the address's first letter. */
function initialsOf(
  name: string | null,
  email: string,
  locale: PublicLocale,
): string {
  const source = (name ?? "").trim();
  if (source) {
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => firstGrapheme(part, locale))
      .join("")
      .toUpperCase();
  }
  return (firstGrapheme(email, locale) || "?").toUpperCase();
}

/** Who is signed in, and which organisations answer for what they can read. */
export async function loadMemberIdentityPayload({
  viewer,
  locale,
}: {
  viewer: DeviceViewer;
  locale: PublicLocale;
}): Promise<MemberIdentityPayload | null> {
  const [messages, accountRows, memberships] = await Promise.all([
    loadPageCatalog(locale, "member"),
    db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, viewer.userId))
      .limit(1),
    db
      .select({
        id: organizations.id,
        name: organizations.displayName,
        status: organizations.status,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationMembers.organizationId),
      )
      .where(
        and(
          eq(organizationMembers.userId, viewer.userId),
          eq(organizationMembers.status, "active"),
        ),
      ),
  ]);
  const account = accountRows[0];
  if (!account) return null;

  const coordination = await coordinationViewer(viewer.userId);
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
    hourCycle: "h23",
  });
  const organizationViews: MemberOrganization[] = memberships.map((row) => {
    const verified = row.status === "verified";
    return {
      id: row.id,
      name: row.name,
      verified,
      statusLabel: verified
        ? messages["member.organization.verified"]
        : messages["member.organization.pending"],
      statusHint: verified
        ? messages["member.organization.verified.hint"]
        : messages["member.organization.pending.hint"],
    };
  });

  return {
    locale,
    direction: localeMetadata[locale].direction,
    userId: viewer.userId,
    email: account.email,
    displayName: account.name ?? account.email,
    initials: initialsOf(account.name, account.email, locale),
    organizations: organizationViews,
    platformSteward: coordination.isPlatformSteward,
    sessionEndsLabel: formatMessage(messages["member.sessionEnds"], {
      time: timeFormatter.format(viewer.expiresAt),
    }),
    labels: memberLabels(messages),
  };
}

/**
 * "Who is reading this device?" — the one question the app asks on every start.
 * A missing, expired or revoked token is not an error: it is the signed-out
 * answer, and it carries the door's words so the app can offer the way in.
 */
export async function loadMemberSessionPayload({
  viewer,
  locale,
}: {
  viewer: DeviceViewer | null;
  locale: PublicLocale;
}): Promise<MemberSessionPayload> {
  const identity = viewer
    ? await loadMemberIdentityPayload({ viewer, locale })
    : null;
  if (identity) return { signedIn: true, ...identity };
  return {
    signedIn: false,
    locale,
    direction: localeMetadata[locale].direction,
    door: memberDoorLabels(await loadPageCatalog(locale, "member")),
  };
}

/** The agenda this person may read, in one round trip, newest schedule first. */
export async function loadMemberAgendaPayload({
  viewer,
  locale,
  requestedMonth,
}: {
  viewer: DeviceViewer;
  locale: PublicLocale;
  requestedMonth?: string;
}): Promise<MemberAgendaPayload> {
  const coordination = await coordinationViewer(viewer.userId);
  const [messages, member, cities, events] = await Promise.all([
    loadPageCatalog(locale, "public-content"),
    loadPageCatalog(locale, "member"),
    listCityViews(locale),
    listCoordinationEvents({ viewer: coordination, locale }),
  ]);
  const cityById = new Map(cities.map((city) => [city.id, city]));
  const now = new Date();
  const { todayKey, month } = defaultMonth(cities, now);
  const shown = requestedMonth ?? month;

  return {
    locale,
    direction: localeMetadata[locale].direction,
    todayKey,
    month: shown,
    events: events.map((event) =>
      presentEvent({
        event,
        city: cityById.get(event.cityId),
        locale,
        messages,
        reachLabel: reachLabelFor({ event, messages: member }),
        // Only a public event has a page on the site; the others are read in
        // the app and nowhere else.
        href:
          event.visibility === "public"
            ? localizedPath(`/events/${event.id}`, locale)
            : "",
      }),
    ),
    labels: eventLabels({ messages, locale, month: shown }),
    member: memberLabels(member),
  };
}

/** One meeting in full, or null when this person may not read it. */
export async function loadMemberEventPayload({
  viewer,
  locale,
  eventId,
}: {
  viewer: DeviceViewer;
  locale: PublicLocale;
  eventId: string;
}): Promise<MemberEventPayload | null> {
  const coordination = await coordinationViewer(viewer.userId);
  const [messages, member, cities, event] = await Promise.all([
    loadPageCatalog(locale, "public-content"),
    loadPageCatalog(locale, "member"),
    listCityViews(locale),
    findCoordinationEvent({ eventId, viewer: coordination, locale }),
  ]);
  if (!event) return null;
  const cities_ = new Map(cities.map((city) => [city.id, city]));
  const { month } = defaultMonth(cities, new Date());

  return {
    locale,
    direction: localeMetadata[locale].direction,
    // The steward contact `findCoordinationEvent` also returns is workspace-only
    // (docs/DATABASE-SCHEMA.md §2); presenting the record drops it.
    event: presentEvent({
      event,
      city: cities_.get(event.cityId),
      locale,
      messages,
      reachLabel: reachLabelFor({ event, messages: member }),
      href:
        event.visibility === "public"
          ? localizedPath(`/events/${event.id}`, locale)
          : "",
    }),
    labels: eventLabels({ messages, locale, month }),
    member: memberLabels(member),
  };
}
