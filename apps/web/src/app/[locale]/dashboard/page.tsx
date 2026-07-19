import Link from "next/link";
import { count, eq, isNull } from "drizzle-orm";

import { Card, PageHeader } from "~/components/ui";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { db } from "~/server/db";
import { organizations, places, services } from "~/server/db/schema";

async function counts() {
  const [orgs] = await db.select({ n: count() }).from(organizations);
  const [placeRows] = await db.select({ n: count() }).from(places);
  const [svc] = await db.select({ n: count() }).from(services);
  const [published] = await db
    .select({ n: count() })
    .from(services)
    .where(eq(services.published, true));
  const [unverified] = await db
    .select({ n: count() })
    .from(services)
    .where(isNull(services.lastVerifiedAt));
  return {
    orgs: orgs?.n ?? 0,
    places: placeRows?.n ?? 0,
    services: svc?.n ?? 0,
    published: published?.n ?? 0,
    unverified: unverified?.n ?? 0,
  };
}

export default async function DashboardOverview({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const c = await counts();
  const stats = [
    {
      label: "Organisations",
      value: c.orgs,
      href: localizedPath("/dashboard/organizations", locale),
    },
    {
      label: "Places",
      value: c.places,
      href: localizedPath("/dashboard/places", locale),
    },
    {
      label: "Services",
      value: c.services,
      href: localizedPath("/dashboard/services", locale),
    },
    {
      label: "Published services",
      value: c.published,
      href: localizedPath("/dashboard/services", locale),
    },
    {
      label: "Awaiting verification",
      value: c.unverified,
      href: localizedPath("/dashboard/services", locale),
    },
  ];
  return (
    <>
      <PageHeader
        title="Overview"
        sub="Create real records from organisations' public channels; mark them verified only after checking with the organisation."
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:border-line-strong h-full">
              <p className="text-2xl font-semibold tabular-nums">
                {stat.value}
              </p>
              <p className="text-muted mt-1 text-xs">{stat.label}</p>
            </Card>
          </Link>
        ))}
      </div>
      <Card title="Getting started" className="mt-6">
        <ol className="text-muted list-inside list-decimal space-y-1 text-sm">
          <li>
            Create the <strong className="text-ink">organisation</strong>{" "}
            (status “verified” only after a real check).
          </li>
          <li>
            Add its <strong className="text-ink">places</strong> — choose how
            precisely each location may be published.
          </li>
          <li>
            Create <strong className="text-ink">services</strong> with
            schedules, then verify and publish.
          </li>
          <li>
            Record where each fact came from in{" "}
            <strong className="text-ink">source note</strong> — unverified seeds
            stay honest.
          </li>
        </ol>
      </Card>
    </>
  );
}
