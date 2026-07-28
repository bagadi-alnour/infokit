/**
 * The basic-information block: the numbers to call when something is happening
 * now, and the shortest routes into what is published.
 *
 * "Basic information" is the shortest route to urgent or frequently needed help,
 * and it must be reachable without answering the guide's questions first
 * (docs/PRODUCT.md §6, docs/PHASE-1-PUBLIC-INFORMATION.md §5). Every word and
 * every link is settled here, on the server, so the site and the app can say the
 * same thing (docs/UI-ARCHITECTURE.md §1).
 */
import { emergencyNumbers, type EmergencyNumber } from "@infokit/shared/basics";
import type { PublicLocale } from "@infokit/shared/i18n";
import type { PageCatalog } from "@infokit/shared/i18n/catalogs";

import { localizedPath } from "~/i18n/routing";
import type { PublishedActivity } from "~/server/content/public-content";

type Messages = PageCatalog<"public-content">;

/** One number, with the words that say what it is for and how to reach it. */
export interface EmergencyContact {
  code: EmergencyNumber["code"];
  dial: string;
  icon: string;
  label: string;
  hint: string;
  /** "Call 15" or "Text 114" — already carrying the digits. */
  action: string;
  /** `tel:` for a number that is answered, `sms:` for one that is written to. */
  href: string;
}

const numberLabelKeys = {
  emergency: ["basics.number.emergency", "basics.number.emergencyHint"],
  ambulance: ["basics.number.ambulance", "basics.number.ambulanceHint"],
  police: ["basics.number.police", "basics.number.policeHint"],
  fire: ["basics.number.fire", "basics.number.fireHint"],
  shelter: ["basics.number.shelter", "basics.number.shelterHint"],
  deaf: ["basics.number.deaf", "basics.number.deafHint"],
} as const;

/**
 * The emergency numbers of the city's country, worded in the reader's language.
 *
 * The digits are configuration and the words are catalogue entries: neither is
 * written into a screen, so another country's deployment changes one list and
 * translates one table (docs/PRODUCT.md §2).
 */
export function emergencyContacts(messages: Messages): EmergencyContact[] {
  return emergencyNumbers.map((number) => {
    const [labelKey, hintKey] = numberLabelKeys[number.code];
    return {
      code: number.code,
      dial: number.dial,
      icon: number.icon,
      label: messages[labelKey],
      hint: messages[hintKey],
      action: (number.callable
        ? messages["basics.call"]
        : messages["basics.sms"]
      ).replace("{number}", number.dial),
      href: `${number.callable ? "tel" : "sms"}:${number.dial}`,
    };
  });
}

/** One card of the urgent row: where to go first, and what it answers. */
export interface UrgentRoute {
  code: string;
  /** The catalogue's icon name, drawn by each surface's own icon set. */
  icon: string;
  title: string;
  hint: string;
  /** A `tel:` number to press, or a page inside the site. */
  href: string;
  /** True for the one call that is for danger — colour is never the only cue. */
  danger: boolean;
}

/**
 * The two numbers worth a card of their own: the one for danger, and the one for
 * a bed tonight. The rest of the numbers are configuration the urgent row does
 * not promote — order matters here, since it is the order the cards are read in.
 */
const URGENT_NUMBER_CODES: EmergencyNumber["code"][] = ["emergency", "shelter"];

/**
 * The third card is water and washing: the need that is counted in hours rather
 * than days, and the one thing the two numbers above it cannot answer.
 *
 * Water leads, and showers stand in for it where a city publishes washing but no
 * water point — the list takes one service filter, so the card names both and
 * opens the first of them that anything published offers.
 */
const WATER_SERVICE_CODES = ["drinking_water", "showers_hygiene"];

/**
 * The shortest routes on the page: the call for danger, the call for a bed
 * tonight, and the way to water and a shower.
 *
 * The numbers come from the same configuration as the grid and the third card
 * opens a filter on what is published, so the row states no fact of its own — it
 * only puts three answers first, and it shrinks to two where nothing offers
 * water or washing yet (AGENTS.md rule 5: never route a reader to an empty page).
 */
export function urgentRoutes({
  activities,
  locale,
  messages,
}: {
  activities: PublishedActivity[];
  locale: PublicLocale;
  messages: Messages;
}): UrgentRoute[] {
  const contacts = emergencyContacts(messages);
  const routes: UrgentRoute[] = [];
  for (const code of URGENT_NUMBER_CODES) {
    const contact = contacts.find((item) => item.code === code);
    if (!contact) continue;
    routes.push({
      code: contact.code,
      icon: contact.icon,
      // The digits are in the action wording already: "Call 112".
      title: contact.action,
      hint: contact.hint,
      href: contact.href,
      danger: contact.code === "emergency",
    });
  }

  const services = serviceRoutes({ activities, locale });
  const water = WATER_SERVICE_CODES.map((code) =>
    services.find((service) => service.code === code),
  ).find((service) => service !== undefined);
  if (water) {
    routes.push({
      code: water.code,
      // The glyph is the service's own — a drop where the card opens water, a
      // shower where that is what the city publishes.
      icon: water.icon,
      title: messages["basics.water"],
      hint: messages["basics.waterHint"],
      href: water.href,
      danger: false,
    });
  }

  return routes;
}

/** One tile of the needs row: a kind of help, and the way to what is published. */
export interface BasicInformationRoute {
  code: string;
  label: string;
  /** The catalogue's icon name, drawn by each surface's own icon set. */
  icon: string;
  /** How many published activities are behind the tile. */
  count: number;
  href: string;
}

