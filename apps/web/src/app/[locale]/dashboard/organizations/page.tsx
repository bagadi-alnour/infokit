import { asc, count, inArray, isNull } from "drizzle-orm";
import Link from "next/link";

import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import {
  OrganizationsTable,
  type OrganizationRow,
} from "~/components/admin/organizations-table";
import {
  Chip,
  PageHeader,
  Stat,
  StatGrid,
  WorkspacePage,
} from "~/components/admin/workspace";
import { Icon } from "~/components/icons";
import { Button } from "~/components/ui/button";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import {
  hasActualPlatformPermission,
  isPlatformAdmin,
} from "~/server/auth/authorization";
import { denyPageAccess, requireEditor } from "~/server/auth/require";
import { db } from "~/server/db";
import {
  activities,
  organizationMembers,
  organizations,
  organizationSpecialities,
} from "~/server/db/schema";

/**
 * The organisation directory — a platform surface.
 *
 * Listing every association is administration, not membership: an operator
 * needs it to spot duplicates, unclaimed records and stale drafts. A member of
 * one association has no business reading that list, so they are sent to their
 * own record instead (docs/PRODUCT.md §11.3).
 */
export default async function OrganizationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const t = await loadPageCatalog(locale, "dashboard-console");
  const user = await requireEditor(locale);
  /**
   * Listing every association is administration. An association's own members
   * get their memberships below and nothing else.
   */
  const directoryAccess = await isPlatformAdmin(user.id);

  if (!directoryAccess) {
    await denyPageAccess("organization.verify", locale);
    return null;
  }

  const canCreate = await hasActualPlatformPermission(
    user.id,
    "organization.verify",
  );

  const [organizationRows, activityRows, specialityRows, memberRows] =
    await Promise.all([
      db
        .select({
          id: organizations.id,
          displayName: organizations.displayName,
          slug: organizations.slug,
          status: organizations.status,
          claimedAt: organizations.claimedAt,
          createdAt: organizations.createdAt,
        })
        .from(organizations)
        .orderBy(asc(organizations.displayName)),
      db
        .select({ organizationId: activities.organizationId, n: count() })
        .from(activities)
        .where(isNull(activities.archivedAt))
        .groupBy(activities.organizationId),
      db
        .select({
          organizationId: organizationSpecialities.organizationId,
          n: count(),
        })
        .from(organizationSpecialities)
        .where(isNull(organizationSpecialities.retiredAt))
        .groupBy(organizationSpecialities.organizationId),
      db
        .select({
          organizationId: organizationMembers.organizationId,
          n: count(),
        })
        .from(organizationMembers)
        .where(inArray(organizationMembers.status, ["invited", "active"]))
        .groupBy(organizationMembers.organizationId),
    ]);

  const activityCounts = new Map(
    activityRows.map((row) => [row.organizationId, row.n]),
  );
  const specialityCounts = new Map(
    specialityRows.map((row) => [row.organizationId, row.n]),
  );
  const memberCounts = new Map(
    memberRows.map((row) => [row.organizationId, row.n]),
  );

  const rows: OrganizationRow[] = organizationRows.map((org) => ({
    id: org.id,
    displayName: org.displayName,
    slug: org.slug,
    status: org.status,
    claimedAt: org.claimedAt?.toISOString() ?? null,
    createdAt: org.createdAt.toISOString(),
    specialityCount: specialityCounts.get(org.id) ?? 0,
    activityCount: activityCounts.get(org.id) ?? 0,
    memberCount: memberCounts.get(org.id) ?? 0,
  }));

  return (
    <WorkspacePage>
      <PageHeader
        title={t["org.listTitle"]}
        sub={t["org.listSub"]}
        badges={
          <Chip tone="accent">
            <span className="inline-flex items-center gap-1">
              <Icon name="unclaimed" size={13} />
              {t["org.platformOnly"]}
            </span>
          </Chip>
        }
        action={
          canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link
                  href={localizedPath("/dashboard/organizations/new", locale)}
                />
              }
            >
              <Icon name="plus" size={16} />
              {t["org.newTitle"]}
            </Button>
          ) : null
        }
      />

      <StatGrid>
        <Stat label={t["org.stat.total"]} value={rows.length} />
        <Stat
          label={t["org.stat.verified"]}
          value={rows.filter((row) => row.status === "verified").length}
        />
        <Stat
          label={t["org.stat.claimed"]}
          value={rows.filter((row) => row.claimedAt !== null).length}
          hint={t["org.stat.claimedHint"]}
        />
        <Stat
          label={t["org.stat.draft"]}
          value={rows.filter((row) => row.status === "draft").length}
          hint={t["org.stat.draftHint"]}
        />
      </StatGrid>

      <OrganizationsTable
        rows={rows}
        locale={locale}
        labels={{
          search: t["console.search"],
          searchPlaceholder: t["org.searchPlaceholder"],
          columns: t["table.columns"],
          clear: t["table.clearSearch"],
          noMatch: t["console.filter.noMatch"],
          rowsPerPage: t["table.rowsPerPage"],
          results: t["table.results"],
          page: t["table.page"],
          previous: t["table.previousPage"],
          next: t["table.nextPage"],
          name: t["table.name"],
          status: t["table.status"],
          maintainedBy: t["org.maintainedBy"],
          maintainedByOrg: t["org.maintainedByOrg"],
          maintainedByPlatform: t["org.maintainedByPlatform"],
          specialities: t["section.specialities"],
          activities: t["section.activities"],
          members: t["section.members"],
          created: t["table.created"],
          anyStatus: t["console.filter.anyStatus"],
          anyMaintainer: t["console.filter.anyAccess"],
          statusLabels: {
            draft: t["status.draft"],
            verified: t["status.verified"],
            suspended: t["status.suspended"],
            archived: t["status.archived"],
          },
        }}
      />
    </WorkspacePage>
  );
}
