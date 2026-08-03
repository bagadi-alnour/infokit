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
import type { PublicLocale } from "@infokit/shared/i18n";
import type { PageCatalog } from "@infokit/shared/i18n/catalogs";

import { localizedPath } from "~/i18n/routing";
import type {
  PublishedActivity,
  PublishedBasicInformation,
} from "~/server/content/public-content";

type Messages = PageCatalog<"public-content">;

/**
 * Both blocks are read from `content.basic_information_details` now, not from a
 * hardcoded table.
 *
 * What that buys is the whole point of the product: every number arrives with a
 * custodian, a source, a review date and a revision history, so a reader can be
 * told how old it is and an editor can correct it without a deploy. The words
 * come with it — they are editorial translations, not interface strings — which
 * is why nothing here looks a label up in the catalogue any more.
 *
 * What still comes from the catalogue is the chrome around the number: "Call
 * 112" and "Text 114" are how the interface describes pressing a card, and they
 * are the same sentence whatever the card says.
 */

/** How a tile is pressed, given what it says and what it is about. */
function dialHref(tile: PublishedBasicInformation): string | null {
  // The number actually pressed is `dialInstead` where one is set — the
  // sea-rescue card prints an association's number and dials 112.
  const pressed = tile.dialInstead ?? tile.dial;
  if (!pressed) return null;
  // Spaces are for reading, not for dialling.
  const digits = pressed.replace(/\s/g, "");
  return tile.reach === "sms" ? `sms:${digits}` : `tel:${digits}`;
}

/** "Call 112" or "Text 114", already carrying the digits a reader will press. */
function dialAction(
  tile: PublishedBasicInformation,
  messages: Messages,
): string {
  const shown = tile.dial ?? "";
  return (
    tile.reach === "sms" ? messages["basics.sms"] : messages["basics.call"]
  ).replace("{number}", shown);
}

/**
 * How much weight a card's words carry, said on the card itself.
 *
 * A grey line at the bottom of the block saying "these are not confirmed yet"
 * asks a reader in trouble to hold a caveat in their head while they scan five
 * cards, and they will not: the caveat has to be *on* the card it qualifies.
 * Three states, and each is read off a fact rather than a judgement:
 *
 * - `official` — the number is the country's, from `operator`. 112 is 112.
 * - `confirmed` — an association line whose record the association itself now
 *   holds (`custodian`), so what the card says is theirs to say.
 * - `unconfirmed` — an association line the platform copied from a printed guide
 *   and nobody at the other end has taken on yet. Today that is all three of
 *   them, and saying so is the point.
 */
export type BasicConfirmation = "official" | "confirmed" | "unconfirmed";

export interface BasicConfirmationBadge {
  kind: BasicConfirmation;
  label: string;
}

function confirmation(tile: PublishedBasicInformation): BasicConfirmation {
  if (tile.operator === "state") return "official";
  return tile.custodian === "organization" ? "confirmed" : "unconfirmed";
}

function confirmationBadge(
  tile: PublishedBasicInformation,
  messages: Messages,
): BasicConfirmationBadge {
  const kind = confirmation(tile);
  const label =
    kind === "official"
      ? messages["basics.badge.official"]
      : kind === "confirmed"
        ? messages["basics.badge.confirmed"]
        : messages["basics.badge.unconfirmed"];
  return { kind, label };
}

/** One association-run line, as published. */
export interface HelpLineContact {
  /** The entry's slug: stable, and the only key a surface may match on. */
  code: string;
  dial: string;
  icon: string;
  label: string;
  hint: string;
  action: string;
  href: string;
  /** True where the same number is also reachable on WhatsApp. */
  whatsapp: boolean;
  /** The association whose phone rings, where one is named. */
  answeredBy: string | null;
  /** Whether the association behind this line has stood behind it yet. */
  confirmation: BasicConfirmationBadge;
}

/**
 * The association-run lines: every published tile whose `operator` says an
 * association answers it.
 *
 * The block's heading tells a reader these are *not* the State's, which is a
 * claim about the number, so it is read from the column that records exactly
 * that rather than inferred from whether an organisation happens to be linked —
 * Alarm Phone is a transnational network with no record here and would be
 * mis-filed by any such guess (`~/server/db/schema/schemas`).
 *
 * A tile with no number to press is skipped: this block is a list of phones.
 */
export function helpLineContacts(
  basics: PublishedBasicInformation[],
  messages: Messages,
): HelpLineContact[] {
  return basics.flatMap((tile) => {
    if (tile.operator !== "association" || !tile.dial) return [];
    const href = dialHref(tile);
    if (!href) return [];
    return [
      {
        code: tile.slug,
        dial: tile.dial,
        icon: tile.icon,
        label: tile.title,
        hint: tile.summary ?? "",
        action: dialAction(tile, messages),
        href,
        whatsapp: tile.reach === "whatsapp",
        answeredBy: tile.answeredBy,
        confirmation: confirmationBadge(tile, messages),
      },
    ];
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
  /**
   * Present on a published number, absent on the water card: that one opens a
   * filter on activities rather than making a claim about a phone line, and a
   * badge there would be a claim about nothing.
   */
  confirmation?: BasicConfirmationBadge;
}

/**
 * The last card is water and washing: the need that is counted in hours rather
 * than days, and the one thing the numbers before it cannot answer.
 *
 * Water leads, and showers stand in for it where a city publishes washing but no
 * water point — the list takes one service filter, so the card names both and
 * opens the first of them that anything published offers.
 */
const WATER_SERVICE_CODES = ["drinking_water", "showers_hygiene"];

/**
 * The shortest routes on the page: every published state number, in the order an
 * editor put them in, and then the way to water and a shower.
 *
 * Which numbers appear is now an editorial decision rather than a constant in
 * this file — publishing a tile adds a card, unpublishing removes it, and
 * `priority` is the order they are read in. That is the whole reason the block
 * moved into the database: the numbers a city puts first are a local judgement,
 * and it should not take a deploy to change one.
 *
 * The association lines are deliberately not here. They are drawn below the row
 * under a heading that says they are volunteer-run — a distinction that matters
 * when somebody is deciding who to call, and one this row would erase by mixing
 * them in with the numbers the State answers.
 *
 * The row still states no fact of its own: the numbers are the tiles' and the
 * water card opens a filter on what is published, so it disappears where nothing
 * offers water or washing (AGENTS.md rule 5: never route a reader to an empty
 * page).
 */
export function urgentRoutes({
  basics,
  activities,
  locale,
  messages,
}: {
  basics: PublishedBasicInformation[];
  activities: PublishedActivity[];
  locale: PublicLocale;
  messages: Messages;
}): UrgentRoute[] {
  const routes: UrgentRoute[] = [];
  for (const tile of basics) {
    if (tile.operator !== "state") continue;
    const href = dialHref(tile);
    if (!href) continue;
    routes.push({
      code: tile.slug,
      icon: tile.icon,
      // The digits belong in the title, because the card *is* the instruction:
      // "Call 112" reads as something to do, where the label alone does not.
      title: dialAction(tile, messages),
      hint: tile.summary ?? "",
      href,
      // One red on the row. A second would make neither of them the loudest
      // thing on the page (DESIGN-SYSTEM.md §5), which is why at most one tile
      // may carry `emergency`.
      danger: tile.emergency,
      confirmation: confirmationBadge(tile, messages),
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
