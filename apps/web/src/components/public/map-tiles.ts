/**
 * The one tile source both maps draw from — the list's overview and a single
 * activity's place — so changing provider is one edit rather than a hunt.
 *
 * OpenStreetMap is the choice because it needs no account, no key and no
 * tracker: a reader who opens a map here is not handed to anyone. The
 * attribution is not decoration but the licence — every caller passes Leaflet
 * the `activities.map.attribution` string that goes with these tiles.
 */
export const OSM_TILE_URL =
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

/** As far in as these tiles go; Leaflet clamps the zoom controls to it. */
export const OSM_MAX_ZOOM = 19;
