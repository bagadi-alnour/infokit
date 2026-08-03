"use client";

import { useState } from "react";

import {
  AddressAutocomplete,
  type AddressAutocompleteFilters,
  type AddressAutocompleteLabels,
  type AddressSuggestion,
} from "~/components/address/address-autocomplete";

/**
 * The keys the four values post under. A form that creates a place inline —
 * the event editor — carries its own address alongside the event's own fields,
 * so the names cannot be fixed here.
 */
export interface PlaceAddressFieldNames {
  addressLine: string;
  postalCode: string;
  lat: string;
  lng: string;
}

const placeFieldNames: PlaceAddressFieldNames = {
  addressLine: "addressLine",
  postalCode: "postalCode",
  lat: "lat",
  lng: "lng",
};

export function PlaceAddressFields({
  labels,
  selectedLabel,
  names = placeFieldNames,
  form,
  defaultAddressLine = "",
  filters = { postalCode: "62100" },
}: {
  labels: AddressAutocompleteLabels;
  selectedLabel: string;
  names?: PlaceAddressFieldNames;
  /** Associates all four values with a form rendered elsewhere on the page. */
  form?: string;
  /** The address a record already has, when this block is editing one. */
  defaultAddressLine?: string;
  /**
   * Which addresses the suggestions are drawn from. Defaults to Calais, whose
   * places page this control was written for; a form that asks about any city
   * passes `undefined` and searches the whole country.
   */
  filters?: AddressAutocompleteFilters;
}) {
  const [selection, setSelection] = useState<AddressSuggestion | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <AddressAutocomplete
        endpoint="/api/addresses"
        labels={labels}
        inputName={names.addressLine}
        form={form}
        defaultValue={defaultAddressLine}
        filters={filters}
        onValueChange={() => {
          setSelection(null);
        }}
        onSelect={setSelection}
      />
      <input
        type="hidden"
        name={names.postalCode}
        form={form}
        value={selection?.postalCode ?? ""}
      />
      <input
        type="hidden"
        name={names.lat}
        form={form}
        value={selection ? String(selection.latitude) : ""}
      />
      <input
        type="hidden"
        name={names.lng}
        form={form}
        value={selection ? String(selection.longitude) : ""}
      />
      {selection ? (
        <p className="text-copy-muted text-xs" role="status">
          {selectedLabel
            .replace("{latitude}", selection.latitude.toFixed(6))
            .replace("{longitude}", selection.longitude.toFixed(6))}
        </p>
      ) : null}
    </div>
  );
}
