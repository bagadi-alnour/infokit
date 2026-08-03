"use client";

// Leaflet's stylesheet belongs to the map, not to the site. Imported by the
// root layout it was a render-blocking request on every page — the home page,
// every article — none of which draw a map.
import "leaflet/dist/leaflet.css";

import type { PublicActivitySummary } from "@infokit/shared/public-content";
import type { CircleMarker, Map as LeafletMap } from "leaflet";
import { Contrast, Layers3, LocateFixed, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  ESRI_IMAGERY_TILE_URL,
  ESRI_LABEL_TILE_URL,
  OSM_MAX_ZOOM,
  OSM_TILE_URL,
} from "~/components/public/map-tiles";
import {
  ActionButton,
  Callout,
  SurfaceCard,
} from "~/components/public/primitives";
import { useThemePreference } from "~/components/theme/theme-provider";

export interface ActivityMapLabels {
  useLocation: string;
  locating: string;
  locationPrivacy: string;
  locationFound: string;
  locationDenied: string;
  locationUnavailable: string;
  locationError: string;
  yourLocation: string;
  mapAttribution: string;
  hybridAttribution: string;
  mapTitle: string;
  mapHint: string;
  noMap: string;
  styleLabel: string;
  styleMuted: string;
  styleHybrid: string;
}

type MapStyle = "muted" | "hybrid";

// Fallback view centred on Calais when no activity has coordinates.
const CALAIS_CENTER: [number, number] = [50.9513, 1.8587];
const CALAIS_ZOOM = 13;

/**
 * Low-data map: Leaflet is imported only when this view is shown, and the list
 * remains the primary way to read the same activities. Geolocation is opt-in
 * and never leaves the browser (docs/DESIGN-SYSTEM.md §1 — the map is an aid,
 * never the only route to an answer).
 */
