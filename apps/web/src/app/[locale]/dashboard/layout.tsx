import { formatMessage, localeMetadata } from "@calais/shared/i18n";
import { loadPageCatalog } from "@calais/shared/i18n/catalogs";
import { BrandMark } from "@calais/ui";
import { and, asc, count, eq, isNull } from "drizzle-orm";
import { LogOut, TriangleAlert, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { endEditorSession } from "../login/actions";
import {
  AdminLanguageMenu,
  AdminThemeToggle,
} from "~/components/admin/admin-preferences";
import {
  AdminScopeControls,
  AdminScopeIdentity,
} from "~/components/admin/admin-scope-controls";
import {
  AdminUIProvider,
  PermissionDeniedNotice,
} from "~/components/admin/admin-ui-provider";
import { SuperadminRoleSwitcher } from "~/components/admin/superadmin-role-switcher";
import { Button } from "~/components/ui/button";
import { Toaster } from "~/components/ui/sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { requireEditor } from "~/server/auth/require";
import { getRoleTestState } from "~/server/auth/authorization";
import { db } from "~/server/db";
import {
  activities,
  cities,
  cityTeams,
  cityTranslations,
  organizations,
  roles,
} from "~/server/db/schema";
import { DashboardNav, type DashboardNavItem } from "./nav";

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
  const [
    organizationRows,
    cityRows,
    teamRows,
    activityCount,
    roleRows,
    roleTest,
  ] = await Promise.all([
    db
      .select({ id: organizations.id, name: organizations.displayName })
      .from(organizations)
      .orderBy(asc(organizations.displayName)),
    db
      .select({
        id: cities.id,
        code: cities.code,
        name: cityTranslations.name,
      })
      .from(cities)
      .leftJoin(
        cityTranslations,
        and(
          eq(cityTranslations.cityId, cities.id),
          eq(cityTranslations.languageCode, locale),
        ),
      )
      .where(eq(cities.active, true))
      .orderBy(asc(cities.code)),
    db
      .select({
        id: cityTeams.id,
        name: cityTeams.name,
        organizationId: cityTeams.organizationId,
        cityId: cityTeams.cityId,
      })
      .from(cityTeams)
      .where(eq(cityTeams.active, true)),
    db
      .select({ n: count() })
      .from(activities)
      .where(isNull(activities.archivedAt)),
    db
      .select({ id: roles.id, code: roles.code })
      .from(roles)
      .where(isNull(roles.organizationId))
      .orderBy(asc(roles.code)),
    getRoleTestState(user.id),
  ]);

  const scopeCities = cityRows.map((city) => ({
    id: city.id,
    name: city.name ?? city.code,
  }));
  const defaults = {
    organizationId: organizationRows[0]?.id,
    cityId: teamRows[0]?.cityId ?? scopeCities[0]?.id,
  };
  const navigation: readonly DashboardNavItem[] = [
    {
      href: localizedPath("/dashboard", locale),
      label: messages["nav.runbook"],
      icon: "runbook",
    },
    {
      href: localizedPath("/dashboard/activities", locale),
      label: messages["nav.activities"],
      icon: "calendar",
      count: activityCount[0]?.n ?? 0,
    },
    {
      href: localizedPath("/dashboard/team", locale),
      label: messages["nav.team"],
      icon: "team",
    },
    {
      href: localizedPath("/dashboard/articles", locale),
      label: messages["nav.articles"],
      icon: "article",
    },
    {
      href: localizedPath("/dashboard/simulator", locale),
      label: messages["nav.simulator"],
      icon: "simulator",
    },
    {
      href: localizedPath("/dashboard/events", locale),
      label: messages["nav.events"],
      icon: "event",
      disabled: true,
    },
    {
      href: localizedPath("/dashboard/contacts", locale),
      label: messages["nav.contacts"],
      icon: "contact",
      disabled: true,
    },
    {
      href: localizedPath("/dashboard/downloads", locale),
      label: messages["nav.downloads"],
      icon: "download",
      disabled: true,
    },
    {
      href: localizedPath("/dashboard/audit", locale),
      label: messages["nav.audit"],
      icon: "audit",
      disabled: true,
    },
    {
      href: localizedPath("/dashboard/translations", locale),
      label: messages["nav.translations"],
      icon: "translation",
      disabled: true,
    },
    {
      href: localizedPath("/dashboard/catalogue", locale),
      label: messages["nav.catalogue"],
      icon: "catalogue",
      sectionStart: true,
    },
    {
      href: localizedPath("/dashboard/organizations", locale),
      label: messages["nav.organizationSettings"],
      icon: "settings",
    },
  ];
  const signedInLabel = formatMessage(messages["auth.dashboard.signedIn"], {
    email: user.email ?? "",
  });
  const isDemo = organizationRows.some((organization) =>
    organization.name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase(locale)
      .includes("demo"),
  );
  const defaultSidebarOpen =
    (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <AdminUIProvider
      direction={direction}
      permissionDenied={messages["roleTest.permissionDenied"]}
    >
      <Toaster position="top-center" closeButton />
      <PermissionDeniedNotice message={messages["roleTest.permissionDenied"]} />
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
          <SidebarHeader className="gap-3 px-3 pt-4">
            <Link
              href={localizedPath("/dashboard", locale)}
              className="focus-visible:ring-brand/50 flex h-11 items-center gap-3 overflow-hidden rounded-lg outline-none focus-visible:ring-2 group-data-[collapsible=icon]:justify-center"
            >
              <BrandMark size={36} />
              <span className="whitespace-nowrap text-lg font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
                Calais Info
              </span>
            </Link>
            <div className="group-data-[collapsible=icon]:hidden">
              <AdminScopeIdentity
                organizations={organizationRows}
                cities={scopeCities}
                teams={teamRows}
                defaults={defaults}
                label={messages["scope.organization"]}
              />
            </div>
          </SidebarHeader>
          <SidebarSeparator className="mt-1" />
          <SidebarContent>
            <DashboardNav
              ariaLabel={messages["auth.dashboard.console"]}
              items={navigation}
            />
          </SidebarContent>
          <SidebarFooter className="gap-3 px-3 pb-4">
            {roleTest.isSuperadmin ? (
              <SuperadminRoleSwitcher
                key={
                  roleTest.assumedRoles
                    .map((role) => role.roleId)
                    .sort()
                    .join(":") || "actual"
                }
                locale={locale}
                roles={roleRows}
                organizations={organizationRows}
                activeRoles={roleTest.assumedRoles}
                activeOrganization={
                  roleTest.assumedOrganizationId
                    ? {
                        id: roleTest.assumedOrganizationId,
                        name:
                          roleTest.assumedOrganizationName ??
                          messages["scope.organization"],
                      }
                    : null
                }
                labels={{
                  testing: messages["roleTest.testing"],
                  role: messages["roleTest.role"],
                  organization: messages["roleTest.organization"],
                  apply: messages["roleTest.apply"],
                  applyError: messages["roleTest.applyError"],
                  exit: messages["roleTest.exit"],
                  noMatch: messages["roleTest.noMatch"],
                }}
              />
            ) : null}
            {isDemo ? (
              <div className="border-warn/50 bg-warn-soft text-warn flex gap-2.5 rounded-lg border p-3 text-sm font-medium group-data-[collapsible=icon]:hidden">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{messages["demo.warning"]}</span>
              </div>
            ) : null}
            <div className="border-line flex items-center gap-2 border-t pt-3 group-data-[collapsible=icon]:justify-center">
              <span className="bg-brand text-canvas flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase group-data-[collapsible=icon]:hidden">
                {(user.name ?? user.email ?? "E")
                  .split(/\s+/)
                  .map((part) => part.slice(0, 1))
                  .join("")
                  .slice(0, 2)}
              </span>
              <span
                className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden"
                title={signedInLabel}
              >
                <span className="block truncate text-sm font-semibold">
                  {user.name ?? messages["auth.dashboard.role.editor"]}
                </span>
                <span className="text-copy-muted block truncate text-xs">
                  {teamRows[0]?.name ?? messages["scope.team"]}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                nativeButton={false}
                aria-label={messages["auth.dashboard.accountSecurity"]}
                render={
                  <Link href={localizedPath("/dashboard/account", locale)} />
                }
              >
                <UserRound aria-hidden />
              </Button>
              <form
                action={endEditorSession}
                className="group-data-[collapsible=icon]:mx-auto"
              >
                <input type="hidden" name="locale" value={locale} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  aria-label={messages["auth.dashboard.signOut"]}
                >
                  <LogOut aria-hidden />
                </Button>
              </form>
            </div>
          </SidebarFooter>
          <SidebarRail label={messages["sidebar.toggle"]} />
        </Sidebar>

        <SidebarInset className="bg-canvas min-w-0 overflow-x-hidden">
          <header className="border-line bg-canvas/95 sticky top-0 z-40 flex min-h-16 items-center gap-2 border-b px-4 backdrop-blur md:px-6">
            <SidebarTrigger
              label={messages["sidebar.toggle"]}
              className="-ms-2"
            />
            <Link
              href={localizedPath("/dashboard", locale)}
              className="me-auto flex items-center gap-2 font-semibold md:hidden"
            >
              <BrandMark size={28} />
              <span>Calais Info</span>
            </Link>
            <div className="ms-auto flex min-w-0 items-center gap-2">
              <AdminLanguageMenu
                locale={locale}
                label={messages["auth.language"]}
              />
              <AdminScopeControls
                cities={scopeCities}
                teams={teamRows}
                defaults={defaults}
                cityLabel={messages["scope.city"]}
                teamLabel={messages["scope.team"]}
              />
              <AdminThemeToggle label={messages["ui.theme.toggle"]} />
            </div>
          </header>
          <div className="min-w-0">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </AdminUIProvider>
  );
}
