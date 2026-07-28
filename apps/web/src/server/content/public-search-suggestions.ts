/**
 * The index behind the home page's search box: everything published that a
 * reader might type the name of, in their language, with the page that answers
 * it already worked out.
 *
 * It is read off what is published rather than written by hand, so a suggestion
 * can never open an empty page (AGENTS.md rule 5), and it is built by the same
 * presenters the bands are built from — a need, a service and an association
 * suggest exactly what the tiles below them offer. The five headings reuse the
 * catalogue entries the content already has in all eleven languages, so the
 * popup needs nothing new translated (docs/UI-ARCHITECTURE.md §1: the server
 * settles every word).
 */
import type { PublicLocale } from "@infokit/shared/i18n";
import type { PageCatalog } from "@infokit/shared/i18n/catalogs";
import type { PublicActivitySummary } from "@infokit/shared/public-content";

import { localizedPath } from "~/i18n/routing";
import {
  suggestionHaystack,
  type SearchSuggestion,
  type SearchSuggestionGroup,
} from "~/lib/search-suggestions";
import {
  associationRoutes,
  basicInformationRoutes,
  serviceRoutes,
} from "~/server/content/public-basics-payload";
import type { PublishedActivity } from "~/server/content/public-content";

type Messages = PageCatalog<"public-content">;

/**
 * How many activities are suggestable by name.
 *
 * The whole index is delivered with the page so a keystroke costs nothing and
 * needs no network, which means its size is the reader's data. Needs, services,
 * places and associations are naturally few; activities are the one list that
 * grows without a bound, so it is cut here — and cut at the end, after the
 * presenter has ordered it, so what survives is what the list itself shows
 * first. Past that a name is still found: pressing Enter searches the whole
 * published set on the activity list, which is what the box does with no
 * suggestion chosen anyway.
 */
const ACTIVITIES_IN_THE_INDEX = 150;

/**
 * Everything the search box can suggest, grouped and ordered as the page reads:
 * the kinds of help first, then the services, then the activities themselves,
 * the places they happen at, and last the associations behind them.
 *
 * `summaries` is the same presenter output the cards are drawn from, so an
 * activity suggests under the name, place and services it is shown with.
 */
export function searchSuggestions({
  activities,
  summaries,
  locale,
  messages,
  publishedSlugs,
}: {
  activities: PublishedActivity[];
  summaries: PublicActivitySummary[];
  locale: PublicLocale;
  messages: Messages;
  publishedSlugs: ReadonlySet<string>;
}): SearchSuggestionGroup[] {
  const count = (howMany: number) =>
    messages["activities.results"].replace("{count}", String(howMany));

  const needs: SearchSuggestion[] = basicInformationRoutes({
    activities,
    locale,
  }).map((route) => ({
    id: `need:${route.code}`,
    kind: "need",
    label: route.label,
    hint: count(route.count),
    icon: route.icon,
    href: route.href,
    haystack: suggestionHaystack([route.label]),
  }));

  const services: SearchSuggestion[] = serviceRoutes({
    activities,
    locale,
  }).map((route) => ({
    id: `service:${route.id}`,
    kind: "service",
    label: route.label,
    hint: count(route.count),
    icon: route.icon,
    href: route.href,
    haystack: suggestionHaystack([route.label]),
  }));

  const named: SearchSuggestion[] = summaries
    .slice(0, ACTIVITIES_IN_THE_INDEX)
    .map((summary) => ({
      id: `activity:${summary.id}`,
      kind: "activity",
      label: summary.name,
      // Where it is, or failing that what kind of help it is: enough to tell two
      // activities with the same name apart.
      hint: summary.placeName || summary.categoryLabel,
      icon: summary.categoryIcon,
      href: summary.href,
      haystack: suggestionHaystack([
        summary.name,
        summary.placeName,
        summary.categoryLabel,
        ...summary.providerNames,
        ...summary.services.map((service) => service.label),
      ]),
    }));

  // A place is not a page of its own, so it opens the list with its name already
  // searched — the same words the reader would have typed. Each place is counted
  // once however many activities are held there, and the street is matchable
  // without being shown: readers type the road as often as the building.
  const places = new Map<string, { address: string; held: number }>();
  for (const summary of summaries) {
    const name = summary.placeName.trim();
    if (!name) continue;
    const existing = places.get(name);
    if (existing) {
      existing.held += 1;
      continue;
    }
    places.set(name, { address: summary.address, held: 1 });
  }
  const collator = new Intl.Collator(locale);
  const located: SearchSuggestion[] = Array.from(places, ([name, place]) => ({
    id: `place:${name}`,
    kind: "place" as const,
    label: name,
    hint: count(place.held),
    icon: null,
    href: localizedPath("/activities", locale, { q: name }),
    haystack: suggestionHaystack([name, place.address]),
  })).sort((a, b) => collator.compare(a.label, b.label));

  const organizations: SearchSuggestion[] = associationRoutes({
    activities,
    locale,
    publishedSlugs,
  }).map((route) => ({
    id: `organization:${route.slug}`,
    kind: "organization",
    label: route.name,
    hint: route.focus || count(route.count),
    icon: null,
    // An association without a profile page is still an answer: its name opens
    // what it publishes rather than a page that does not exist.
    href: route.href ?? localizedPath("/activities", locale, { q: route.name }),
    haystack: suggestionHaystack([route.name, route.focus]),
  }));

  return (
    [
      {
        kind: "need",
        label: messages["activities.filter.category"],
        items: needs,
      },
      {
        kind: "service",
        label: messages["activities.services"],
        items: services,
      },
      {
        kind: "activity",
        label: messages["public.nav.activities"],
        items: named,
      },
      { kind: "place", label: messages["activities.place"], items: located },
      {
        kind: "organization",
        label: messages["organization.eyebrow"],
        items: organizations,
      },
    ] satisfies SearchSuggestionGroup[]
  ).filter((group) => group.items.length > 0);
}