/**
 * One tile per kind of help that is actually published, most-published first,
 * each opening the activity list already filtered to it.
 *
 * The tiles are read off the published activities, never from a hand-written
 * list: a category with nothing behind it is not offered, so no tile can lead a
 * reader to an empty page (AGENTS.md rule 5).
 */
export function basicInformationRoutes({
  activities,
  locale,
}: {
  activities: PublishedActivity[];
  locale: PublicLocale;
}): BasicInformationRoute[] {
  const routes = new Map<string, BasicInformationRoute>();
  for (const activity of activities) {
    const existing = routes.get(activity.categoryCode);
    if (existing) {
      existing.count += 1;
      continue;
    }
    routes.set(activity.categoryCode, {
      code: activity.categoryCode,
      label: activity.categoryLabel,
      icon: activity.categoryIcon,
      count: 1,
      href: `${localizedPath("/activities", locale)}?category=${encodeURIComponent(activity.categoryCode)}`,
    });
  }

  const collator = new Intl.Collator(locale);
  return Array.from(routes.values()).sort(
    (a, b) => b.count - a.count || collator.compare(a.label, b.label),
  );
}

/** One tile of the services row: a service, and the way to what offers it. */
export interface ServiceRoute {
  /** The row the list filters on — this deployment's id, not a stable name. */
  id: string;
  /** The taxonomy's name for the service: the only key code may look up by. */
  code: string;
  label: string;
  icon: string;
  /** How many published activities offer this service. */
  count: number;
  href: string;
}

/**
 * One tile per service actually offered, most-offered first.
 *
 * Services are the second axis of the same published set: a category says what
 * kind of help an activity is, a service says what a reader can do once they are
 * there. Both are read off the published activities for the same reason — a
 * service nobody offers is never shown, so no tile leads to an empty list
 * (AGENTS.md rule 5).
 */
export function serviceRoutes({
  activities,
  locale,
}: {
  activities: PublishedActivity[];
  locale: PublicLocale;
}): ServiceRoute[] {
  const routes = new Map<string, ServiceRoute>();
  for (const activity of activities) {
    // A service listed twice on one activity still counts once: the tile counts
    // places a reader can go, not rows in the join table.
    for (const service of new Map(
      activity.services.map((item) => [item.id, item]),
    ).values()) {
      const existing = routes.get(service.id);
      if (existing) {
        existing.count += 1;
        continue;
      }
      routes.set(service.id, {
        id: service.id,
        code: service.code,
        label: service.label,
        icon: service.icon,
        count: 1,
        href: localizedPath("/activities", locale, { service: service.id }),
      });
    }
  }

  const collator = new Intl.Collator(locale);
  return Array.from(routes.values()).sort(
    (a, b) => b.count - a.count || collator.compare(a.label, b.label),
  );
}

/** One association that publishes something, and the page that describes it. */
export interface AssociationRoute {
  slug: string;
  name: string;
  /** How many published activities this association provides. */
  count: number;
  /**
   * The kinds of help it publishes, in the reader's language — read off its own
   * activities, so it says what the association actually does rather than how it
   * describes itself. Empty while it publishes nothing categorised.
   */
  focus: string;
  /** Null where the association has no public profile page to open. */
  href: string | null;
}

/** Enough to say what an association does without becoming a second heading. */
const FOCUS_CATEGORIES = 3;

/**
 * The associations behind what is published, most-published first.
 *
 * Two conditions, and both matter. An association appears only if something it
 * provides is published — the list is evidence, not a directory of partners. And
 * it is only linked if its own profile page exists: `publishedSlugs` comes from
 * `listPublishedOrganizations`, whose conditions mirror the detail page down to
 * the verified translation it needs, so a named card can never open a 404. An
 * association with no page is still named, because it is still the answer to
 * "who is responsible for this" (docs/DESIGN-SYSTEM.md §5 — freshness and
 * ownership are content).
 */
export function associationRoutes({
  activities,
  locale,
  publishedSlugs,
}: {
  activities: PublishedActivity[];
  locale: PublicLocale;
  publishedSlugs: ReadonlySet<string>;
}): AssociationRoute[] {
  const routes = new Map<string, AssociationRoute>();
  // The kinds of help each association publishes, most-published first because
  // the activities arrive that way; a category is listed once however many
  // activities it covers.
  const categories = new Map<string, Set<string>>();
  for (const activity of activities) {
    for (const provider of new Map(
      activity.providers.map((item) => [item.slug, item]),
    ).values()) {
      const focus = categories.get(provider.slug) ?? new Set<string>();
      focus.add(activity.categoryLabel);
      categories.set(provider.slug, focus);

      const existing = routes.get(provider.slug);
      if (existing) {
        existing.count += 1;
        continue;
      }
      routes.set(provider.slug, {
        slug: provider.slug,
        name: provider.name,
        count: 1,
        focus: "",
        href: publishedSlugs.has(provider.slug)
          ? localizedPath(`/organizations/${provider.slug}`, locale)
          : null,
      });
    }
  }

  const collator = new Intl.Collator(locale);
  return Array.from(routes.values())
    .map((route) => ({
      ...route,
      focus: Array.from(categories.get(route.slug) ?? [])
        .slice(0, FOCUS_CATEGORIES)
        .join(" · "),
    }))
    .sort((a, b) => b.count - a.count || collator.compare(a.name, b.name));
}
