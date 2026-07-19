"use client";

import type { AddressSuggestion } from "@calais/validation/address";
import { useEffect, useId, useRef, useState } from "react";
import {
  Button,
  Input,
  Label,
  Paragraph,
  Spinner,
  Text,
  XStack,
  YStack,
  isWeb,
} from "tamagui";

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
  defaultValue?: string;
  minimumQueryLength?: number;
  debounceMs?: number;
  limit?: number;
  onValueChange?: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
}

/**
 * Universal Tamagui address combobox. Web supplies a same-origin proxy URL;
 * mobile can supply an absolute API URL without changing the interaction.
 */
export function AddressAutocomplete({
  endpoint,
  labels,
  filters,
  inputName,
  defaultValue = "",
  minimumQueryLength = 3,
  debounceMs = 350,
  limit = 6,
  onValueChange,
  onSelect,
}: AddressAutocompleteProps) {
  const inputId = useId();
  const listboxId = useId();
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
      const search = new URLSearchParams({
        query,
        limit: String(limit),
      });
      if (territory) search.set("territory", territory);
      if (postalCode) search.set("postalCode", postalCode);
      if (cityCode) search.set("cityCode", cityCode);
      if (proximityLongitude !== undefined && proximityLatitude !== undefined) {
        search.set("longitude", String(proximityLongitude));
        search.set("latitude", String(proximityLatitude));
      }

      setStatus("loading");
      void fetch(`${endpoint}?${search}`, {
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
    <YStack gap="$calais2" position="relative" zIndex={10}>
      <Label htmlFor={inputId} fontSize="$3" fontWeight="600">
        {labels.label}
      </Label>
      <XStack position="relative" alignItems="center">
        <Input
          id={inputId}
          name={inputName}
          value={value}
          onChangeText={(nextValue) => {
            setValue(nextValue);
            onValueChange?.(nextValue);
          }}
          onFocus={() => {
            setOpen(suggestions.length > 0);
          }}
          onBlur={() => {
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
              setOpen(true);
              setActiveIndex((index) =>
                Math.min(index + 1, suggestions.length - 1),
              );
              return;
            }
            if (event.key === "ArrowUp") {
              setActiveIndex((index) => Math.max(index - 1, 0));
              return;
            }
            if (
              event.key === "Enter" &&
              activeIndex >= 0 &&
              suggestions[activeIndex]
            ) {
              choose(suggestions[activeIndex]);
            }
          }}
          placeholder={labels.placeholder}
          autoComplete="street-address"
          minHeight={44}
          flex={1}
          borderRadius="$control"
          borderColor="$borderStrong"
          paddingEnd={status === "loading" ? "$calais6" : "$calais3"}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-${String(activeIndex)}` : undefined
          }
        />
        {status === "loading" ? (
          <Spinner
            position="absolute"
            right={12}
            size="small"
            color="$accent"
          />
        ) : null}
      </XStack>
      <Paragraph color="$mutedText" fontSize="$2" lineHeight={18}>
        {labels.help}
      </Paragraph>

      {open ? (
        <YStack
          id={listboxId}
          {...(isWeb
            ? {
                // Tamagui's cross-platform role type omits the valid ARIA listbox role.
                role: "listbox" as never,
                "aria-label": labels.label,
              }
            : {
                accessibilityRole: "menu" as const,
                accessibilityLabel: labels.label,
              })}
          position="absolute"
          top="100%"
          start={0}
          end={0}
          marginTop="$calais1"
          maxHeight={280}
          overflow="scroll"
          backgroundColor="$surface"
          borderWidth={1}
          borderColor="$borderColor"
          borderRadius="$control"
          padding="$calais1"
          shadowColor="$color"
          shadowOpacity={0.12}
          shadowRadius={18}
          zIndex={100}
        >
          {suggestions.map((suggestion, index) => (
            <Button
              key={suggestion.id}
              id={`${listboxId}-${String(index)}`}
              {...(isWeb
                ? {
                    role: "option" as const,
                    "aria-selected": index === activeIndex,
                  }
                : {
                    accessibilityRole: "button" as const,
                    accessibilityState: { selected: index === activeIndex },
                  })}
              unstyled
              minHeight={44}
              alignItems="flex-start"
              justifyContent="center"
              paddingHorizontal="$calais3"
              paddingVertical="$calais2"
              borderRadius={8}
              backgroundColor={
                index === activeIndex ? "$accentSoft" : "transparent"
              }
              hoverStyle={{ backgroundColor: "$subtle" }}
              focusStyle={{ backgroundColor: "$accentSoft" }}
              onPress={() => {
                choose(suggestion);
              }}
            >
              <Text fontSize="$3" fontWeight="600">
                {suggestion.label}
              </Text>
            </Button>
          ))}
          {statusMessage ? (
            <Paragraph
              color={status === "error" ? "$danger" : "$mutedText"}
              fontSize="$3"
              padding="$calais3"
              role="status"
            >
              {statusMessage}
            </Paragraph>
          ) : null}
          <Text
            color="$mutedText"
            fontSize="$1"
            paddingHorizontal="$calais3"
            paddingVertical="$calais2"
          >
            {labels.attribution}
          </Text>
        </YStack>
      ) : null}
    </YStack>
  );
}

export type { AddressSuggestion } from "@calais/validation/address";
