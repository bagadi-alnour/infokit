import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import Link from "next/link";

import { OrganizationDetailView } from "~/components/admin/organization-detail-page";
import {
  Card,
  EmptyState,
  PageHeader,
  WorkspacePage,
} from "~/components/admin/workspace";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { organizationMembershipChoices } from "~/server/auth/authorization";
import { requireEditor } from "~/server/auth/require";

export default async function MyOrganizationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ org?: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const search = await searchParams;
  const [t, layout] = await Promise.all([
    loadPageCatalog(locale, "dashboard-console"),
    loadPageCatalog(locale, "dashboard-layout"),
  ]);
  const user = await requireEditor(locale);
  const { choices, selectedId } = await organizationMembershipChoices(
    user.id,
    search.org,
  );

  if ((choices.length === 1 || search.org) && selectedId) {
    return OrganizationDetailView({
      rawLocale: locale,
      id: selectedId,
      surface: "member",
    });
  }

  return (
    <WorkspacePage width="content">
      <PageHeader title={layout["nav.myOrganization"]} sub={t["org.mineSub"]} />
      <Card title={t["org.mine"]}>
        {choices.length === 0 ? (
          <EmptyState>{t["org.noMembership"]}</EmptyState>
        ) : (
          <ul className="divide-line divide-y">
            {choices.map((organization) => (
              <li key={organization.id} className="py-3">
                <Link
                  href={localizedPath(
                    `/dashboard/my-organization?org=${organization.id}`,
                    locale,
                  )}
                  className="text-sm font-semibold hover:underline"
                >
                  {organization.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </WorkspacePage>
  );
}
