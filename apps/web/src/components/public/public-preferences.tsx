"use client";

import {
  localeMetadata,
  publicSupportedLocales,
  type PublicLocale,
} from "@infokit/shared/i18n";
import { Languages, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId } from "react";

import { PreferenceSelect } from "~/components/public/preference-select";
import { useThemePreference } from "~/components/theme/theme-provider";
import { localizedPath } from "~/i18n/routing";
import { cn } from "~/lib/utils";

/**
 * The two viewer preferences the public site keeps: which language it speaks,
 * and whether it is painted light or dark. Language is a matter of
 * understanding the page at all, so it stays on the bar at every width; theme
 * is comfort, and on a phone it moves inside the menu where there is room to
 * write the two words out (docs/DESIGN-SYSTEM.md §5).
 */

/**
 * The language menu, opening under its control, each language written in its own
 * script (docs/DESIGN-SYSTEM.md §1). On a narrow bar the current language may
 * truncate — the globe beside it still says what the control is for.
 */
export function PublicLanguageSelect({
  locale,
  currentPath,
  label,
  className,
}: {
  locale: PublicLocale;
  currentPath: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <PreferenceSelect
      label={label}
      value={locale}
      options={publicSupportedLocales.map((language) => ({
        value: language,
        label: localeMetadata[language].label,
        lang: language,
      }))}
      onValueChange={(language) => {
        router.push(localizedPath(currentPath, language));
      }}
      icon={<Languages className="size-4" aria-hidden />}
      className={cn("max-w-40", className)}
    />
  );
}

/** True when the page is painted dark, whichever way the reader asked for it. */
function useDarkScheme() {
  const { preference, resolved, setPreference } = useThemePreference();
  return {
    dark:
      preference === "dark" || (preference === "system" && resolved === "dark"),
    setPreference,
  };
}

/**
 * Theme as one icon button, for the bar: it shows the scheme it switches *to*,
 * which is the only thing worth a single glyph in that much space.
 */
export function PublicThemeToggle({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const { dark, setPreference } = useDarkScheme();

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={dark}
      onClick={() => {
        setPreference(dark ? "light" : "dark");
      }}
      className={cn(
        "border-line bg-surface text-copy-muted hover:text-brand-deep hover:border-brand rounded-control focus-visible:outline-brand inline-flex size-12 items-center justify-center border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        className,
      )}
    >
      {dark ? (
        <Sun className="size-5" aria-hidden />
      ) : (
        <Moon className="size-5" aria-hidden />
      )}
    </button>
  );
}

/**
 * Theme as two named choices, for the menu: each carries its icon *and* its
 * word, so the reader picks the scheme they want rather than guessing which way
 * a single symbol points (rule 1).
 */
export function PublicAppearanceChoice({
  label,
  lightLabel,
  darkLabel,
}: {
  label: string;
  lightLabel: string;
  darkLabel: string;
}) {
  const { dark, setPreference } = useDarkScheme();
  const labelId = useId();
  const schemes = [
    { key: "light" as const, icon: Sun, label: lightLabel, active: !dark },
    { key: "dark" as const, icon: Moon, label: darkLabel, active: dark },
  ];

  return (
    <div>
      <p id={labelId} className="text-eyebrow text-copy-muted mb-2 px-1">
        {label}
      </p>
      <div
        role="group"
        aria-labelledby={labelId}
        className="bg-subtle rounded-control flex gap-1 p-1"
      >
        {schemes.map(({ key, icon: Icon, label: schemeLabel, active }) => (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => {
              setPreference(key);
            }}
            className={cn(
              "rounded-control focus-visible:outline-brand flex min-h-12 flex-1 items-center justify-center gap-2 text-[0.95rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
              active
                ? "bg-surface text-ink shadow-ring"
                : "text-copy-muted hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {schemeLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
