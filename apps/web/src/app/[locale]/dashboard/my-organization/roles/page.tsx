import { formatMessage } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import Link from "next/link";

import { OrganizationRolesCard } from "~/components/admin/organization-roles-card";
import {
  Chip,
  EmptyState,
  PageHeader,
  Select,
  WorkspacePage,
} from "~/components/admin/workspace";
import { Button } from "~/components/ui/button";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import {
  authorizationFor,
  organizationMembershipChoices,
} from "~/server/auth/authorization";
import { requireEditor } from "~/server/auth/require";

/**
 * What each role in this organisation is allowed to do.
 *
 * Its own page rather than a section of the organisation record: deciding a
 * colleague's role is its own errand, arrived at deliberately, and the record
 * page is already long. The table itself lives in `OrganizationRolesCard`, which
 * is what turns codes into sentences.
 *
 * No `?org=` in the address people arrive at. `organizationMembershipChoices`
 * falls back to the reader's first active membership, which for almost everyone
 * is their only one — so the parameter earns its place solely as the switcher
 * below, for the few who administer several, and is honoured only for an
 * organisation the reader is actually a member of.
 */
export default async function OrganizationRolesPage({
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
        <PageHeader title={t["roles.title"]} sub={t["roles.noMembership"]} />
        <EmptyState>{t["org.noMembership"]}</EmptyState>
      </WorkspacePage>
    );
  }

  const authorization = await authorizationFor(user.id, selected.id);
  const canManage = authorization.effectivePermissions.has("roles.manage");
  // Roles are read here and granted on the roster, so the way back names the
  // organisation only when there is more than one it could mean.
  const membersHref = localizedPath(
    choices.length > 1
      ? `/dashboard/my-organization/members?org=${selected.id}`
      : "/dashboard/my-organization/members",
    locale,
  );

  return (
    <WorkspacePage>
      <PageHeader
        title={t["roles.title"]}
        sub={formatMessage(t["roles.sub"], {
          organization: selected.name,
        })}
        badges={
          canManage ? (
            <Chip tone="accent">{t["roles.canManage"]}</Chip>
          ) : (
            <Chip tone="neutral">{t["roles.readOnly"]}</Chip>
          )
        }
        action={
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href={membersHref} />}
          >
            {t["roles.openMembers"]}
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

      <OrganizationRolesCard
        organizationId={selected.id}
        locale={locale}
        canManage={canManage}
      />
    </WorkspacePage>
  );
}
