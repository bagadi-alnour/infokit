"use client";

import { useMemo } from "react";

import { TaxonomyIcon } from "~/components/taxonomy-icon";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "~/components/ui/combobox";

export type SearchableOption = {
  value: string;
  label: string;
  description?: string;
  icon?: string | null;
};

const sameOption = (left: SearchableOption, right: SearchableOption) =>
  left.value === right.value;

export function SearchableSelect({
  id,
  name,
  options,
  value,
  onValueChange,
  label,
  placeholder,
  emptyLabel,
  required = false,
  disabled = false,
}: {
  /** Lets a visible label point at the input instead of wrapping it. */
  id?: string;
  name: string;
  options: readonly SearchableOption[];
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  emptyLabel?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(option) => {
        onValueChange(option?.value ?? "");
      }}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      isItemEqualToValue={sameOption}
      autoHighlight
      disabled={disabled}
    >
      <input type="hidden" name={name} value={value} />
      <ComboboxInput
        id={id}
        aria-label={label}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        showClear={!required}
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {(option: SearchableOption) => (
            <ComboboxItem key={option.value} value={option}>
              {option.icon ? (
                <span className="bg-brand-soft text-brand flex size-8 shrink-0 items-center justify-center rounded-md">
                  <TaxonomyIcon name={option.icon} size={16} />
                </span>
              ) : null}
              <span className="min-w-0">
                <span className="block truncate">{option.label}</span>
                {option.description ? (
                  <span className="text-muted-foreground block truncate text-xs">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export function SearchableMultiSelect({
  name,
  form,
  options,
  value,
  onValueChange,
  label,
  placeholder,
  emptyLabel,
  maxSelections,
}: {
  name: string;
  /** Associate the posted values with a form elsewhere on the page. */
  form?: string;
  options: readonly SearchableOption[];
  value: readonly string[];
  onValueChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  emptyLabel?: string;
  maxSelections?: number;
}) {
  const selected = useMemo(
    () =>
      value
        .map((selectedValue) =>
          options.find((option) => option.value === selectedValue),
        )
        .filter((option): option is SearchableOption => option !== undefined),
    [options, value],
  );

  return (
    <Combobox
      items={options}
      multiple
      value={selected}
      onValueChange={(nextValue, details) => {
        /**
         * Base UI empties a closed combobox when Escape is pressed on its
         * input. On a chips field that wipes every choice at once, with nothing
         * to show it happened — so Escape here only closes the list. A chip is
         * removed by its own × or by Backspace, which both report another
         * reason.
         */
        if (details.reason === "escape-key") return;
        if (maxSelections === undefined || nextValue.length <= maxSelections) {
          onValueChange(nextValue.map((option) => option.value));
        }
      }}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      isItemEqualToValue={sameOption}
      autoHighlight
    >
      {value.map((selectedValue) => (
        <input
          key={selectedValue}
          type="hidden"
          name={name}
          form={form}
          value={selectedValue}
        />
      ))}
      <ComboboxChips className="min-h-11 gap-2 p-2">
        <ComboboxValue>
          {(selectedOptions: SearchableOption[]) => (
            <>
              {selectedOptions.map((option) => (
                <ComboboxChip
                  key={option.value}
                  className="min-h-9 gap-1.5 rounded-md px-2.5 py-1.5"
                >
                  {option.icon ? (
                    <TaxonomyIcon name={option.icon} size={14} />
                  ) : null}
                  {option.label}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                aria-label={label}
                placeholder={
                  selectedOptions.length > 0 ? undefined : placeholder
                }
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent>
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {(option: SearchableOption) => (
            <ComboboxItem key={option.value} value={option}>
              {option.icon ? (
                <span className="bg-brand-soft text-brand flex size-8 shrink-0 items-center justify-center rounded-md">
                  <TaxonomyIcon name={option.icon} size={16} />
                </span>
              ) : null}
              <span className="min-w-0">
                <span className="block truncate">{option.label}</span>
                {option.description ? (
                  <span className="text-muted-foreground block truncate text-xs">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
