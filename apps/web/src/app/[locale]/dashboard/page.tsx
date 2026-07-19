import Link from "next/link";
import {
  and,
  asc,
  count,
  eq,
  gte,
  isNull,
  lt,
  lte,
  notExists,
  or,
} from "drizzle-orm";

import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { PendingButton } from "~/components/pending-button";
import { Card, Chip, EmptyState, PageHeader } from "~/components/ui";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { freshnessOf, isSameParisDay, parisToday } from "~/lib/freshness";
import { db } from "~/server/db";
import {
  organizations,
  places,
  scheduleExceptions,
  scheduleRules,
  services,
  serviceTranslations,
} from "~/server/db/schema";
import {
  cancelServiceToday,
  confirmServiceToday,
  markServiceUncertain,
  undoCancelServiceToday,
} from "./actions";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type TodayEntry = {
  id: string;
  name: string;
  org: string;
  windows: string[];
  confirmedAt: Date | null;
  cancelled: boolean;
  uncertain: boolean;
};

/**
 * Everything scheduled today (Europe/Paris): the proactive freshness loop.
 * Confirming an activity re-stamps verification the same day, so the public
 * "last verified" is never older than the activity it describes.
 */
async function loadToday(): Promise<TodayEntry[]> {
  const today = parisToday();
  const rows = await db
    .select({
      id: services.id,
      name: serviceTranslations.name,
      org: organizations.displayName,
      start: scheduleRules.startTime,
      end: scheduleRules.endTime,
      lastVerifiedAt: services.lastVerifiedAt,
      manualStatus: services.manualStatus,
    })
    .from(scheduleRules)
    .innerJoin(services, eq(scheduleRules.serviceId, services.id))
    .leftJoin(
      serviceTranslations,
      and(
        eq(serviceTranslations.serviceId, services.id),
        eq(serviceTranslations.languageCode, "fr"),
      ),
    )
    .leftJoin(organizations, eq(services.organizationId, organizations.id))
    .where(
      and(
        eq(scheduleRules.weekday, today.weekday),
        isNull(services.archivedAt),
        or(
          isNull(scheduleRules.validFrom),
          lte(scheduleRules.validFrom, today.isoDate),
        ),
        or(
          isNull(scheduleRules.validTo),
          gte(scheduleRules.validTo, today.isoDate),
        ),
      ),
    )
    .orderBy(asc(scheduleRules.startTime));

  const cancelledToday = new Set(
    (
      await db
        .select({ serviceId: scheduleExceptions.serviceId })
        .from(scheduleExceptions)
        .where(
          and(
            eq(scheduleExceptions.date, today.isoDate),
            eq(scheduleExceptions.kind, "cancellation"),
          ),
        )
    ).map((row) => row.serviceId),
  );

  const byService = new Map<string, TodayEntry>();
  for (const row of rows) {
    const window = `${row.start.slice(0, 5)}–${row.end.slice(0, 5)}`;
    const existing = byService.get(row.id);
    if (existing) {
      existing.windows.push(window);
      continue;
    }
    byService.set(row.id, {
      id: row.id,
      name: row.name ?? "(no name)",
      org: row.org ?? "—",
      windows: [window],
      confirmedAt: isSameParisDay(row.lastVerifiedAt)
        ? row.lastVerifiedAt
        : null,
      cancelled: cancelledToday.has(row.id),
      uncertain: row.manualStatus === "uncertain",
    });
  }
  return [...byService.values()];
}

type AttentionKind =
  "never" | "overdue" | "due_soon" | "uncertain" | "noSchedule" | "missingFr";

type AttentionItem = {
  id: string;
  name: string;
  org: string;
  kind: AttentionKind;
  confirmable: boolean;
};

