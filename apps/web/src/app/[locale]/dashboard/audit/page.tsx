import { formatMessage } from "@infokit/shared/i18n";
import { loadCatalog, loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import Link from "next/link";

import { AuditDeliveriesTable } from "~/components/admin/audit-deliveries-table";
import { AuditEventsTable } from "~/components/admin/audit-events-table";
import {
  Button,
  Card,
  Chip,
  Notice,
  PageHeader,
  Select,
  TextInput,
  WorkspacePage,
} from "~/components/admin/workspace";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import {
  AUDIT_OUTCOMES,
  AUDIT_VIEWS,
  DELIVERY_STATUSES,
  EMPTY_AUDIT_QUERY,
  auditQueryString,
  hasAuditFilters,
  parseAuditQuery,
  type AuditQuery,
  type AuditView,
  type RawSearchParams,
} from "~/lib/audit-filters";
import { cn } from "~/lib/utils";
import { recipientFingerprint } from "~/server/audit/deliveries";
import {
  AUDIT_PERMISSION,
  PLATFORM_OWNER_VALUE,
  auditActionFamilies,
  auditActionNames,
  auditScope,
  auditStats,
  listAuditEvents,
  listDeliveries,
  type AuditScope,
} from "~/server/audit/query";
import { recordRestrictedRead } from "~/server/audit/reads";
import { denyPageAccess, requireEditor } from "~/server/auth/require";

/**
 * Reading the trail is itself an event.
 *
 * This is the page that shows colleagues' addresses, browsers and refusals, so
 * "who has been reading it, and were they looking for one person in particular"
 * is a question the trail has to be able to answer about itself. The filters go
 * in the row because they are the difference between opening the log and
 * searching it for somebody: the free-text terms match `actor_label` and
 * `subject_label`, which this table already stores in the clear, so recording
 * them discloses nothing the reader could not read anyway.
 *
 * The recipient box is the exception. It takes a full address — the one thing
 * the delivery ledger deliberately never stores — so it is written down the way
 * that ledger writes it, as its keyed fingerprint. A review can still line the
 * lookup up with the messages it matched; nobody can read an address back out
 * of the trail.
 */
async function recordTrailRead(
  query: AuditQuery,
  scope: AuditScope,
  disclosed: number,
) {
  await recordRestrictedRead({
    action: "audit.trail.read",
    subjectType: "audit.trail",
    subjectLabel: query.view,
    // A reader narrowed to one organisation is reading that organisation's
    // trail; an unfiltered platform read belongs to no single owner.
    organizationId:
      query.organizationId && query.organizationId !== PLATFORM_OWNER_VALUE
        ? query.organizationId
        : null,
    metadata: {
      view: query.view,
      scope: scope.platform ? "platform" : "organizations",
      page: query.page,
      disclosed,
      actorTerm: query.actor || null,
      subjectTerm: query.subject || null,
      action: query.action || null,
      outcome: query.outcome || null,
      severity: query.severity || null,
      channel: query.channel || null,
      status: query.status || null,
      organizationFilter: query.organizationId || null,
      from: query.from || null,
      to: query.to || null,
      recipientLookup: query.recipient !== "",
      recipientHash: query.recipient
        ? recipientFingerprint(query.recipient)
        : null,
    },
  });
}

/**
 * The audit trail: who did what, when, from where, and whether it worked —
 * plus every message the platform handed to a provider.
 *
 * Two ledgers behind one filter. The reader's scope is decided once, by
 * `auditScope`, and every query on the page starts from it: a platform operator
 * reads everything, an association admin reads their own organisations, and
 * nobody else reaches the page at all — the refusal is itself recorded, so an
 * attempt to read the trail leaves a row in it, and so does every read that
 * succeeds (`recordTrailRead` above).
 *
 * Every filter and both views live in the query string, so a refusal somebody
 * found this morning is a link they can paste into a ticket. Nothing here can be
 * edited: an audit page with a delete button is not an audit page.
 */
export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const query = parseAuditQuery(await searchParams);
  const [t, console_] = await Promise.all([
    loadPageCatalog(locale, "dashboard-audit"),
    loadCatalog(locale, "dashboard-console"),
  ]);
  const user = await requireEditor(locale);
  const scope = await auditScope(user.id);
  // Platform scopes only, tested here as well as in the data.
  //
  // No organisation role grants `audit.read` any more (server/db/seed.ts), so
  // this is belt and braces rather than the only barrier — but the trail spans
  // organisations, and a future grant should not open it silently. Letting one
  // organisation read its own slice is a separate feature with its own redaction
  // question, not a side effect of holding a role.
  if (!scope?.platform) {
    await denyPageAccess(AUDIT_PERMISSION, locale);
    // `denyPageAccess` redirects, which throws; this only tells the compiler so.
    return null;
  }

  // The ledger is fetched inside the same round as the filter's own lookups, and
  // tagged with which one it is so the union narrows below.
  const [stats, actionNames, ledger] = await Promise.all([
    auditStats(scope),
    query.view === "events" ? auditActionNames(scope) : Promise.resolve([]),
    query.view === "deliveries"
      ? listDeliveries(scope, query).then((page) => ({
          view: "deliveries" as const,
          page,
        }))
      : listAuditEvents(scope, query).then((page) => ({
          view: "events" as const,
          page,
        })),
  ]);

  // Recorded before the rows reach the page, so a render that fails halfway
  // still leaves the evidence that the query ran and what it returned.
  await recordTrailRead(query, scope, ledger.page.rows.length);

  const basePath = localizedPath("/dashboard/audit", locale);
  const href = (view: AuditView) =>
    // Switching ledger keeps the shared filters and drops the page number: page
    // seven of the actions is not page seven of the messages.
    `${basePath}${auditQueryString(query, { view, page: 1 })}`;
  const families = auditActionFamilies(actionNames);
  const { page, pageSize, total } = ledger.page;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const shown = ledger.page.rows.length;
  const platformOwnerLabel = t["audit.owner.platform"];
  const shortcutHref = (overrides: Partial<AuditQuery>) =>
    `${basePath}${auditQueryString(EMPTY_AUDIT_QUERY, overrides)}`;
  const summaryItems = [
    {
      label: t["audit.stat.events"],
      value: stats.events,
      href: shortcutHref({ view: "events" }),
      signal: "bg-brand",
    },
    {
      label: t["audit.stat.denied"],
      value: stats.denied,
      href: shortcutHref({ view: "events", outcome: "denied" }),
      signal: "bg-danger",
    },
    {
      label: t["audit.stat.failures"],
      value: stats.failures,
      href: shortcutHref({ view: "events", outcome: "failure" }),
      signal: "bg-warn",
    },
    {
      label: t["audit.stat.deliveries"],
      value: stats.failedDeliveries,
      href: shortcutHref({ view: "deliveries", status: "failed" }),
      signal: "bg-danger",
    },
  ] as const;
  const resultsTitle =
    query.view === "deliveries"
      ? t["audit.results.deliveries"]
      : t["audit.results.events"];

  return (
    <WorkspacePage>
      <PageHeader
        title={t["audit.title"]}
        // Not a choice any more: the gate above has already refused anything
        // but a platform scope, so naming the other case here would be a branch
        // that cannot be reached. `audit.scope.organizations` stays in the
        // catalogues for whoever builds the per-organisation trail.
        badges={<Chip tone="accent">{t["audit.scope.platform"]}</Chip>}
      />

      <Notice tone="warn" title={t["audit.notice.privacyCompact"]} />

      <section
        aria-label={formatMessage(t["audit.overview.period"], {
          days: String(stats.windowDays),
        })}
        className="mb-4"
      >
        <div className="border-line bg-surface rounded-card grid overflow-hidden border sm:grid-cols-2 xl:grid-cols-4">
          {summaryItems.map((item, index) => (
            <Link
              key={item.label}
              href={item.href}
              prefetch={false}
              className={cn(
                "focus-visible:ring-brand/50 relative flex min-h-14 items-center gap-2.5 px-4 py-2.5 outline-none focus-visible:z-10 focus-visible:ring-2",
                index > 0 && "border-line border-t sm:border-t-0",
                index % 2 === 1 && "sm:border-s",
                index > 1 && "sm:border-t xl:border-t-0",
                index > 0 && "xl:border-s",
              )}
            >
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-full", item.signal)}
              />
              <span className="text-copy-muted min-w-0 flex-1 truncate text-xs font-semibold">
                {item.label}
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {item.value}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section
        aria-label={t["audit.view"]}
        className="border-line bg-surface rounded-card mb-4 overflow-hidden border"
      >
        <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
          {/* The two ledgers of the same trail; the chosen one is in the URL. */}
          <nav
            aria-label={t["audit.view"]}
            className="border-line bg-subtle grid shrink-0 grid-cols-2 rounded-lg border p-1"
          >
            {AUDIT_VIEWS.map((view) => {
              const active = view === query.view;
              return (
                <Link
                  key={view}
                  href={href(view)}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-brand/50 inline-flex min-h-9 items-center justify-center rounded-md px-3 text-center text-sm font-medium outline-none focus-visible:ring-2",
                    active
                      ? "bg-surface text-ink shadow-ring"
                      : "text-copy-muted hover:text-ink",
                  )}
                >
                  {t[`audit.view.${view}`]}
                </Link>
              );
            })}
          </nav>

          <form action={basePath} method="get" className="min-w-0 flex-1">
            {/* Which ledger travels with the filters; there is no `page` input,
             * so narrowing the list always lands on its first page. */}
            <input type="hidden" name="view" value={query.view} />

            <fieldset>
              <legend className="sr-only">{t["audit.filter.findGroup"]}</legend>
              <div className="grid items-center gap-2 md:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
                {query.view === "events" ? (
                  <>
                    <div>
                      <label htmlFor="audit-actor" className="sr-only">
                        {t["audit.filter.actor"]}
                      </label>
                      <TextInput
                        id="audit-actor"
                        name="actor"
                        defaultValue={query.actor}
                        placeholder={t["audit.filter.actorPlaceholder"]}
                        maxLength={120}
                      />
                    </div>
                    <div>
                      <label htmlFor="audit-action" className="sr-only">
                        {t["audit.filter.action"]}
                      </label>
                      <Select
                        id="audit-action"
                        name="action"
                        defaultValue={query.action}
                      >
                        <option value="">{t["audit.filter.anyAction"]}</option>
                        {/* A family first (`member.`), then the names inside it:
                         * eleven `member.*` rows are usually one question. */}
                        {families.map((family) => (
                          <option key={family} value={family}>
                            {family}
                          </option>
                        ))}
                        {actionNames.map((action) => (
                          <option key={action} value={action}>
                            {action}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label htmlFor="audit-outcome" className="sr-only">
                        {t["audit.filter.outcome"]}
                      </label>
                      <Select
                        id="audit-outcome"
                        name="outcome"
                        defaultValue={query.outcome}
                      >
                        <option value="">{t["audit.filter.anyOutcome"]}</option>
                        {AUDIT_OUTCOMES.map((outcome) => (
                          <option key={outcome} value={outcome}>
                            {t[`audit.outcome.${outcome}`]}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label htmlFor="audit-message" className="sr-only">
                        {t["audit.delivery.column.template"]}
                      </label>
                      <TextInput
                        id="audit-message"
                        name="action"
                        defaultValue={query.action}
                        placeholder={t["audit.filter.messagePlaceholder"]}
                        maxLength={120}
                      />
                    </div>
                    <div>
                      <label htmlFor="audit-status" className="sr-only">
                        {t["audit.filter.status"]}
                      </label>
                      <Select
                        id="audit-status"
                        name="status"
                        defaultValue={query.status}
                      >
                        <option value="">
                          {console_["console.filter.anyStatus"]}
                        </option>
                        {DELIVERY_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {t[`audit.status.${status}`]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {/* Typed in full, hashed, matched against the stored
                     * fingerprint: the address itself is never written down. */}
                    <div>
                      <label htmlFor="audit-recipient" className="sr-only">
                        {t["audit.filter.recipient"]}
                      </label>
                      <TextInput
                        id="audit-recipient"
                        name="recipient"
                        type="email"
                        defaultValue={query.recipient}
                        placeholder={t["audit.filter.recipientPlaceholder"]}
                        maxLength={120}
                      />
                    </div>
                  </>
                )}

                <div className="flex min-h-9 items-center justify-end gap-2">
                  {hasAuditFilters(query) ? (
                    <Button
                      variant="ghost"
                      render={
                        <Link
                          href={`${basePath}${auditQueryString(
                            EMPTY_AUDIT_QUERY,
                            {
                              view: query.view,
                            },
                          )}`}
                          prefetch={false}
                        />
                      }
                    >
                      {t["audit.filter.clear"]}
                    </Button>
                  ) : null}
                  <Button>{console_["console.filter.apply"]}</Button>
                </div>
              </div>
            </fieldset>
          </form>
        </div>
      </section>

      <Card>
        <h2 className="sr-only">{resultsTitle}</h2>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {total > 0 ? (
            <span className="text-copy-muted text-xs tabular-nums">
              {formatMessage(console_["table.results"], {
                shown: String(shown),
                total: String(total),
              })}
            </span>
          ) : null}
          {ledger.view === "deliveries" ? (
            <span className="text-copy-muted text-xs">
              {t["audit.delivery.recipientHint"]}
            </span>
          ) : null}
        </div>
        {ledger.view === "deliveries" ? (
          <AuditDeliveriesTable
            rows={ledger.page.rows}
            locale={locale}
            labels={t}
            platformOwnerLabel={platformOwnerLabel}
          />
        ) : (
          <AuditEventsTable
            rows={ledger.page.rows}
            locale={locale}
            labels={t}
            platformOwnerLabel={platformOwnerLabel}
          />
        )}

        {total > 0 ? (
          <nav
            aria-label={console_["table.page"]}
            className="border-line mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3"
          >
            <p className="text-copy-muted text-xs">
              {formatMessage(console_["table.page"], {
                page: String(page),
                pages: String(pages),
              })}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Button
                  variant="secondary"
                  render={
                    <Link
                      href={`${basePath}${auditQueryString(query, {
                        page: page - 1,
                      })}`}
                    />
                  }
                >
                  {console_["table.previousPage"]}
                </Button>
              ) : null}
              {page < pages ? (
                <Button
                  variant="secondary"
                  render={
                    <Link
                      href={`${basePath}${auditQueryString(query, {
                        page: page + 1,
                      })}`}
                    />
                  }
                >
                  {console_["table.nextPage"]}
                </Button>
              ) : null}
            </div>
          </nav>
        ) : null}
      </Card>
    </WorkspacePage>
  );
}