export function ActivityLeafletMap({
  activities,
  labels,
}: {
  activities: PublicActivitySummary[];
  labels: ActivityMapLabels;
}) {
  const { resolved: colorScheme } = useThemePreference();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const locationMarkerRef = useRef<CircleMarker | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("muted");
  const [locationState, setLocationState] = useState<
    "idle" | "locating" | "found" | "denied" | "unavailable" | "error"
  >("idle");
  const mapped = useMemo(
    () =>
      activities.filter(
        (
          activity,
        ): activity is PublicActivitySummary & {
          latitude: number;
          longitude: number;
        } => activity.latitude !== null && activity.longitude !== null,
      ),
    [activities],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let map: LeafletMap | null = null;

    void import("leaflet").then((leaflet) => {
      if (disposed || !containerRef.current) return;
      const first = mapped[0];
      const createdMap = leaflet
        .map(containerRef.current, {
          scrollWheelZoom: false,
          zoomControl: true,
        })
        .setView(
          first ? [first.latitude, first.longitude] : CALAIS_CENTER,
          first ? CALAIS_ZOOM : 12,
        );
      map = createdMap;
      mapRef.current = createdMap;
      const theme = getComputedStyle(document.documentElement);
      const accent = theme.getPropertyValue("--infokit-accent").trim();
      const surface = theme.getPropertyValue("--infokit-surface").trim();
      if (mapStyle === "muted") {
        leaflet
          .tileLayer(OSM_TILE_URL, {
            maxZoom: OSM_MAX_ZOOM,
            attribution: labels.mapAttribution,
            className: "infokit-soft-plan-tiles",
          })
          .addTo(createdMap);
      } else {
        leaflet
          .tileLayer(ESRI_IMAGERY_TILE_URL, {
            maxZoom: OSM_MAX_ZOOM,
            attribution: labels.hybridAttribution,
            className: "infokit-satellite-tiles",
          })
          .addTo(createdMap);
        leaflet
          .tileLayer(ESRI_LABEL_TILE_URL, {
            maxZoom: OSM_MAX_ZOOM,
            className: "infokit-hybrid-label-tiles",
          })
          .addTo(createdMap);
      }

      const points = mapped.map((activity) => {
        const popup = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = activity.name;
        const place = document.createElement("p");
        place.textContent = [activity.placeName, activity.address]
          .filter(Boolean)
          .join(" · ");
        const link = document.createElement("a");
        link.href = activity.href;
        link.textContent = activity.name;
        popup.append(title, place, link);
        leaflet
          .circleMarker([activity.latitude, activity.longitude], {
            radius: 9,
            weight: 3,
            color: accent,
            fillColor: surface,
            fillOpacity: 1,
          })
          .bindPopup(popup)
          .addTo(createdMap);
        return leaflet.latLng(activity.latitude, activity.longitude);
      });
      if (points.length > 1) {
        createdMap.fitBounds(leaflet.latLngBounds(points), {
          padding: [36, 36],
        });
      }
    });

    return () => {
      disposed = true;
      locationMarkerRef.current = null;
      mapRef.current = null;
      map?.remove();
    };
  }, [
    colorScheme,
    labels.hybridAttribution,
    labels.mapAttribution,
    mapped,
    mapStyle,
  ]);

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setLocationState("unavailable");
      return;
    }
    setLocationState("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const map = mapRef.current;
        if (!map) {
          setLocationState("error");
          return;
        }
        void import("leaflet").then((leaflet) => {
          const theme = getComputedStyle(document.documentElement);
          locationMarkerRef.current?.remove();
          locationMarkerRef.current = leaflet
            .circleMarker(
              [position.coords.latitude, position.coords.longitude],
              {
                radius: 10,
                weight: 4,
                color: theme.getPropertyValue("--infokit-success").trim(),
                fillColor: theme.getPropertyValue("--infokit-surface").trim(),
                fillOpacity: 1,
              },
            )
            .bindTooltip(labels.yourLocation)
            .addTo(map);
          const allPoints = [
            leaflet.latLng(position.coords.latitude, position.coords.longitude),
            ...mapped.map((activity) =>
              leaflet.latLng(activity.latitude, activity.longitude),
            ),
          ];
          map.fitBounds(leaflet.latLngBounds(allPoints), {
            padding: [36, 36],
            maxZoom: 15,
          });
          setLocationState("found");
        });
      },
      (error) => {
        setLocationState(
          error.code === error.PERMISSION_DENIED ? "denied" : "error",
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 5 * 60 * 1000,
      },
    );
  }

  const status =
    locationState === "found"
      ? labels.locationFound
      : locationState === "denied"
        ? labels.locationDenied
        : locationState === "unavailable"
          ? labels.locationUnavailable
          : locationState === "error"
            ? labels.locationError
            : "";
  const statusTone = locationState === "found" ? "info" : "warning";

  return (
    <div className="flex flex-col gap-4">
      <SurfaceCard className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-ink text-base font-bold">
            {labels.mapTitle}
          </h2>
          <ActionButton
            tone="outline"
            size="compact"
            disabled={locationState === "locating"}
            onClick={requestLocation}
          >
            <LocateFixed className="size-4" aria-hidden />
            {locationState === "locating"
              ? labels.locating
              : labels.useLocation}
          </ActionButton>
        </div>
        <p className="text-copy-muted text-sm leading-relaxed">
          {labels.mapHint}
        </p>
        <p className="text-copy-muted text-sm leading-relaxed">
          {labels.locationPrivacy}
        </p>
        <div
          role="group"
          aria-label={labels.styleLabel}
          className="border-line bg-subtle rounded-control flex max-w-full flex-wrap gap-1 border p-1"
        >
          <MapStyleButton
            active={mapStyle === "muted"}
            label={labels.styleMuted}
            icon={<Contrast className="size-4" aria-hidden />}
            onClick={() => {
              setMapStyle("muted");
            }}
          />
          <MapStyleButton
            active={mapStyle === "hybrid"}
            label={labels.styleHybrid}
            icon={<Layers3 className="size-4" aria-hidden />}
            onClick={() => {
              setMapStyle("hybrid");
            }}
          />
        </div>
        {status ? (
          <Callout tone={statusTone} role="status" className="p-3 text-sm">
            {status}
          </Callout>
        ) : null}
      </SurfaceCard>

      {mapped.length === 0 ? (
        <SurfaceCard className="text-copy-muted flex flex-col items-center gap-3 p-10 text-center">
          <MapPin className="size-6" aria-hidden />
          <p className="text-base">{labels.noMap}</p>
        </SurfaceCard>
      ) : (
        <div
          ref={containerRef}
          role="application"
          aria-label={labels.mapTitle}
          className="infokit-map border-line bg-surface rounded-card shadow-ring h-[440px] w-full overflow-hidden border"
        />
      )}
    </div>
  );
}

function MapStyleButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <ActionButton
      tone={active ? "soft" : "quiet"}
      size="compact"
      aria-pressed={active}
      onClick={onClick}
      className="min-w-fit px-3"
    >
      {icon}
      {label}
    </ActionButton>
  );
}
