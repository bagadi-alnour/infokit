import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import Link from "next/link";

import { OrganizationMembersCard } from "~/components/admin/organization-members-card";
import {
  EmptyState,
  PageHeader,
  Select,
  WorkspacePage,
} from "~/components/admin/workspace";
import { Button } from "~/components/ui/button";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { organizationMembershipChoices } from "~/server/auth/authorization";
import { requireEditor } from "~/server/auth/require";

/**
 * Who is in this organisation — the roster, their roles, and the invitations
 * nobody has accepted yet.
 *
 * It used to be one card partway down the organisation record, with the pending
 * invitations in a second card below it, so answering "who is here" meant
 * scrolling past the profile, the specialities, the contacts and the languages
 * and then reading two lists. It is a question people arrive with rather than
 * stumble on, so it gets an address of its own. The card does the work; this
 * page only decides which organisation it is about.
 */
export default async function OrganizationMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ org?: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const search = await searchParams;
  const t = await loadPageCatalog(locale, "dashboard-console");
  const user = await requireEditor(locale);
  const { choices, selectedId } = await organizationMembershipChoices(
    user.id,
    search.org,
  );
  const selected = choices.find((choice) => choice.id === selectedId);

  if (!selected) {
    return (
      <WorkspacePage width="content">
        <PageHeader
          title={t["section.members"]}
          sub={t["roles.noMembership"]}
        />
        <EmptyState>{t["org.noMembership"]}</EmptyState>
      </WorkspacePage>
    );
  }

  // Naming the organisation only when there is more than one it could mean.
  const rolesHref = localizedPath(
    choices.length > 1
      ? `/dashboard/my-organization/roles?org=${selected.id}`
      : "/dashboard/my-organization/roles",
    locale,
  );

  return (
    <WorkspacePage>
      <PageHeader
        title={t["section.members"]}
        sub={t["members.hint"]}
        action={
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href={rolesHref} />}
          >
            {t["roles.title"]}
          </Button>
        }
      />

      {choices.length > 1 ? (
        <form method="get" className="mb-5 flex max-w-md items-end gap-2">
          <label className="grid flex-1 gap-1 text-sm font-medium">
            {t["roles.organization"]}
            <Select name="org" defaultValue={selected.id}>
              {choices.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </Select>
          </label>
          <Button variant="secondary">{t["roles.open"]}</Button>
        </form>
      ) : null}

      <OrganizationMembersCard
        organizationId={selected.id}
        locale={locale}
        userId={user.id}
      />
    </WorkspacePage>
  );
}
