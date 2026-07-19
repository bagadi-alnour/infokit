import { z } from "zod";

const optionalFilter = z.string().trim().min(1).max(64).optional();

export const addressSearchParamsSchema = z
  .object({
    query: z.string().trim().min(3).max(200),
    limit: z.coerce.number().int().min(1).max(10).default(6),
    territory: optionalFilter,
    postalCode: optionalFilter,
    cityCode: optionalFilter,
    longitude: z.coerce.number().min(-180).max(180).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
  })
  .refine(
    ({ longitude, latitude }) =>
      (longitude === undefined) === (latitude === undefined),
    { message: "Longitude and latitude must be supplied together" },
  );

export const addressSuggestionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  city: z.string(),
  postalCode: z.string(),
  kind: z.string(),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
});

export const addressSuggestionsResponseSchema = z.object({
  suggestions: z.array(addressSuggestionSchema),
});

export type AddressSearchParams = z.infer<typeof addressSearchParamsSchema>;
export type AddressSuggestion = z.infer<typeof addressSuggestionSchema>;
export type AddressSuggestionsResponse = z.infer<
  typeof addressSuggestionsResponseSchema
>;
