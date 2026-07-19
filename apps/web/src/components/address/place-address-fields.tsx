"use client";

import {
  AddressAutocomplete,
  Paragraph,
  type AddressAutocompleteLabels,
  type AddressSuggestion,
  YStack,
} from "@calais/ui";
import { useState } from "react";

export function PlaceAddressFields({
  labels,
  selectedLabel,
}: {
  labels: AddressAutocompleteLabels;
  selectedLabel: string;
}) {
  const [selection, setSelection] = useState<AddressSuggestion | null>(null);

  return (
    <YStack gap="$calais2">
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
        <Paragraph color="$mutedText" fontSize="$2" role="status">
          {selectedLabel
            .replace("{latitude}", selection.latitude.toFixed(6))
            .replace("{longitude}", selection.longitude.toFixed(6))}
        </Paragraph>
      ) : null}
    </YStack>
  );
}
