"use client";

// Leaflet's stylesheet belongs to the map, not to the site: this module is
// imported by the single activity page only, so the home page and the shelves
// never pay for a stylesheet they draw nothing with.
import "leaflet/dist/leaflet.css";

import type { Map as LeafletMap } from "leaflet";
import { ExternalLink, MapPin } from "lucide-react";
import { useEffect, useRef } from "react";

import { OSM_MAX_ZOOM, OSM_TILE_URL } from "~/components/public/map-tiles";
import { ActionAnchor, SurfaceCard } from "~/components/public/primitives";

export interface ActivityLocationLabels {
  /** Heading of the section — the same word the detail rows use. */
  place: string;
  /** Accessible name of the map itself. */
  mapTitle: string;
  openInGoogleMaps: string;
  mapAttribution: string;
}

/** A street rather than a city: one place is being shown, not compared. */
const PLACE_ZOOM = 16;

/**
 * Where this one activity is. The map answers the question the address alone
 * leaves open — "is that near me?" — which a reader would otherwise have to
 * leave the page to ask.
 *
 * It is drawn, not linked: the tiles are OpenStreetMap's, loaded only on this
 * page, and the address above it says the same thing in words, so a reader on a
 * connection that never delivers a tile has lost nothing (docs/DESIGN-SYSTEM.md
 * §1 — images are the third thing to drop, and the answer survives without
 * them). Under it is the one route onward: the place in the maps app the phone
 * already has, which is where directions actually come from.
 */
export function ActivityLocationCard({
  placeName,
  address,
  latitude,
  longitude,
  googleMapsHref,
  labels,
}: {
  placeName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  /** Prepared by the server, null when the place is an area only. */
  googleMapsHref: string | null;
  labels: ActivityLocationLabels;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const exact = latitude !== null && longitude !== null;

  useEffect(() => {
    if (latitude === null || longitude === null) return;
    if (!containerRef.current) return;
    let disposed = false;
    let map: LeafletMap | null = null;

    void import("leaflet").then((leaflet) => {
      if (disposed || !containerRef.current) return;
      const created = leaflet
        .map(containerRef.current, {
          // The page scrolls past this map on a phone; a wheel or a thumb over
          // it must not swallow that scroll to zoom instead.
          scrollWheelZoom: false,
          zoomControl: true,
        })
        .setView([latitude, longitude], PLACE_ZOOM);
      map = created;
      leaflet
        .tileLayer(OSM_TILE_URL, {
          maxZoom: OSM_MAX_ZOOM,
          attribution: labels.mapAttribution,
        })
        .addTo(created);
      // The pin wears the tokens rather than a colour of its own (§2 rule 9),
      // read at draw time so it follows the theme the reader is in.
      const theme = getComputedStyle(document.documentElement);
      leaflet
        .circleMarker([latitude, longitude], {
          radius: 9,
          weight: 3,
          color: theme.getPropertyValue("--infokit-accent").trim(),
          fillColor: theme.getPropertyValue("--infokit-surface").trim(),
          fillOpacity: 1,
        })
        .addTo(created);
    });

    return () => {
      disposed = true;
      map?.remove();
    };
  }, [latitude, longitude, labels.mapAttribution]);

  // Nothing to draw and nowhere to send anyone: an area-only place has already
  // said so in the rows above, and a frame around that would add nothing.
  if (!exact && !googleMapsHref) return null;

  const where = address || placeName;

  return (
    <SurfaceCard className="flex flex-col overflow-hidden">
      <div className="flex flex-col gap-1 p-5">
        <h2 className="text-copy-muted text-xs font-bold uppercase tracking-[0.08em]">
          {labels.place}
        </h2>
        {where ? (
          <p className="text-ink text-[0.95rem] leading-snug">{where}</p>
        ) : null}
      </div>
      {/* A printed sheet gets the address above and no tiles: a screenshot of a
          map at one zoom is not directions, and it costs a page of ink. */}
      {exact ? (
        <div
          ref={containerRef}
          role="application"
          aria-label={labels.mapTitle}
          className="border-line bg-subtle h-56 w-full border-y print:hidden"
        />
      ) : null}
      {googleMapsHref ? (
        <div className="p-5 print:hidden">
          <ActionAnchor
            href={googleMapsHref}
            target="_blank"
            rel="noreferrer"
            tone="outline"
            size="block"
          >
            <MapPin className="size-5" aria-hidden />
            {labels.openInGoogleMaps}
            <ExternalLink className="size-4" aria-hidden />
          </ActionAnchor>
        </div>
      ) : null}
    </SurfaceCard>
  );
}
