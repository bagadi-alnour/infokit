import Link from "next/link";
import { and, count, desc, eq, isNull } from "drizzle-orm";

import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { Icon } from "~/components/icons";
import {
  Card,
  Chip,
  EmptyState,
  PageHeader,
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TD,
  TH,
} from "~/components/admin/workspace";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { db } from "~/server/db";
import {
  activities,
  organizations,
  organizationSpecialities,
} from "~/server/db/schema";

const statusTone = {
  draft: "neutral",
  verified: "ok",
  suspended: "warn",
  archived: "neutral",
} as const;

export default async function OrganizationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const t = await loadPageCatalog(locale, "dashboard-console");

  const rows = await db
    .select({
      id: organizations.id,
      displayName: organizations.displayName,
      slug: organizations.slug,
      status: organizations.status,
      createdAt: organizations.createdAt,
      activityCount: count(activities.id),
    })
    .from(organizations)
    .leftJoin(
      activities,
      and(
        eq(activities.organizationId, organizations.id),
        isNull(activities.archivedAt),
      ),
    )
    .groupBy(organizations.id)
    .orderBy(desc(organizations.createdAt));

  const specialityCounts = new Map(
    (
      await db
        .select({
          organizationId: organizationSpecialities.organizationId,
          n: count(),
        })
        .from(organizationSpecialities)
        .where(isNull(organizationSpecialities.retiredAt))
        .groupBy(organizationSpecialities.organizationId)
    ).map((row) => [row.organizationId, row.n]),
  );

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <>
      <PageHeader
        title={t["table.organization"] + "s"}
        action={
          <Link
            href={localizedPath("/dashboard/organizations/new", locale)}
            className="bg-brand hover:bg-brand-hover inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-sm font-semibold text-white"
          >
            <Icon name="plus" size={16} />
            {t["org.newTitle"]}
          </Link>
        }
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState>{t["empty.organizations"]}</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TH>{t["table.name"]}</TH>
                <TH>{t["table.status"]}</TH>
                <TH className="text-end">{t["section.specialities"]}</TH>
                <TH className="text-end">{t["section.activities"]}</TH>
                <TH>{t["table.created"]}</TH>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((org) => (
                <TableRow key={org.id}>
                  <TD>
                    <Link
                      href={localizedPath(
                        `/dashboard/organizations/${org.id}`,
                        locale,
                      )}
                      className="font-medium hover:underline"
                    >
                      {org.displayName}
                    </Link>
                    <p className="text-copy-muted text-xs">{org.slug}</p>
                  </TD>
                  <TD>
                    <Chip tone={statusTone[org.status]}>
                      {t[`status.${org.status}`]}
                    </Chip>
                  </TD>
                  <TD className="text-end tabular-nums">
                    {specialityCounts.get(org.id) ?? 0}
                  </TD>
                  <TD className="text-end tabular-nums">{org.activityCount}</TD>
                  <TD className="text-copy-muted text-xs">
                    {dateFormat.format(org.createdAt)}
                  </TD>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
