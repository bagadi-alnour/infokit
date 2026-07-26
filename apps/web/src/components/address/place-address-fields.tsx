"use client";

import { useState } from "react";

import {
  AddressAutocomplete,
  type AddressAutocompleteLabels,
  type AddressSuggestion,
} from "~/components/address/address-autocomplete";

export function PlaceAddressFields({
  labels,
  selectedLabel,
}: {
  labels: AddressAutocompleteLabels;
  selectedLabel: string;
}) {
  const [selection, setSelection] = useState<AddressSuggestion | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <AddressAutocomplete
        endpoint="/api/addresses"
        labels={labels}
        inputName="addressLine"
        filters={{ postalCode: "62100" }}
        onValueChange={() => {
          setSelection(null);
        }}
        onSelect={setSelection}
      />
      <input
        type="hidden"
        name="postalCode"
        value={selection?.postalCode ?? ""}
      />
      <input
        type="hidden"
        name="lat"
        value={selection ? String(selection.latitude) : ""}
      />
      <input
        type="hidden"
        name="lng"
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
