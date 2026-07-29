// The console's stylesheet, kept off the public pages (src/styles/globals.css).
import "~/styles/workspace.css";

import { localeMetadata, type Locale } from "@infokit/shared/i18n";
import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";
import { and, count, eq, ilike, inArray, isNull, ne, or } from "drizzle-orm";
import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import {
  AdminCommandSearch,
  type CommandSearchGroup,
} from "~/components/admin/admin-command-search";
import {
  AdminNotifications,
  type AttentionItem,
} from "~/components/admin/admin-notifications";
import {
  AdminUIProvider,
  PermissionDeniedNotice,
} from "~/components/admin/admin-ui-provider";
import { AdminUserMenu } from "~/components/admin/admin-user-menu";
import {
  SidebarCreateMenu,
  type SidebarCreateAction,
} from "~/components/admin/sidebar-create-menu";
import { Icon } from "~/components/icons";
import { BrandMark, BrandWordmark } from "~/components/public/brand-mark";
import { Toaster } from "~/components/ui/sonner";
import { env } from "~/env";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { attentionKindOf, type AttentionKind } from "~/lib/freshness";
import { auditScope } from "~/server/audit/query";
import { requireEditor } from "~/server/auth/require";
import {
  activityWorkspacePermissions,
  articleWorkspacePermissions,
  hasActualPlatformPermission,
  isPlatformAdmin,
  ownedWithin,
  permissionScopeAny,
  platformPermissionsForUser,
  platformStaffPermission,
} from "~/server/auth/authorization";
import { COORDINATION_MANAGE_PERMISSION } from "~/server/content/coordination-events";
import { db } from "~/server/db";
import {
  activities,
  activityTranslations,
  organizationMembers,
  organizations,
  scheduleRules,
} from "~/server/db/schema";
import { memberDirectoryScope } from "~/server/members";
import { DashboardNav, type DashboardNavGroup } from "./nav";

/** Worst first: an editor opening the bell reads the queue top to bottom. */
const attentionSeverity: Record<AttentionKind, number> = {
  never: 0,
  overdue: 1,
  uncertain: 2,
  noSchedule: 3,
  dueSoon: 4,
};

/** Longest visible queue; the rest stays behind the runbook link. */
const ATTENTION_LIMIT = 12;

function initialsOf(label: string) {
  return (
    label
      .split(/\s+/)
      .map((part) => part.slice(0, 1))
      .join("")
      .slice(0, 2) || "E"
  );
}

function activityLabel(
  rows: readonly { languageCode: string; name: string }[],
  locale: Locale,
  fallback: string,
) {
  return (
    rows.find((row) => row.languageCode === locale)?.name ??
    rows.find((row) => row.languageCode === "fr")?.name ??
    rows[0]?.name ??
    fallback
  );
}

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
};

