import { memberViewer } from "~/server/auth/member-viewer";
import { loadMemberAgendaPayload } from "~/server/content/member-payload";
import {
  memberJson,
  memberUnauthorized,
  requestedMonth,
  requestedPublicLocale,
} from "~/server/content/public-api";

/**
 * The coordination agenda this member may read. The tiers are decided here from
 * their memberships; `?month=YYYY-MM` only moves the calendar's labels.
 */
export async function GET(request: Request) {
  const viewer = await memberViewer(request);
  if (!viewer) return memberUnauthorized();
  const payload = await loadMemberAgendaPayload({
    viewer,
    locale: requestedPublicLocale(request),
    requestedMonth: requestedMonth(request),
  });
  return memberJson(payload);
}
