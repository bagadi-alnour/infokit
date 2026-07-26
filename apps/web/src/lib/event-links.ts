/**
 * The three things a reader wants to *do* with an event once they have read it:
 * find the place on a map, look up the organisation behind it, and put the date
 * in their own calendar. Both agendas — the console and the public site — build
 * these links here, so a link that is safe on one is safe on the other.
 */

/** What a map link needs to know, from either a linked place or a typed label. */
export interface EventPlaceFacts {
  placeName: string | null;
  placeAddressLine: string | null;
  placeLat: number | null;
  placeLng: number | null;
  /** null when the event has no linked place — only a written indication. */
  placePrecision: "exact" | "area_only" | "contact_to_learn" | null;
  locationLabel: string | null;
}

/**
 * A map link for the event's location, or null when there must not be one.
 *
 * A place published as `contact_to_learn` gets no map: RISKS.md R5 makes that a
 * decision of the organisation that provided it, and a search link would undo
 * it just as effectively as a pin. An `area_only` place gets the area's search,
 * never its coordinates.
 *
 * OpenStreetMap, not a commercial map: the reader has not asked to be logged by
 * anyone for the crime of finding out where the food distribution is.
 */
export function eventMapHref(
  event: EventPlaceFacts,
  cityName: string | null,
): string | null {
  if (event.placePrecision === "contact_to_learn") return null;
  if (
    event.placePrecision === "exact" &&
    event.placeLat !== null &&
    event.placeLng !== null
  ) {
    const lat = event.placeLat.toFixed(6);
    const lng = event.placeLng.toFixed(6);
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
  }
  // Everything else becomes a search for the words a reader would type anyway.
  const query = [
    event.placePrecision === null ? event.locationLabel : null,
    event.placeAddressLine,
    event.placeName,
    cityName,
  ]
    .filter((part): part is string => Boolean(part && part.trim() !== ""))
    .join(", ");
  if (query === "") return null;
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

/**
 * The download that adds the event to the reader's own calendar. Public events
 * resolve for anyone; the other tiers resolve only for someone the agenda
 * already shows them to — the route repeats that check itself.
 */
export function eventIcsHref(eventId: string, locale: string): string {
  return `/api/events/${eventId}/ics?locale=${encodeURIComponent(locale)}`;
}