export default async function DashboardLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const locale = requireRouteLocale((await params).locale);
  const direction = localeMetadata[locale].direction;
  const user = await requireEditor(locale);
  const messages = await loadPageCatalog(locale, "dashboard-layout");

  /**
   * What this editor may open, resolved before anything is counted, because the
   * activity badge and the attention bell are themselves a list of rows and have
   * to stay inside the same scope as the page they link into.
   *
   * Each question is asked the way the thing behind it asks:
   *
   * - The workspace scopes come from the same resolver the list pages use, so an
   *   entry appears exactly when that page will let this account in.
   * - The create entries read **platform** grants only, because that is all
   *   `protectedPermissionAction` accepts — it cannot know which organisation a
   *   form targets, so a membership grant does not pass it
   *   (server/auth/require.ts). A "+ New" that leads to a refusal is worse than
   *   no button at all.
   *
   * One read of the platform set answers the four write questions; asking
   * `hasActualPlatformPermission` four times would run the same join four times.
   */
  const [activityScope, articleScope, platformGrants] = await Promise.all([
    permissionScopeAny(user.id, activityWorkspacePermissions),
    permissionScopeAny(user.id, articleWorkspacePermissions),
    platformPermissionsForUser(user.id),
  ]);
  const canCreateActivity = platformGrants.has("content.activity.manage");
  const canCreateArticle = platformGrants.has("content.article.write");
  const canCreateEvent = platformGrants.has(COORDINATION_MANAGE_PERMISSION);
  const simulatorAccess = platformGrants.has("content.simulator.review");

  const [
    organizationCountRows,
    membershipRows,
    demoOrganizationRows,
    activityRows,
    scheduledActivityRows,
    platformAdmin,
    auditAccess,
    memberDirectoryAccess,
    staffAccess,
  ] = await Promise.all([
    // A number, not a list. How many associations exist is directory knowledge;
    // their names are the directory itself, and the sidebar is not the place an
    // editor without the directory learns them.
    db.select({ value: count() }).from(organizations),
    // Which associations this editor belongs to, so the directory entry can
    // become a link to their own record and the user menu can name the space
    // they are working in. Offboarded rows stay in the table as history and
    // must not count as a membership.
    db
      .select({
        id: organizationMembers.organizationId,
        name: organizations.displayName,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationMembers.organizationId),
      )
      .where(
        and(
          eq(organizationMembers.userId, user.id),
          ne(organizationMembers.status, "offboarded"),
        ),
      ),
    // The demo tripwire, asked as an existence check so it does not need every
    // name to find one. Both spellings, because `ilike` folds case but not
    // accents and the demo seed writes "démo" as well as "demo".
    db
      .select({ id: organizations.id })
      .from(organizations)
      .where(
        or(
          ilike(organizations.displayName, "%demo%"),
          ilike(organizations.displayName, "%démo%"),
        ),
      )
      .limit(1),
    // The same rows answer two questions: how many activities the sidebar
    // badge shows, and which of them are waiting on a confirmation. Both are
    // statements about rows, so both are scoped: a badge reading 40 when this
    // editor administers 3 is a headcount of somebody else's work, and the bell
    // names the record it links to.
    activityScope
      ? db
          .select({
            id: activities.id,
            organizationId: activities.organizationId,
            cityId: activities.cityId,
            manualStatus: activities.manualStatus,
            lastVerifiedAt: activities.lastVerifiedAt,
            reviewDueAt: activities.reviewDueAt,
          })
          .from(activities)
          .where(
            and(
              isNull(activities.archivedAt),
              ownedWithin(activities.organizationId, activityScope),
            ),
          )
      : [],
    db
      .selectDistinct({ activityId: scheduleRules.activityId })
      .from(scheduleRules),
    isPlatformAdmin(user.id),
    // Asked the same way the pages themselves ask, so an entry appears exactly
    // for the editors that page will let in — a link that answers "permission
    // denied" teaches nothing except that the sidebar is not to be trusted.
    auditScope(user.id),
    memberDirectoryScope(user.id),
    hasActualPlatformPermission(user.id, platformStaffPermission),
  ]);

  const organizationCount = organizationCountRows[0]?.value ?? 0;
  /**
   * Who gets the directory, decided exactly as the directory page decides it
   * (organizations/page.tsx): listing every association is administration.
   */
  const directoryAccess = platformAdmin;
  /**
   * The one record a non-directory editor would be sent to anyway. With several
   * memberships there is no "mine", so those editors keep the list — it is the
   * only place that disambiguates.
   */
  const ownOrganization = directoryAccess
    ? null
    : membershipRows.length === 1
      ? (membershipRows[0] ?? null)
      : null;
  const ownOrganizationId = ownOrganization?.id ?? null;
  const organizationHref = ownOrganizationId
    ? localizedPath(`/dashboard/organizations/${ownOrganizationId}`, locale)
    : localizedPath("/dashboard/organizations", locale);

  /**
   * The freshness queue, classified by the one shared function the runbook also
   * calls (`~/lib/freshness`, `docs/DESIGN-BRIEF.md` §11), so the bell and the
   * runbook cannot disagree about why a record is waiting. The bell stays
   * console-wide on purpose — it is reachable from pages that have no scope —
   * while the runbook narrows the same queue to the city being worked.
   */
  const scheduledActivityIds = new Set(
    scheduledActivityRows.map((row) => row.activityId),
  );
  const attentionEntries = activityRows
    .map((activity) => {
      const kind = attentionKindOf({
        ...activity,
        hasSchedule: scheduledActivityIds.has(activity.id),
      });
      return kind ? { activity, kind } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort(
      (left, right) =>
        attentionSeverity[left.kind] - attentionSeverity[right.kind],
    );
  const visibleAttention = attentionEntries.slice(0, ATTENTION_LIMIT);
  const attentionNameRows = visibleAttention.length
    ? await db
        .select({
          activityId: activityTranslations.activityId,
          languageCode: activityTranslations.languageCode,
          name: activityTranslations.name,
        })
        .from(activityTranslations)
        .where(
          inArray(
            activityTranslations.activityId,
            visibleAttention.map((entry) => entry.activity.id),
          ),
        )
    : [];
  const attentionNames = new Map<
    string,
    { languageCode: string; name: string }[]
  >();
  for (const row of attentionNameRows) {
    const rows = attentionNames.get(row.activityId) ?? [];
    rows.push({ languageCode: row.languageCode, name: row.name });
    attentionNames.set(row.activityId, rows);
  }
  const attentionItems: AttentionItem[] = visibleAttention.map(
    ({ activity, kind }) => {
      const query = new URLSearchParams({ activity: activity.id });
      // A global activity has no city to scope the link to.
      if (activity.cityId) query.set("city", activity.cityId);
      if (activity.organizationId) query.set("org", activity.organizationId);
      return {
        id: activity.id,
        kind,
        label: activityLabel(
          attentionNames.get(activity.id) ?? [],
          locale,
          messages["notifications.untitled"],
        ),
        href: `${localizedPath("/dashboard/activities", locale)}?${query.toString()}`,
      };
    },
  );
  /**
   * The content this account works on, which for a platform account that holds
   * no content role is nothing at all: the technical owner staffs the platform
   * and reads the trail, and `platform_content_manager` writes
   * (server/db/seed.ts). The group is dropped rather than shown empty, so the
   * sidebar states what this editor does instead of what the console can do.
   */
  const publishItems = [
    ...(activityScope
      ? [
          {
            href: localizedPath("/dashboard/activities", locale),
            label: messages["nav.activities"],
            icon: "calendar" as const,
            count: activityRows.length,
          },
        ]
      : []),
    ...(articleScope
      ? [
          {
            href: localizedPath("/dashboard/articles", locale),
            label: messages["nav.articles"],
            icon: "article" as const,
          },
        ]
      : []),
    ...(simulatorAccess
      ? [
          {
            href: localizedPath("/dashboard/simulator", locale),
            label: messages["nav.simulator"],
            icon: "simulator" as const,
          },
        ]
      : []),
  ];
  /**
   * Grouped by what an editor is doing, not by table: today's work, the
   * content they publish, the directory those records point at, and the
   * platform catalogues. Routes that do not exist yet are left out — an
   * always-disabled link is noise, not a roadmap.
   */
  const navigation: readonly DashboardNavGroup[] = [
    {
      items: [
        {
          href: localizedPath("/dashboard", locale),
          label: messages["nav.runbook"],
          icon: "runbook",
          exact: true,
        },
        // The agenda sits with the runbook, not with publication: most events
        // never leave the network, and the ones that do are still first of all
        // something the team has to be ready for on the day.
        {
          href: localizedPath("/dashboard/events", locale),
          label: messages["nav.events"],
          icon: "event",
        },
      ],
    },
    ...(publishItems.length > 0
      ? [{ label: messages["nav.group.publish"], items: publishItems }]
      : []),
    {
      label: messages["nav.group.directory"],
      items: [
        // One entry, two meanings. An operator gets the directory; a member of
        // a single association gets their own record, named as theirs and
        // linked straight to it — the list would only redirect them there.
        {
          href: organizationHref,
          label: ownOrganizationId
            ? messages["nav.myOrganization"]
            : messages["nav.organizations"],
          icon: "organization",
          // How many organisations exist is directory knowledge; a member of
          // one association goes to their own record from here, so the total
          // would be a number they cannot act on.
          count: directoryAccess ? organizationCount : undefined,
          children: [
            {
              href: organizationHref,
              label: messages["nav.organizationProfile"],
              icon: "organization",
              exact: ownOrganizationId !== null,
            },
            ...(ownOrganizationId
              ? [
                  {
                    href: `${organizationHref}#organization-members`,
                    label: messages["nav.members"],
                    icon: "team" as const,
                    exact: true,
                  },
                ]
              : []),
            // The teams and the vocabulary they are described with appear
            // together: a member's declarations are only worth filling in once
            // there are catalogue rows to point at. The board itself is a
            // roster, so its entry needs the grant that opens one; the
            // vocabulary is about skills, not people.
            ...(env.ENABLE_PHASE3_MEMBER_ASSIGNMENTS
              ? [
                  ...(memberDirectoryAccess
                    ? [
                        {
                          href: localizedPath("/dashboard/team", locale),
                          label: messages["nav.team"],
                          icon: "team" as const,
                        },
                      ]
                    : []),
                  {
                    href: localizedPath("/dashboard/skills", locale),
                    label: messages["nav.skills"],
                    icon: "skills" as const,
                  },
                ]
              : []),
            // Places are where activities happen, and maintaining them asks for
            // the same grant as maintaining an activity (places/actions.ts).
            ...(canCreateActivity
              ? [
                  {
                    href: localizedPath("/dashboard/places", locale),
                    label: messages["nav.places"],
                    icon: "place" as const,
                  },
                ]
              : []),
          ],
        },
      ],
    },
    {
      label: messages["nav.group.platform"],
      items: [
        {
          href: localizedPath("/dashboard/catalogue", locale),
          label: messages["nav.catalogue"],
          icon: "catalogue",
        },
        ...(staffAccess
          ? [
              {
                href: localizedPath("/dashboard/staff", locale),
                label: messages["nav.staff"],
                icon: "team" as const,
              },
            ]
          : []),
        ...(auditAccess
          ? [
              {
                href: localizedPath("/dashboard/audit", locale),
                label: messages["nav.audit"],
                icon: "audit" as const,
              },
            ]
          : []),
        {
          href: localizedPath("/dashboard/account", locale),
          label: messages["nav.account"],
          icon: "settings",
        },
      ],
    },
  ];
  /**
   * Everything an editor can start from scratch, in the order they do it most.
   * The sidebar's create button and the palette's action group read from this
   * one list, so a new route can never appear in one and not the other.
   */
  const createEntries = [
    ...(canCreateActivity
      ? [
          {
            href: localizedPath("/dashboard/activities/new", locale),
            label: messages["action.newActivity"],
            icon: "calendar" as const,
            hint: messages["nav.activities"],
          },
        ]
      : []),
    ...(canCreateEvent
      ? [
          {
            href: localizedPath("/dashboard/events/new", locale),
            label: messages["action.newEvent"],
            icon: "event" as const,
            hint: messages["nav.events"],
          },
        ]
      : []),
    ...(canCreateArticle
      ? [
          {
            href: localizedPath("/dashboard/articles/new", locale),
            label: messages["action.newArticle"],
            icon: "article" as const,
            hint: messages["nav.articles"],
          },
        ]
      : []),
    ...(simulatorAccess
      ? [
          {
            href: localizedPath("/dashboard/simulator/new", locale),
            label: messages["action.newSimulatorFlow"],
            icon: "simulator" as const,
            hint: messages["nav.simulator"],
          },
        ]
      : []),
    ...(platformAdmin
      ? [
          {
            href: localizedPath("/dashboard/organizations/new", locale),
            label: messages["action.newOrganization"],
            icon: "organization" as const,
            hint: messages["nav.organizations"],
          },
        ]
      : []),
  ];
  const createActions: readonly SidebarCreateAction[] = createEntries.map(
    ({ href, label, icon }) => ({ href, label, icon }),
  );
  /**
   * The palette offers exactly what the sidebar offers, plus the create routes
   * that otherwise cost a page load first. Every entry is a link, so nothing
   * becomes reachable only by search.
   */
  const searchGroups: readonly CommandSearchGroup[] = [
    {
      label: messages["search.group.pages"],
      items: navigation.flatMap((group) =>
        group.items.flatMap((item) =>
          (item.children ?? [item]).map((entry) => ({
            href: entry.href,
            label: entry.label,
            icon: entry.icon,
            hint: item.children ? item.label : group.label,
            keywords: [
              entry.href.split(/[/?#]/).filter(Boolean).at(-1) ?? "",
              ...(item.children ? [item.label] : []),
            ],
          })),
        ),
      ),
    },
    {
      label: messages["search.group.actions"],
      items: [
        ...createEntries.map((entry) => ({
          href: entry.href,
          label: entry.label,
          icon: "plus" as const,
          hint: entry.hint,
        })),
        {
          href: localizedPath("/", locale),
          label: messages["action.publicSite"],
          icon: "external" as const,
        },
      ],
    },
  ];
  const isDemo = demoOrganizationRows.length > 0;
  const defaultSidebarOpen =
    (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <AdminUIProvider
      direction={direction}
      permissionDenied={messages["access.permissionDenied"]}
    >
      <Toaster position="top-center" closeButton />
      <PermissionDeniedNotice message={messages["access.permissionDenied"]} />
      <SidebarProvider
        defaultOpen={defaultSidebarOpen}
        className="bg-canvas text-ink"
        style={
          {
            "--sidebar-width": "15.625rem",
            "--sidebar-width-icon": "3.5rem",
          } as React.CSSProperties
        }
      >
        <Sidebar
          side={direction === "rtl" ? "right" : "left"}
          collapsible="icon"
          dir={direction}
          mobileTitle={messages["auth.dashboard.console"]}
          mobileDescription={messages["sidebar.mobileDescription"]}
          className="border-line bg-subtle"
        >
          {/* Read top to bottom: which product this is, then the one verb that
           * starts something new. Navigation begins below that, so the two
           * answers an editor needs on arrival never move. */}
          <SidebarHeader className="gap-3 px-3 pt-3">
            <Link
              href={localizedPath("/dashboard", locale)}
              className="focus-visible:ring-brand/50 flex h-10 items-center gap-2.5 overflow-hidden rounded-lg outline-none focus-visible:ring-2 group-data-[collapsible=icon]:justify-center"
            >
              {/* Collapsed to icons, the mark alone stands in for the logo;
               * the full wordmark returns with the other labels. */}
              <BrandMark
                size={32}
                className="hidden group-data-[collapsible=icon]:block"
              />
              <span className="grid min-w-0 group-data-[collapsible=icon]:hidden">
                <BrandWordmark className="text-[1.0625rem] leading-tight" />
                <span className="text-copy-muted truncate text-[11px] font-medium leading-tight">
                  {messages["auth.dashboard.console"]}
                </span>
              </span>
            </Link>
            <SidebarCreateMenu
              label={messages["nav.create"]}
              actions={createActions}
            />
          </SidebarHeader>
          <SidebarSeparator className="mt-1" />
          <SidebarContent>
            <DashboardNav
              ariaLabel={messages["auth.dashboard.console"]}
              groups={navigation}
            />
            {/* The one banner that scrolls with the navigation rather than
             * sitting in the footer: on a short window a fixed footer squeezed
             * the nav down to a sliver. */}
            {isDemo ? (
              <div className="mt-auto px-3 pb-3 group-data-[collapsible=icon]:hidden">
                <div className="border-warn/50 bg-warn-soft text-warn flex gap-2.5 rounded-lg border p-3 text-sm font-medium">
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden
                  />
                  <span>{messages["demo.warning"]}</span>
                </div>
              </div>
            ) : null}
          </SidebarContent>
          {/* One short row, always visible: the console edits what the public
           * site shows, so the way to go look at it should not scroll away. */}
          <SidebarFooter className="px-3 pb-3 pt-1 group-data-[collapsible=icon]:px-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href={localizedPath("/", locale)} />}
                  // Collapsed, this row is a lone arrow glyph; the tooltip is
                  // the only thing that says where it goes.
                  tooltip={messages["action.publicSite"]}
                  className="text-copy-muted hover:bg-surface hover:text-ink h-9 gap-2.5 rounded-lg px-2.5 text-[0.85rem] font-medium"
                >
                  <Icon name="external" size={16} className="shrink-0" />
                  <span className="truncate">
                    {messages["action.publicSite"]}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail label={messages["sidebar.toggle"]} />
        </Sidebar>

        <SidebarInset className="bg-canvas min-w-0 overflow-x-hidden">
          {/* Three things an editor needs from every page: a way back to the
           * navigation, a way to reach any page or action by typing, and the
           * queue of records waiting on them. Scope now lives with the
           * workspace identity in the sidebar, where it is set once. */}
          <header className="border-line bg-canvas/95 sticky top-0 z-40 flex min-h-16 items-center gap-2 border-b px-3 backdrop-blur md:gap-3 md:px-6">
            <SidebarTrigger
              label={messages["sidebar.toggle"]}
              className="-ms-1"
            />
            <Link
              href={localizedPath("/dashboard", locale)}
              className="focus-visible:ring-brand/50 flex items-center gap-2 rounded-lg font-semibold outline-none focus-visible:ring-2 md:hidden"
            >
              <BrandMark size={28} />
              <span className="sr-only">infoKit</span>
            </Link>
            <AdminCommandSearch
              groups={searchGroups}
              labels={{
                open: messages["search.open"],
                placeholder: messages["search.placeholder"],
                shortcut: messages["search.shortcut"],
                title: messages["search.title"],
                empty: messages["search.empty"],
              }}
            />
            <div className="ms-auto flex shrink-0 items-center gap-1">
              <AdminNotifications
                items={attentionItems}
                total={attentionEntries.length}
                reviewAllHref={localizedPath("/dashboard", locale)}
                labels={{
                  open: messages["notifications.open"],
                  title: messages["notifications.title"],
                  empty: messages["notifications.empty"],
                  reviewAll: messages["notifications.reviewAll"],
                  more: messages["notifications.more"],
                  reasons: {
                    never: messages["notifications.never"],
                    overdue: messages["notifications.overdue"],
                    uncertain: messages["notifications.uncertain"],
                    noSchedule: messages["notifications.noSchedule"],
                    dueSoon: messages["notifications.dueSoon"],
                  },
                }}
              />
              <AdminUserMenu
                locale={locale}
                name={user.name ?? messages["auth.dashboard.role.editor"]}
                email={user.email ?? null}
                initials={initialsOf(user.name ?? user.email ?? "")}
                // Which space these edits land in: the association whose
                // member this account is, or the platform itself. Read from the
                // account's own memberships, so it states a fact rather than a
                // selection someone could change.
                context={ownOrganization?.name ?? messages["scope.platform"]}
                accountHref={localizedPath("/dashboard/account", locale)}
                labels={{
                  open: messages["profile.open"],
                  account: messages["auth.dashboard.accountSecurity"],
                  language: messages["auth.language"],
                  theme: messages["ui.theme"],
                  themeLight: messages["ui.theme.light"],
                  themeDark: messages["ui.theme.dark"],
                  themeSystem: messages["ui.theme.system"],
                  signOut: messages["auth.dashboard.signOut"],
                }}
              />
            </div>
          </header>
          <div className="min-w-0">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </AdminUIProvider>
  );
}
