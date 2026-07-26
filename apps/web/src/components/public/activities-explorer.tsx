"use client";

import type {
  PublicActivityLabels,
  PublicActivitySummary,
} from "@infokit/shared/public-content";
import { ListFilter, Map as MapIcon, Rows3, Search, X } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";

import { ActivityCard } from "~/components/public/activity-card";
import { ChoiceSelect } from "~/components/public/choice-select";
import {
  ActivityLeafletMap,
  type ActivityMapLabels,
} from "~/components/public/activity-map";
import { ActionButton, SurfaceCard } from "~/components/public/primitives";
import { cn } from "~/lib/utils";

/**
 * Filters are a plain text input and dropdowns that open under their own label:
 * translated by the platform, usable with one hand. Nothing here is stored or
 * sent anywhere — filtering happens on the already delivered list
 * (docs/DESIGN-SYSTEM.md §1, degradation order).
 */
function FilterField({
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span
        id={labelId}
        className="text-copy-muted text-xs font-bold uppercase tracking-[0.08em]"
      >
        {label}
      </span>
      <ChoiceSelect
        labelledBy={labelId}
        value={value}
        onValueChange={onChange}
        options={[{ value: "", label: allLabel }, ...options]}
      />
    </div>
  );
}

export function PublicActivitiesExplorer({
  activities,
  labels,
  mapLabels,
}: {
  activities: PublicActivitySummary[];
  labels: PublicActivityLabels;
  mapLabels: ActivityMapLabels;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [audience, setAudience] = useState("");
  const [service, setService] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchId = useId();
  const filterPanelId = useId();

  const categories = useMemo(
    () =>
      Array.from(
        new Map(
          activities.map((activity) => [
            activity.categoryCode,
            activity.categoryLabel,
          ]),
        ),
        ([value, label]) => ({ value, label }),
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
        ([value, label]) => ({ value, label }),
      ),
    [activities],
  );
  const services = useMemo(
    () =>
      Array.from(
        new Map(
          activities.flatMap((activity) =>
            activity.services.map((item) => [item.id, item.label] as const),
          ),
        ),
        ([value, label]) => ({ value, label }),
      ),
    [activities],
  );
  const statuses = [
    { value: "open", label: labels.statusOpen },
    { value: "closed", label: labels.statusClosed },
    { value: "uncertain", label: labels.statusUncertain },
    { value: "cancelled", label: labels.statusCancelled },
  ];

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
    <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <ActionButton
        tone="outline"
        size="block"
        className="justify-between lg:hidden"
        aria-expanded={filtersOpen}
        aria-controls={filterPanelId}
        onClick={() => {
          setFiltersOpen((open) => !open);
        }}
      >
        <span className="inline-flex items-center gap-2">
          <ListFilter className="size-5" aria-hidden />
          {labels.filters}
        </span>
        {activeCount > 0 ? (
          <span className="bg-brand text-brand-ink inline-flex size-6 items-center justify-center rounded-full text-xs font-bold">
            {activeCount}
          </span>
        ) : null}
      </ActionButton>

      <SurfaceCard
        as="section"
        id={filterPanelId}
        aria-label={labels.filters}
        className={cn(
          "flex-col gap-4 p-5 lg:sticky lg:top-24 lg:flex",
          filtersOpen ? "flex" : "hidden",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-ink inline-flex items-center gap-2 text-base font-bold">
            {labels.filters}
            {activeCount > 0 ? (
              <span className="bg-brand text-brand-ink inline-flex size-6 items-center justify-center rounded-full text-xs font-bold">
                {activeCount}
              </span>
            ) : null}
          </h2>
          {activeCount > 0 ? (
            <ActionButton tone="quiet" size="compact" onClick={clearAll}>
              <X className="size-4" aria-hidden />
              {labels.clearAll}
            </ActionButton>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={searchId}
            className="text-copy-muted text-xs font-bold uppercase tracking-[0.08em]"
          >
            {labels.search}
          </label>
          <div className="relative">
            <Search
              className="text-copy-muted pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder={labels.search}
              className="border-line-strong bg-surface text-ink placeholder:text-copy-muted rounded-control focus-visible:outline-brand min-h-12 w-full border pe-3 ps-9 text-[0.95rem] focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </div>
        </div>

        <FilterField
          label={labels.categoryFilter}
          value={category}
          onChange={setCategory}
          allLabel={labels.allCategories}
          options={categories}
        />
        <FilterField
          label={labels.audienceFilter}
          value={audience}
          onChange={setAudience}
          allLabel={labels.allAudiences}
          options={audiences}
        />
        <FilterField
          label={labels.serviceFilter}
          value={service}
          onChange={setService}
          allLabel={labels.allServices}
          options={services}
        />
        <FilterField
          label={labels.statusFilter}
          value={status}
          onChange={setStatus}
          allLabel={labels.allStatuses}
          options={statuses}
        />
      </SurfaceCard>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-ink text-[0.95rem] font-semibold">
            {labels.results.replace("{count}", String(filtered.length))}
          </p>
          <div
            role="group"
            aria-label={`${labels.listView} / ${labels.mapView}`}
            className="border-line bg-subtle rounded-control inline-flex gap-1 border p-1"
          >
            <ViewToggle
              active={view === "list"}
              onClick={() => {
                setView("list");
              }}
              label={labels.listView}
              icon={<Rows3 className="size-4" aria-hidden />}
            />
            <ViewToggle
              active={view === "map"}
              onClick={() => {
                setView("map");
              }}
              label={labels.mapView}
              icon={<MapIcon className="size-4" aria-hidden />}
            />
          </div>
        </div>

        {view === "map" ? (
          <ActivityLeafletMap activities={filtered} labels={mapLabels} />
        ) : filtered.length === 0 ? (
          <SurfaceCard className="text-copy-muted flex flex-col items-center gap-4 p-10 text-center">
            <p className="text-base">{labels.empty}</p>
            {activeCount > 0 ? (
              <ActionButton tone="outline" onClick={clearAll}>
                <X className="size-4" aria-hidden />
                {labels.clearAll}
              </ActionButton>
            ) : null}
          </SurfaceCard>
        ) : (
          <ul className="flex flex-col gap-4">
            {filtered.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                labels={labels}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ViewToggle({
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
        "rounded-control focus-visible:outline-brand inline-flex min-h-11 items-center gap-1.5 px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        active
          ? "border-line bg-surface text-brand-deep shadow-ring border"
          : "text-copy-muted hover:text-ink border border-transparent",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