/** The queue that keeps data honest: stale, uncertain, or unpublishable. */
async function loadAttention(): Promise<AttentionItem[]> {
  const weekAhead = new Date(Date.now() + WEEK_MS);
  const base = {
    id: services.id,
    name: serviceTranslations.name,
    org: organizations.displayName,
    lastVerifiedAt: services.lastVerifiedAt,
    reviewDueAt: services.reviewDueAt,
    manualStatus: services.manualStatus,
  };
  const nameJoin = and(
    eq(serviceTranslations.serviceId, services.id),
    eq(serviceTranslations.languageCode, "fr"),
  );

  const stale = await db
    .select(base)
    .from(services)
    .leftJoin(serviceTranslations, nameJoin)
    .leftJoin(organizations, eq(services.organizationId, organizations.id))
    .where(
      and(
        isNull(services.archivedAt),
        or(
          isNull(services.lastVerifiedAt),
          lt(services.reviewDueAt, weekAhead),
          eq(services.manualStatus, "uncertain"),
        ),
      ),
    )
    .orderBy(asc(services.reviewDueAt))
    .limit(10);

  const structuralWhere = (missing: "schedule" | "fr") =>
    and(
      isNull(services.archivedAt),
      eq(services.published, true),
      missing === "schedule"
        ? notExists(
            db
              .select()
              .from(scheduleRules)
              .where(eq(scheduleRules.serviceId, services.id)),
          )
        : notExists(
            db
              .select()
              .from(serviceTranslations)
              .where(
                and(
                  eq(serviceTranslations.serviceId, services.id),
                  eq(serviceTranslations.languageCode, "fr"),
                ),
              ),
          ),
    );

  const [noSchedule, missingFr] = await Promise.all([
    db
      .select(base)
      .from(services)
      .leftJoin(serviceTranslations, nameJoin)
      .leftJoin(organizations, eq(services.organizationId, organizations.id))
      .where(structuralWhere("schedule"))
      .limit(5),
    db
      .select(base)
      .from(services)
      .leftJoin(serviceTranslations, nameJoin)
      .leftJoin(organizations, eq(services.organizationId, organizations.id))
      .where(structuralWhere("fr"))
      .limit(5),
  ]);

  const items = new Map<string, AttentionItem>();
  const push = (
    row: (typeof stale)[number],
    kind: AttentionKind,
    confirmable: boolean,
  ) => {
    if (items.has(row.id)) return;
    items.set(row.id, {
      id: row.id,
      name: row.name ?? "(no name)",
      org: row.org ?? "—",
      kind,
      confirmable,
    });
  };

  for (const row of noSchedule) push(row, "noSchedule", false);
  for (const row of missingFr) push(row, "missingFr", false);
  for (const row of stale) {
    if (row.manualStatus === "uncertain") {
      push(row, "uncertain", true);
      continue;
    }
    const freshness = freshnessOf(row);
    if (freshness === "never") push(row, "never", true);
    else if (freshness === "overdue") push(row, "overdue", true);
    else if (freshness === "due_soon") push(row, "due_soon", true);
  }
  return [...items.values()].slice(0, 10);
}

async function loadStats(weekAhead: Date) {
  const [orgs] = await db.select({ n: count() }).from(organizations);
  const [placeRows] = await db.select({ n: count() }).from(places);
  const [svc] = await db
    .select({ n: count() })
    .from(services)
    .where(isNull(services.archivedAt));
  const [published] = await db
    .select({ n: count() })
    .from(services)
    .where(and(isNull(services.archivedAt), eq(services.published, true)));
  const [due] = await db
    .select({ n: count() })
    .from(services)
    .where(
      and(
        isNull(services.archivedAt),
        or(
          isNull(services.lastVerifiedAt),
          lt(services.reviewDueAt, weekAhead),
        ),
      ),
    );
  return {
    orgs: orgs?.n ?? 0,
    places: placeRows?.n ?? 0,
    services: svc?.n ?? 0,
    published: published?.n ?? 0,
    due: due?.n ?? 0,
  };
}

const attentionTone: Record<AttentionKind, "warn" | "danger"> = {
  never: "warn",
  overdue: "danger",
  due_soon: "warn",
  uncertain: "warn",
  noSchedule: "danger",
  missingFr: "danger",
};

