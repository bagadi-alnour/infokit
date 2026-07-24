import { redirect } from "next/navigation";

import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";

/** Services are managed as reusable capabilities inside Activities. */
export default async function LegacyServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  redirect(localizedPath("/dashboard/activities", locale));
}
