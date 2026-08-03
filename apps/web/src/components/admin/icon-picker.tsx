"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { TaxonomyIcon } from "~/components/taxonomy-icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

/**
 * Icon chooser whose stored value is the icon's Lucide name. The trigger and
 * grid show glyphs, never the code; a type-ahead filters the vocabulary. Use
 * `variant="grid"` to embed it directly (e.g. inside another popover) without
 * nesting a second overlay.
 */
export function IconPicker({
  name,
  form,
  icons,
  defaultValue = "circle-help",
  ariaLabel,
  emptyLabel = "No matching icon",
  searchLabel = "Search icons",
  variant = "dropdown",
}: {
  name: string;
  /** Associate the posted value with a form elsewhere on the page. */
  form?: string;
  icons: readonly string[];
  defaultValue?: string;
  ariaLabel?: string;
  emptyLabel?: string;
  searchLabel?: string;
  variant?: "dropdown" | "grid";
}) {
  const [selected, setSelected] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? icons.filter((icon) => icon.includes(q)) : icons;
  }, [icons, query]);

  const grid = (
    <>
      <div className="border-line flex items-center gap-2 border-b pb-2">
        <Search className="text-copy-muted size-4 shrink-0" aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          aria-label={searchLabel}
          placeholder={searchLabel}
          className="placeholder:text-copy-muted w-full bg-transparent text-sm outline-none"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-copy-muted py-4 text-center text-xs">{emptyLabel}</p>
      ) : (
        <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto pt-1">
          {filtered.map((icon) => {
            const active = icon === selected;
            return (
              <button
                key={icon}
                type="button"
                aria-label={icon}
                aria-pressed={active}
                title={icon}
                onClick={() => {
                  setSelected(icon);
                  setOpen(false);
                }}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md outline-none transition-colors",
                  active
                    ? "bg-brand-soft text-brand ring-brand ring-2"
                    : "text-copy-muted hover:bg-subtle focus-visible:bg-subtle",
                )}
              >
                <TaxonomyIcon name={icon} size={18} />
              </button>
            );
          })}
        </div>
      )}
    </>
  );

  if (variant === "grid") {
    return (
      <div className="flex flex-col gap-2.5">
        <input type="hidden" name={name} form={form} value={selected} />
        {grid}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} form={form} value={selected} />
      <PopoverTrigger
        aria-label={ariaLabel}
        className="border-input bg-background focus-visible:ring-brand/50 flex min-h-9 w-full items-center gap-2 rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-2"
      >
        <TaxonomyIcon name={selected} size={18} />
        <ChevronDown className="text-copy-muted ms-auto size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        {grid}
      </PopoverContent>
    </Popover>
  );
}
