"use client";

import type { AddressSuggestion } from "@infokit/validation/address";
import { Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "~/lib/utils";

export interface AddressAutocompleteFilters {
  territory?: string;
  postalCode?: string;
  cityCode?: string;
  proximity?: { longitude: number; latitude: number };
}

export interface AddressAutocompleteLabels {
  label: string;
  placeholder: string;
  help: string;
  loading: string;
  empty: string;
  error: string;
  attribution: string;
}

export interface AddressAutocompleteProps {
  endpoint: string;
  labels: AddressAutocompleteLabels;
  filters?: AddressAutocompleteFilters;
  inputName?: string;
  /** Associates the typed address with a form rendered elsewhere on the page. */
  form?: string;
  defaultValue?: string;
  minimumQueryLength?: number;
  debounceMs?: number;
  limit?: number;
  onValueChange?: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
}

/**
 * Workspace address combobox. The endpoint is a same-origin proxy so the
 * upstream address API never sees the editor's browser, and the whole control
 * degrades to a plain text input if scripting fails: the typed value is still
 * submitted under `inputName`.
 */
export function AddressAutocomplete({
  endpoint,
  labels,
  filters,
  inputName,
  form,
  defaultValue = "",
  minimumQueryLength = 3,
  debounceMs = 350,
  limit = 6,
  onValueChange,
  onSelect,
}: AddressAutocompleteProps) {
  const inputId = useId();
  const listboxId = useId();
  const helpId = useId();
  const skipNextSearch = useRef(false);
  const territory = filters?.territory;
  const postalCode = filters?.postalCode;
  const cityCode = filters?.cityCode;
  const proximityLongitude = filters?.proximity?.longitude;
  const proximityLatitude = filters?.proximity?.latitude;
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    const query = value.trim();
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (query.length < minimumQueryLength) {
      setSuggestions([]);
      setOpen(false);
      setStatus("idle");
      return;
    }

    let controller: AbortController | undefined;
    const timer = setTimeout(() => {
      controller = new AbortController();
      const search = new URLSearchParams({ query, limit: String(limit) });
      if (territory) search.set("territory", territory);
      if (postalCode) search.set("postalCode", postalCode);
      if (cityCode) search.set("cityCode", cityCode);
      if (proximityLongitude !== undefined && proximityLatitude !== undefined) {
        search.set("longitude", String(proximityLongitude));
        search.set("latitude", String(proximityLatitude));
      }

      setStatus("loading");
      void fetch(`${endpoint}?${search.toString()}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Address search failed");
          const body = (await response.json()) as {
            suggestions?: AddressSuggestion[];
          };
          const nextSuggestions = body.suggestions ?? [];
          setSuggestions(nextSuggestions);
          setActiveIndex(nextSuggestions.length > 0 ? 0 : -1);
          setOpen(true);
          setStatus("idle");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setSuggestions([]);
          setOpen(true);
          setStatus("error");
        });
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller?.abort();
    };
  }, [
    cityCode,
    debounceMs,
    endpoint,
    limit,
    minimumQueryLength,
    postalCode,
    proximityLatitude,
    proximityLongitude,
    territory,
    value,
  ]);

  const choose = (suggestion: AddressSuggestion) => {
    skipNextSearch.current = true;
    setValue(suggestion.label);
    setSuggestions([]);
    setOpen(false);
    setStatus("idle");
    onValueChange?.(suggestion.label);
    onSelect(suggestion);
  };

  const statusMessage =
    status === "loading"
      ? labels.loading
      : status === "error"
        ? labels.error
        : open && suggestions.length === 0
          ? labels.empty
          : "";

  return (
    <div className="relative z-10 flex flex-col gap-1">
      <label htmlFor={inputId} className="text-ink text-sm font-semibold">
        {labels.label}
      </label>
      <div className="relative flex items-center">
        <input
          id={inputId}
          name={inputName}
          form={form}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            onValueChange?.(event.target.value);
          }}
          onFocus={() => {
            setOpen(suggestions.length > 0);
          }}
          onBlur={() => {
            // Delay so a click on an option lands before the list unmounts.
            setTimeout(() => {
              setOpen(false);
            }, 120);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) =>
                Math.min(index + 1, suggestions.length - 1),
              );
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
              return;
            }
            const active = suggestions[activeIndex];
            if (event.key === "Enter" && active) {
              event.preventDefault();
              choose(active);
            }
          }}
          placeholder={labels.placeholder}
          autoComplete="street-address"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-describedby={helpId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-${String(activeIndex)}` : undefined
          }
          className={cn(
            "border-line-strong bg-surface text-ink rounded-control focus-visible:outline-brand min-h-9 w-full border px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2",
            status === "loading" ? "pe-10" : null,
          )}
        />
        {status === "loading" ? (
          <Loader2
            className="text-brand-deep absolute end-3 size-4 animate-spin motion-reduce:hidden"
            aria-hidden
          />
        ) : null}
      </div>
      <p id={helpId} className="text-copy-muted text-xs leading-relaxed">
        {labels.help}
      </p>

      {open ? (
        <div
          /* Same surface as every dropdown popup (~/components/ui/select): the
           * suggestions are a menu under the field, so they read like one. */
          className="bg-popover text-popover-foreground ring-foreground/10 z-100 max-h-70 absolute end-0 start-0 top-full mt-1 overflow-y-auto rounded-lg p-1 shadow-md ring-1"
          role="listbox"
          id={listboxId}
          aria-label={labels.label}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              id={`${listboxId}-${String(index)}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => {
                choose(suggestion);
              }}
              className={cn(
                "hover:bg-brand-soft hover:text-brand flex min-h-9 w-full items-center rounded-md px-3 py-2 text-start text-sm font-semibold",
                index === activeIndex ? "bg-brand-soft text-brand" : null,
              )}
            >
              {suggestion.label}
            </button>
          ))}
          {statusMessage ? (
            <p
              role="status"
              className={cn(
                "px-3 py-2 text-sm",
                status === "error" ? "text-danger" : "text-copy-muted",
              )}
            >
              {statusMessage}
            </p>
          ) : null}
          <p className="text-copy-muted px-3 py-2 text-xs">
            {labels.attribution}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export type { AddressSuggestion } from "@infokit/validation/address";
