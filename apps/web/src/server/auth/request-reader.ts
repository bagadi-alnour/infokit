import { auth } from "~/server/auth";
import { memberViewer } from "./member-viewer";

/**
 * Who is asking, whichever surface they came from: a browser with its session
 * cookie, or the phone app presenting its session as a bearer token. Files and
 * calendar downloads use this so one visibility check serves both — the tiers
 * stay in `coordination-events`, and only the way the caller is identified
 * differs.
 */
export async function readerUserId(request: Request): Promise<string | null> {
  const session = await auth();
  if (session?.user) return session.user.id;
  return (await memberViewer(request))?.userId ?? null;
}
