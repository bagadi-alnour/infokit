import { loadOrganizationDetailPayload } from "~/server/content/public-organization-payload";
import {
  publicJson,
  publicNotFound,
  requestedPublicLocale,
} from "~/server/content/public-api";

/**
 * One verified organisation's public profile and what it runs, or 404 when no
 * such profile is published.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const payload = await loadOrganizationDetailPayload(
    slug,
    requestedPublicLocale(request),
  );
  return payload ? publicJson(payload) : publicNotFound();
}
