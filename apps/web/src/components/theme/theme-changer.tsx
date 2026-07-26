"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import {
  PreferenceSelect,
  type PreferenceOption,
} from "~/components/public/preference-select";
import {
  type ThemePreference,
  useThemePreference,
} from "~/components/theme/theme-provider";

/**
 * Three explicit choices — follow the device, light, dark — rather than a
 * toggle, because "system" is a real preference an editor may want to keep.
 */
export function ThemeChanger({
  label,
  systemLabel,
  lightLabel,
  darkLabel,
}: {
  label: string;
  systemLabel: string;
  lightLabel: string;
  darkLabel: string;
}) {
  const { preference, setPreference } = useThemePreference();
  const options: readonly PreferenceOption<ThemePreference>[] = [
    { value: "system", label: systemLabel },
    { value: "light", label: lightLabel },
    { value: "dark", label: darkLabel },
  ];
  const Icon =
    preference === "light" ? Sun : preference === "dark" ? Moon : Monitor;

  return (
    <PreferenceSelect
      label={label}
      value={preference}
      options={options}
      icon={<Icon className="size-4" />}
      onValueChange={setPreference}
    />
  );
}