export default async function DashboardOverview({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const t = await loadPageCatalog(locale, "dashboard-overview");
  const [todayEntries, attention, stats] = await Promise.all([
    loadToday(),
    loadAttention(),
    loadStats(new Date(Date.now() + WEEK_MS)),
  ]);

  const dateLabel = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone: "Europe/Paris",
  }).format(new Date());
  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
  const servicePath = (id: string) =>
    localizedPath(`/dashboard/services/${id}`, locale);

  const hiddenFields = (serviceId: string) => (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="serviceId" value={serviceId} />
    </>
  );

  const statCards = [
    {
      label: t["stats.organizations"],
      value: stats.orgs,
      href: "/dashboard/organizations",
    },
    {
      label: t["stats.places"],
      value: stats.places,
      href: "/dashboard/places",
    },
    {
      label: t["stats.services"],
      value: stats.services,
      href: "/dashboard/services",
    },
    {
      label: t["stats.published"],
      value: stats.published,
      href: "/dashboard/services",
    },
    {
      label: t["stats.dueThisWeek"],
      value: stats.due,
      href: "/dashboard/services",
    },
  ];

  return (
    <>
      <PageHeader title={t["overview.title"]} sub={dateLabel} />
      <div className="grid gap-4">
        <Card title={t["today.title"]}>
          <p className="text-muted -mt-1 mb-3 text-xs">{t["overview.sub"]}</p>
          {todayEntries.length === 0 ? (
            <EmptyState>{t["today.empty"]}</EmptyState>
          ) : (
            <ul className="divide-line divide-y">
              {todayEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5"
                >
                  <div className="min-w-0">
                    <Link
                      href={servicePath(entry.id)}
                      className="text-sm font-medium hover:underline"
                    >
                      {entry.name}
                    </Link>
                    <p className="text-muted text-xs">
                      {entry.org} ·{" "}
                      <span className="tabular-nums">
                        {entry.windows.join(", ")}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {entry.cancelled ? (
                      <>
                        <Chip tone="danger">{t["today.cancelled"]}</Chip>
                        <form action={undoCancelServiceToday}>
                          {hiddenFields(entry.id)}
                          <PendingButton variant="secondary">
                            {t["today.undo"]}
                          </PendingButton>
                        </form>
                      </>
                    ) : (
                      <>
                        {entry.uncertain ? (
                          <Chip tone="warn">{t["today.uncertain"]}</Chip>
                        ) : null}
                        {entry.confirmedAt ? (
                          <Chip tone="ok">
                            <span className="tabular-nums">{`${t["today.confirmed"]} · ${timeFormat.format(entry.confirmedAt)}`}</span>
                          </Chip>
                        ) : (
                          <>
                            <form action={confirmServiceToday}>
                              {hiddenFields(entry.id)}
                              <PendingButton>
                                {t["today.confirm"]}
                              </PendingButton>
                            </form>
                            {!entry.uncertain ? (
                              <form action={markServiceUncertain}>
                                {hiddenFields(entry.id)}
                                <PendingButton variant="ghost">
                                  {t["today.uncertain"]}
                                </PendingButton>
                              </form>
                            ) : null}
                          </>
                        )}
                        <form action={cancelServiceToday}>
                          {hiddenFields(entry.id)}
                          <PendingButton variant="ghost">
                            {t["today.cancel"]}
                          </PendingButton>
                        </form>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t["attention.title"]}>
          {attention.length === 0 ? (
            <EmptyState>{t["attention.empty"]}</EmptyState>
          ) : (
            <ul className="divide-line divide-y">
              {attention.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5"
                >
                  <div className="min-w-0">
                    <Link
                      href={servicePath(item.id)}
                      className="text-sm font-medium hover:underline"
                    >
                      {item.name}
                    </Link>
                    <p className="text-muted text-xs">{item.org}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Chip tone={attentionTone[item.kind]}>
                      {t[`attention.${item.kind}`]}
                    </Chip>
                    {item.confirmable ? (
                      <form action={confirmServiceToday}>
                        {hiddenFields(item.id)}
                        <PendingButton variant="secondary">
                          {t["attention.confirm"]}
                        </PendingButton>
                      </form>
                    ) : null}
                    <Link
                      href={servicePath(item.id)}
                      className="text-accent px-1 text-sm font-semibold"
                    >
                      {t["attention.open"]}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {statCards.map((stat) => (
            <Link key={stat.label} href={localizedPath(stat.href, locale)}>
              <Card className="hover:border-line-strong h-full">
                <p className="text-2xl font-semibold tabular-nums">
                  {stat.value}
                </p>
                <p className="text-muted mt-1 text-xs">{stat.label}</p>
              </Card>
            </Link>
          ))}
        </div>

        {stats.services === 0 ? (
          <Card title={t["start.title"]}>
            <ol className="text-muted list-inside list-decimal space-y-1 text-sm">
              <li>{t["start.orgs"]}</li>
              <li>{t["start.places"]}</li>
              <li>{t["start.services"]}</li>
              <li>{t["start.source"]}</li>
            </ol>
          </Card>
        ) : null}
      </div>
    </>
  );
}
