"use client";

import { PreferenceSelect, Text, type PreferenceOption } from "@calais/ui";

import {
  type ThemePreference,
  useThemePreference,
} from "~/components/theme/theme-provider";

function ThemeGlyph({ mode }: { mode: ThemePreference }) {
  return (
    <Text width={18} height={18} color="$mutedText" lineHeight={18} aria-hidden>
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {mode === "system" ? (
          <>
            <circle cx="12" cy="12" r="7" />
            <path d="M12 5a7 7 0 0 1 0 14Z" fill="currentColor" stroke="none" />
          </>
        ) : null}
        {mode === "light" ? (
          <>
            <circle cx="12" cy="12" r="3.5" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
          </>
        ) : null}
        {mode === "dark" ? (
          <path d="M20 15.1A8.2 8.2 0 0 1 8.9 4a8.2 8.2 0 1 0 11.1 11.1Z" />
        ) : null}
      </svg>
    </Text>
  );
}

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
    {
      value: "system",
      label: systemLabel,
      prefix: <ThemeGlyph mode="system" />,
    },
    {
      value: "light",
      label: lightLabel,
      prefix: <ThemeGlyph mode="light" />,
    },
    {
      value: "dark",
      label: darkLabel,
      prefix: <ThemeGlyph mode="dark" />,
    },
  ];

  return (
    <PreferenceSelect
      label={label}
      value={preference}
      options={options}
      onValueChange={setPreference}
      triggerMode="icon"
    />
  );
}
