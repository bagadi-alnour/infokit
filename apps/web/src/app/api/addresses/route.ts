import {
  addressSearchParamsSchema,
  type AddressSuggestion,
} from "@infokit/validation/address";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const autocompleteEndpoint = "https://data.geopf.fr/geocodage/completion/";

const geoplatformResponseSchema = z.object({
  status: z.string(),
  results: z.array(
    z.object({
      x: z.number(),
      y: z.number(),
      city: z.string().default(""),
      zipcode: z.string().default(""),
      kind: z.string().default(""),
      fulltext: z.string().min(1),
    }),
  ),
});

export async function GET(request: NextRequest) {
  const input = addressSearchParamsSchema.safeParse({
    query: request.nextUrl.searchParams.get("query"),
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    territory: request.nextUrl.searchParams.get("territory") ?? undefined,
    postalCode: request.nextUrl.searchParams.get("postalCode") ?? undefined,
    cityCode: request.nextUrl.searchParams.get("cityCode") ?? undefined,
    longitude: request.nextUrl.searchParams.get("longitude") ?? undefined,
    latitude: request.nextUrl.searchParams.get("latitude") ?? undefined,
  });
  if (!input.success) {
    return NextResponse.json({ suggestions: [] }, { status: 400 });
  }

  const query = new URLSearchParams({
    text: input.data.query,
    type: "StreetAddress",
    maximumResponses: String(input.data.limit),
  });
  if (input.data.territory) query.set("terr", input.data.territory);
  if (input.data.postalCode) query.set("zipcode", input.data.postalCode);
  if (input.data.cityCode) query.set("citycode", input.data.cityCode);
  if (input.data.longitude !== undefined && input.data.latitude !== undefined) {
    query.set(
      "lonlat",
      `${String(input.data.longitude)},${String(input.data.latitude)}`,
    );
  }

  try {
    const response = await fetch(`${autocompleteEndpoint}?${query}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) {
      return NextResponse.json({ suggestions: [] }, { status: 502 });
    }

    const parsed = geoplatformResponseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.status !== "OK") {
      return NextResponse.json({ suggestions: [] }, { status: 502 });
    }

    const suggestions: AddressSuggestion[] = parsed.data.results.map(
      (result) => ({
        id: `${result.fulltext}:${String(result.x)}:${String(result.y)}`,
        label: result.fulltext,
        city: result.city,
        postalCode: result.zipcode,
        kind: result.kind,
        longitude: result.x,
        latitude: result.y,
      }),
    );
    return NextResponse.json(
      { suggestions },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ suggestions: [] }, { status: 502 });
  }
}
