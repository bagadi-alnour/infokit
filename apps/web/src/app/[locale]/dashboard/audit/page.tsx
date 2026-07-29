import { formatMessage } from "@infokit/shared/i18n";
import { loadCatalog, loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import Link from "next/link";

import { AuditDeliveriesTable } from "~/components/admin/audit-deliveries-table";
import { AuditEventsTable } from "~/components/admin/audit-events-table";
import {
  Button,
  Card,
  Chip,
  ControlField,
  Field,
  FilterBar,
  Notice,
  PageHeader,
  Select,
  Stat,
  StatGrid,
  TextInput,
  WorkspacePage,
} from "~/components/admin/workspace";
import { DatePicker } from "~/components/ui/date-picker";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import {
  AUDIT_OUTCOMES,
  AUDIT_SEVERITIES,
  AUDIT_VIEWS,
  DELIVERY_CHANNELS,
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
  auditOrganizations,
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
  if (scope === null) {
    await denyPageAccess(AUDIT_PERMISSION, locale);
    // `denyPageAccess` redirects, which throws; this only tells the compiler so.
    return null;
  }

  // The ledger is fetched inside the same round as the filter's own lookups, and
  // tagged with which one it is so the union narrows below.
  const [organizations, stats, actionNames, ledger] = await Promise.all([
    auditOrganizations(scope),
    auditStats(scope),
    auditActionNames(scope),
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
  // An organisation filter is only a question for a reader who can see more than
  // one owner in the first place.
  const showOrganizationFilter = scope.platform || organizations.length > 1;

  return (
    <WorkspacePage>
      <PageHeader
        title={t["audit.title"]}
        sub={t["audit.description"]}
        badges={
          <Chip tone="accent">
            {scope.platform
              ? t["audit.scope.platform"]
              : t["audit.scope.organizations"]}
          </Chip>
        }
      />

      <Notice tone="warn" title={t["audit.notice.privacyTitle"]}>
        {t["audit.notice.privacyBody"]}
      </Notice>

      <StatGrid>
        <Stat
          label={t["audit.stat.events"]}
          value={stats.events}
          hint={formatMessage(t["audit.stat.eventsHint"], {
            days: String(stats.windowDays),
          })}
        />
        <Stat
          label={t["audit.stat.denied"]}
          value={stats.denied}
          hint={t["audit.stat.deniedHint"]}
        />
        <Stat
          label={t["audit.stat.failures"]}
          value={stats.failures}
          hint={t["audit.stat.failuresHint"]}
        />
        <Stat
          label={t["audit.stat.deliveries"]}
          value={stats.failedDeliveries}
          hint={t["audit.stat.deliveriesHint"]}
        />
      </StatGrid>

      {/* The two ledgers of the same trail; the chosen one is in the URL. */}
      <div
        role="group"
        aria-label={t["audit.view"]}
        className="border-line bg-subtle mb-4 inline-flex items-center gap-1 rounded-full border p-1"
      >
        {AUDIT_VIEWS.map((view) => {
          const active = view === query.view;
          return (
            <Link
              key={view}
              href={href(view)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex min-h-8 items-center rounded-full px-3 text-sm font-medium",
                active
                  ? "bg-surface text-ink shadow-ring"
                  : "text-copy-muted hover:text-ink",
              )}
            >
              {t[`audit.view.${view}`]}
            </Link>
          );
        })}
      </div>

      <FilterBar
        action={basePath}
        submitLabel={console_["console.filter.apply"]}
      >
        {/* Which ledger travels with the filters; there is no `page` input, so
         * narrowing the list always lands on its first page. */}
        <input type="hidden" name="view" value={query.view} />

        <div className="min-w-44">
          <Field label={t["audit.filter.actor"]}>
            <TextInput
              name="actor"
              defaultValue={query.actor}
              placeholder={t["audit.filter.actorPlaceholder"]}
              maxLength={120}
            />
          </Field>
        </div>

        <div className="min-w-44">
          <Field
            label={
              query.view === "deliveries"
                ? t["audit.delivery.column.template"]
                : t["audit.filter.action"]
            }
          >
            <Select name="action" defaultValue={query.action}>
              <option value="">{t["audit.filter.anyAction"]}</option>
              {/* A family first (`member.`), then the names inside it: eleven
               * `member.*` rows are usually one question, not eleven. */}
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
          </Field>
        </div>

        {query.view === "events" ? (
          <>
            <div className="min-w-44">
              <Field label={t["audit.filter.subject"]}>
                <TextInput
                  name="subject"
                  defaultValue={query.subject}
                  placeholder={t["audit.filter.subjectPlaceholder"]}
                  maxLength={120}
                />
              </Field>
            </div>
            <div className="min-w-36">
              <Field label={t["audit.filter.outcome"]}>
                <Select name="outcome" defaultValue={query.outcome}>
                  <option value="">{t["audit.filter.anyOutcome"]}</option>
                  {AUDIT_OUTCOMES.map((outcome) => (
                    <option key={outcome} value={outcome}>
                      {t[`audit.outcome.${outcome}`]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="min-w-36">
              <Field label={t["audit.filter.severity"]}>
                <Select name="severity" defaultValue={query.severity}>
                  <option value="">{t["audit.filter.anySeverity"]}</option>
                  {AUDIT_SEVERITIES.map((severity) => (
                    <option key={severity} value={severity}>
                      {t[`audit.severity.${severity}`]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </>
        ) : (
          <>
            <div className="min-w-36">
              <Field label={t["audit.filter.channel"]}>
                <Select name="channel" defaultValue={query.channel}>
                  <option value="">{t["audit.filter.anyChannel"]}</option>
                  {DELIVERY_CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      {t[`audit.channel.${channel}`]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="min-w-36">
              <Field label={t["audit.filter.status"]}>
                <Select name="status" defaultValue={query.status}>
                  <option value="">
                    {console_["console.filter.anyStatus"]}
                  </option>
                  {DELIVERY_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t[`audit.status.${status}`]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="min-w-52">
              {/* Typed in full, hashed, matched against the stored fingerprint:
               * the address itself is never written down anywhere. */}
              <Field
                label={t["audit.filter.recipient"]}
                hint={t["audit.filter.recipientHint"]}
              >
                <TextInput
                  name="recipient"
                  type="email"
                  defaultValue={query.recipient}
                  placeholder={t["audit.filter.recipientPlaceholder"]}
                  maxLength={120}
                />
              </Field>
            </div>
          </>
        )}

        {showOrganizationFilter ? (
          <div className="min-w-44">
            <Field label={console_["table.organization"]}>
              <Select name="org" defaultValue={query.organizationId}>
                <option value="">{console_["console.filter.allOrgs"]}</option>
                {scope.platform ? (
                  <option value={PLATFORM_OWNER_VALUE}>
                    {platformOwnerLabel}
                  </option>
                ) : null}
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}

        <ControlField
          label={t["audit.filter.from"]}
          htmlFor="audit-from"
          hint={t["audit.filter.timezoneHint"]}
        >
          <DatePicker
            id="audit-from"
            name="from"
            locale={locale}
            defaultValue={query.from}
            placeholder={t["audit.filter.datePlaceholder"]}
            clearLabel={console_["console.clearDate"]}
          />
        </ControlField>
        <ControlField label={t["audit.filter.to"]} htmlFor="audit-to">
          <DatePicker
            id="audit-to"
            name="to"
            locale={locale}
            defaultValue={query.to}
            placeholder={t["audit.filter.datePlaceholder"]}
            clearLabel={console_["console.clearDate"]}
          />
        </ControlField>

        {hasAuditFilters(query) ? (
          <Button
            variant="ghost"
            render={
              <Link
                href={`${basePath}${auditQueryString(EMPTY_AUDIT_QUERY, {
                  view: query.view,
                })}`}
              />
            }
          >
            {t["audit.filter.clear"]}
          </Button>
        ) : null}
      </FilterBar>

      <Card
        hint={
          ledger.view === "deliveries"
            ? t["audit.delivery.recipientHint"]
            : undefined
        }
      >
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
              {formatMessage(console_["table.results"], {
                shown: String(shown),
                total: String(total),
              })}{" "}
              ·{" "}
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
