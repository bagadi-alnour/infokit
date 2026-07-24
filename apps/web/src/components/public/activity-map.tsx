"use client";

import { type PublicActivitySummary } from "@calais/ui";
import type { CircleMarker, Map as LeafletMap } from "leaflet";
import { ListFilter, MapPin, Rows3, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { TaxonomyIcon } from "~/components/taxonomy-icon";
import { cn } from "~/lib/utils";

export interface PublicActivityLabels {
  search: string;
  categoryFilter: string;
  allCategories: string;
  audienceFilter: string;
  allAudiences: string;
  serviceFilter: string;
  allServices: string;
  statusFilter: string;
  allStatuses: string;
  filters: string;
  clearAll: string;
  listView: string;
  mapView: string;
  results: string;
  empty: string;
  provider: string;
  services: string;
  place: string;
  schedule: string;
  lastVerified: string;
  fallback: string;
  open: string;
  mapTitle: string;
  mapHint: string;
  noMap: string;
  statusOpen: string;
  statusClosed: string;
  statusCancelled: string;
  statusUncertain: string;
}

interface LocationLabels {
  useLocation: string;
  locating: string;
  locationPrivacy: string;
  locationFound: string;
  locationDenied: string;
  locationUnavailable: string;
  locationError: string;
  yourLocation: string;
  mapAttribution: string;
}

type StatusKey = PublicActivitySummary["status"];

const STATUS_STYLES: Record<StatusKey, { badge: string; dot: string }> = {
  open: { badge: "bg-ok-soft text-ok", dot: "bg-ok" },
  closed: { badge: "bg-neutral-soft text-copy-muted", dot: "bg-copy-muted" },
  cancelled: { badge: "bg-danger-soft text-danger", dot: "bg-danger" },
  uncertain: { badge: "bg-warn-soft text-warn", dot: "bg-warn" },
};

function statusLabel(status: StatusKey, labels: PublicActivityLabels) {
  switch (status) {
    case "cancelled":
      return labels.statusCancelled;
    case "uncertain":
      return labels.statusUncertain;
    case "open":
      return labels.statusOpen;
    default:
      return labels.statusClosed;
  }
}

function StatusBadge({
  status,
  labels,
}: {
  status: StatusKey;
  labels: PublicActivityLabels;
}) {
  const style = STATUS_STYLES[status];
  return (
    <Badge
      className={cn(
        "gap-1.5 border-transparent px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide",
        style.badge,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      {statusLabel(status, labels)}
    </Badge>
  );
}

interface FilterOption {
  value: string;
  label: string;
  icon?: string;
  dot?: string;
}

function OptionContent({ option }: { option: FilterOption }) {
  return (
    <span className="flex items-center gap-2">
      {option.dot ? (
        <span className={cn("size-2 rounded-full", option.dot)} aria-hidden />
      ) : null}
      {option.icon ? <TaxonomyIcon name={option.icon} size={15} /> : null}
      {option.label}
    </span>
  );
}

function FilterSelect({
  title,
  value,
  onValueChange,
  allLabel,
  options,
}: {
  title: string;
  value: string;
  onValueChange: (value: string) => void;
  allLabel: string;
  options: FilterOption[];
}) {
  const selected = options.find((option) => option.value === value);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-copy-muted text-xs font-bold uppercase tracking-[0.08em]">
        {title}
      </p>
      <Select
        value={value}
        onValueChange={(next) => {
          onValueChange(typeof next === "string" ? next : "");
        }}
      >
        <SelectTrigger className="bg-subtle h-11 w-full">
          <SelectValue>
            {selected ? <OptionContent option={selected} /> : allLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <OptionContent option={option} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MetaRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <dt className="text-copy-muted w-24 shrink-0 pt-0.5 text-[0.7rem] font-bold uppercase tracking-wide">
        {label}
      </dt>
      <dd className="text-ink flex-1 text-sm leading-snug">
        {children ?? value}
      </dd>
    </div>
  );
}

const metaLinkClass =
  "text-brand font-medium underline-offset-2 hover:underline focus-visible:ring-ring/50 rounded focus-visible:outline-none focus-visible:ring-2";

function ServiceBadge({ label, icon }: { label: string; icon: string }) {
  return (
    <span className="border-line bg-subtle text-ink inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
      <TaxonomyIcon name={icon} size={15} className="text-brand" />
      {label}
    </span>
  );
}

function ActivityCard({
  activity,
  labels,
  detail = false,
}: {
  activity: PublicActivitySummary & {
    description?: string;
    instructions?: string;
    audienceLabel?: string;
  };
  labels: PublicActivityLabels & { audience?: string; instructions?: string };
  /** Single-activity page: show full description/instructions, no self-link. */
  detail?: boolean;
}) {
  const closed = activity.status === "closed";
  return (
    <Card className="hover:ring-brand/40 transition-shadow hover:shadow-md">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {closed ? (
            activity.nextOpeningLabel ? (
              <span className="bg-danger-soft text-danger ms-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide">
                <span className="bg-danger size-1.5 rounded-full" aria-hidden />
                {activity.nextOpeningLabel}
              </span>
            ) : (
              <StatusBadge status={activity.status} labels={labels} />
            )
          ) : (
            <>
              <Badge className="bg-brand-soft text-brand gap-1.5 border-transparent px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide">
                <TaxonomyIcon name={activity.categoryIcon} size={14} />
                {activity.categoryLabel}
              </Badge>
              <StatusBadge status={activity.status} labels={labels} />
            </>
          )}
        </div>
        <div className="flex gap-4">
          {activity.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activity.coverImage.url}
              alt={
                activity.coverImage.decorative ? "" : activity.coverImage.alt
              }
              className="bg-subtle size-32 shrink-0 rounded-xl object-cover"
            />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <CardTitle className="text-lg leading-snug">
              {activity.name}
            </CardTitle>
            <dl className="flex flex-col gap-2.5">
              <MetaRow label={labels.provider}>
                {activity.providers.length > 0
                  ? activity.providers.map((provider, index) => (
                      <span key={provider.href}>
                        {index > 0 ? ", " : null}
                        <a href={provider.href} className={metaLinkClass}>
                          {provider.name}
                        </a>
                      </span>
                    ))
                  : activity.providerNames.join(", ")}
              </MetaRow>
              <MetaRow label={labels.place}>
                {activity.mapHref ? (
                  <a
                    href={activity.mapHref}
                    target="_blank"
                    rel="noreferrer"
                    className={metaLinkClass}
                  >
                    {activity.address || activity.placeName}
                  </a>
                ) : (
                  activity.address || activity.placeName
                )}
              </MetaRow>
              <MetaRow
                label={labels.schedule}
                value={activity.scheduleLabels.join(" · ")}
              />
              <MetaRow
                label={labels.lastVerified}
                value={activity.lastVerifiedLabel}
              />
            </dl>
          </div>
        </div>
      </CardHeader>
      <CardContent className="mt-4 flex flex-col gap-4">
        {detail && activity.description ? (
          <p className="text-ink whitespace-pre-wrap text-sm leading-relaxed">
            {activity.description}
          </p>
        ) : null}
        {activity.services.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-copy-muted text-[0.7rem] font-bold uppercase tracking-wide">
              {labels.services}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activity.services.map((service) => (
                <ServiceBadge
                  key={service.id}
                  label={service.label}
                  icon={service.icon}
                />
              ))}
            </div>
          </div>
        ) : null}
        {detail && activity.instructions ? (
          <div className="flex flex-col gap-2">
            <p className="text-copy-muted text-[0.7rem] font-bold uppercase tracking-wide">
              {labels.instructions}
            </p>
            <p className="text-ink whitespace-pre-wrap text-sm leading-relaxed">
              {activity.instructions}
            </p>
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="mt-4 flex-col items-stretch gap-3">
        {detail ? null : (
          <a
            href={activity.href}
            className={cn(buttonVariants({ size: "sm" }), "w-fit")}
          >
            {labels.open}
          </a>
        )}
        {activity.fallbackUsed ? (
          <p className="bg-brand-soft text-brand rounded-md px-2.5 py-1 text-xs font-semibold">
            {activity.fallbackLabel}
          </p>
        ) : null}
      </CardFooter>
    </Card>
  );
}

/** Single-activity page: the same card, expanded with description + guidance. */
export function PublicActivityCardDetail({
  activity,
  labels,
}: {
  activity: PublicActivitySummary & {
    description?: string;
    instructions?: string;
    audienceLabel?: string;
  };
  labels: PublicActivityLabels & { audience?: string; instructions?: string };
}) {
  return <ActivityCard activity={activity} labels={labels} detail />;
}

export function PublicActivitiesWebExplorer({
  activities,
  labels,
  locationLabels,
}: {
  activities: PublicActivitySummary[];
  labels: PublicActivityLabels;
  locationLabels: LocationLabels;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [audience, setAudience] = useState("");
  const [service, setService] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const categories = useMemo(
    () =>
      Array.from(
        new Map(
          activities.map((activity) => [
            activity.categoryCode,
            activity.categoryLabel,
          ]),
        ),
      ),
    [activities],
  );
  const audiences = useMemo(
    () =>
      Array.from(
        new Map(
          activities.map((activity) => [
            activity.audienceCode,
            activity.audienceLabel,
          ]),
        ),
      ),
    [activities],
  );
  const services = useMemo(
    () =>
      Array.from(
        new Map(
          activities.flatMap((activity) =>
            activity.services.map(
              (item) =>
                [item.id, { label: item.label, icon: item.icon }] as const,
            ),
          ),
        ),
      ),
    [activities],
  );
  const statuses = [
    ["open", labels.statusOpen, "bg-ok"],
    ["closed", labels.statusClosed, "bg-copy-muted"],
    ["cancelled", labels.statusCancelled, "bg-danger"],
    ["uncertain", labels.statusUncertain, "bg-warn"],
  ] as const;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return activities.filter((activity) => {
      const searchable = [
        activity.name,
        activity.shortDescription,
        activity.categoryLabel,
        activity.audienceLabel,
        activity.placeName,
        activity.address,
        ...activity.services.map((item) => item.label),
        ...activity.providerNames,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!category || activity.categoryCode === category) &&
        (!audience || activity.audienceCode === audience) &&
        (!service || activity.services.some((item) => item.id === service)) &&
        (!status || activity.status === status) &&
        (!normalized || searchable.includes(normalized))
      );
    });
  }, [activities, audience, category, query, service, status]);

  const activeCount =
    (query.trim() ? 1 : 0) +
    (category ? 1 : 0) +
    (audience ? 1 : 0) +
    (service ? 1 : 0) +
    (status ? 1 : 0);

  function clearAll() {
    setQuery("");
    setCategory("");
    setAudience("");
    setService("");
    setStatus("");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink text-sm font-semibold">
          {labels.results.replace("{count}", String(filtered.length))}
        </p>
        <div className="border-line bg-subtle inline-flex gap-1 rounded-full border p-1">
          <ViewToggleButton
            active={view === "list"}
            onClick={() => {
              setView("list");
            }}
            icon={<Rows3 className="size-4" />}
            label={labels.listView}
          />
          <ViewToggleButton
            active={view === "map"}
            onClick={() => {
              setView("map");
            }}
            icon={<MapPin className="size-4" />}
            label={labels.mapView}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Mobile filter toggle */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full justify-between lg:hidden"
          onClick={() => {
            setFiltersOpen((open) => !open);
          }}
          aria-expanded={filtersOpen}
        >
          <span className="flex items-center gap-2">
            <ListFilter className="size-4" />
            {labels.filters}
            {activeCount > 0 ? (
              <span className="bg-brand inline-flex size-5 items-center justify-center rounded-full text-xs font-bold text-white">
                {activeCount}
              </span>
            ) : null}
          </span>
        </Button>

        <aside
          className={cn(
            "lg:sticky lg:top-6 lg:block",
            filtersOpen ? "block" : "hidden",
          )}
        >
          <div className="border-line bg-surface flex flex-col gap-5 rounded-2xl border p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-ink text-base font-bold">
                  {labels.filters}
                </h2>
                {activeCount > 0 ? (
                  <span className="bg-brand inline-flex size-5 items-center justify-center rounded-full text-xs font-bold text-white">
                    {activeCount}
                  </span>
                ) : null}
              </div>
              {activeCount > 0 ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-brand focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded text-sm font-semibold hover:opacity-70 focus-visible:outline-none focus-visible:ring-2"
                >
                  <X className="size-3.5" />
                  {labels.clearAll}
                </button>
              ) : null}
            </div>

            <div className="relative">
              <Search className="text-copy-muted pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder={labels.search}
                aria-label={labels.search}
                className="bg-subtle h-11 ps-8"
              />
            </div>

            <Separator />

            <FilterSelect
              title={labels.categoryFilter}
              value={category}
              onValueChange={setCategory}
              allLabel={labels.allCategories}
              options={categories.map(([code, label]) => ({
                value: code,
                label,
              }))}
            />

            <FilterSelect
              title={labels.audienceFilter}
              value={audience}
              onValueChange={setAudience}
              allLabel={labels.allAudiences}
              options={audiences.map(([code, label]) => ({
                value: code,
                label,
              }))}
            />

            <FilterSelect
              title={labels.serviceFilter}
              value={service}
              onValueChange={setService}
              allLabel={labels.allServices}
              options={services.map(([id, meta]) => ({
                value: id,
                label: meta.label,
                icon: meta.icon,
              }))}
            />

            <FilterSelect
              title={labels.statusFilter}
              value={status}
              onValueChange={setStatus}
              allLabel={labels.allStatuses}
              options={statuses.map(([value, label, dot]) => ({
                value,
                label,
                dot,
              }))}
            />
          </div>
        </aside>

        <section className="flex min-w-0 flex-col gap-4">
          {view === "map" ? (
            <ActivityLeafletMap activities={filtered} labels={locationLabels} />
          ) : filtered.length === 0 ? (
            <div className="border-line bg-surface text-copy-muted flex items-center justify-center rounded-2xl border py-16 text-center">
              {labels.empty}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filtered.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  labels={labels}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ViewToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "focus-visible:ring-ring/50 inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2",
        active
          ? "border-line bg-surface text-brand border shadow-sm"
          : "text-copy-muted hover:text-brand border border-transparent",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// Fallback view centred on Calais when no activity has coordinates.
const CALAIS_CENTER: [number, number] = [50.9513, 1.8587];
const CALAIS_ZOOM = 13;

function ActivityLeafletMap({
  activities,
  labels,
}: {
  activities: PublicActivitySummary[];
  labels: LocationLabels;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const locationMarkerRef = useRef<CircleMarker | null>(null);
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
      const accent = theme.getPropertyValue("--calais-accent").trim();
      const surface = theme.getPropertyValue("--calais-surface").trim();
      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: labels.mapAttribution,
        })
        .addTo(createdMap);

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
  }, [labels.mapAttribution, mapped]);

  function requestLocation() {
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
                color: theme.getPropertyValue("--calais-success").trim(),
                fillColor: theme.getPropertyValue("--calais-surface").trim(),
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

  return (
    <div className="flex flex-col gap-3">
      <div className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-4">
        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={locationState === "locating"}
          onClick={requestLocation}
        >
          <MapPin className="size-4" />
          {locationState === "locating" ? labels.locating : labels.useLocation}
        </Button>
        <p className="text-copy-muted text-sm">{labels.locationPrivacy}</p>
        {status ? (
          <p role="status" className="text-brand text-sm font-semibold">
            {status}
          </p>
        ) : null}
      </div>
      <div
        ref={containerRef}
        className="border-line bg-surface h-[440px] w-full overflow-hidden rounded-2xl border"
        aria-label={labels.useLocation}
      />
    </div>
  );
}
