import { redirect } from "next/navigation";

import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";

/** Legacy service-offering URLs now resolve to the activity workspace. */
export default async function LegacyServicePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  redirect(localizedPath("/dashboard/activities", locale));
}
