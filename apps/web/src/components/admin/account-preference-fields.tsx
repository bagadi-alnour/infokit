"use client";

import { useTheme } from "next-themes";
import { useMemo, useState } from "react";

import { SearchableSelect } from "~/components/admin/searchable-select";
import { Select } from "~/components/admin/workspace";

/**
 * The two preference fields that cannot be plain server-rendered markup: the
 * theme, because the choice must be visible before it is saved, and the time
 * zone, because a searchable list of every IANA zone belongs on the client
 * rather than in the page payload.
 */
export function AccountThemeField({
  name,
  defaultValue,
  labels,
}: {
  name: string;
  defaultValue: "system" | "light" | "dark";
  labels: { system: string; light: string; dark: string };
}) {
  const { setTheme } = useTheme();
  const [value, setValue] = useState(defaultValue);

  return (
    <Select
      name={name}
      value={value}
      onValueChange={(next) => {
        const theme = next === "light" || next === "dark" ? next : "system";
        setValue(theme);
        // Applying it here is the honest preview: this device changes now,
        // saving is what carries the choice to the next one.
        setTheme(theme);
      }}
    >
      <option value="system">{labels.system}</option>
      <option value="light">{labels.light}</option>
      <option value="dark">{labels.dark}</option>
    </Select>
  );
}

/** Zones to offer when the runtime cannot list its own zone table. */
const fallbackTimeZones = [
  "Europe/Paris",
  "Europe/London",
  "Europe/Brussels",
  "Europe/Berlin",
  "UTC",
];

function supportedTimeZones(): string[] {
  const list = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  try {
    return list ? list("timeZone") : fallbackTimeZones;
  } catch {
    return fallbackTimeZones;
  }
}

export function AccountTimeZoneField({
  id,
  name,
  defaultValue,
  label,
  placeholder,
  emptyLabel,
}: {
  id: string;
  name: string;
  defaultValue: string;
  label: string;
  placeholder: string;
  emptyLabel: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const options = useMemo(() => {
    const zones = supportedTimeZones();
    // A stored zone the runtime does not list (an older alias, or a zone
    // removed from the table) still has to be selectable, or saving the page
    // would silently move this account somewhere else.
    if (!zones.includes(defaultValue)) zones.unshift(defaultValue);
    return zones.map((zone) => ({ value: zone, label: zone }));
  }, [defaultValue]);

  return (
    <SearchableSelect
      id={id}
      name={name}
      options={options}
      value={value}
      onValueChange={setValue}
      label={label}
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      required
    />
  );
}
