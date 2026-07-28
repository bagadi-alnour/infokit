import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";

import { PageHeader, WorkspacePage } from "~/components/admin/workspace";
import { requireRouteLocale } from "~/i18n/route-locale";
import { localizedPath } from "~/i18n/routing";
import { requireEditor } from "~/server/auth/require";
import {
  AccountSettingsNav,
  type AccountSettingsNavItem,
} from "./settings-nav";

/**
 * Account & settings is one destination with several sections, not one long
 * form: each section is its own route with its own save, so nothing an editor
 * did not open can be overwritten by a submit (docs/DATABASE-SCHEMA.md §4).
 */
export default async function AccountLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const locale = requireRouteLocale((await params).locale);
  await requireEditor(locale);
  const messages = await loadPageCatalog(locale, "dashboard-account");

  const sections: readonly AccountSettingsNavItem[] = [
    {
      href: localizedPath("/dashboard/account", locale),
      label: messages["account.nav.profile"],
      hint: messages["account.nav.profileHint"],
      icon: "profile",
    },
    {
      href: localizedPath("/dashboard/account/password", locale),
      label: messages["account.nav.password"],
      hint: messages["account.nav.passwordHint"],
      icon: "password",
    },
    {
      href: localizedPath("/dashboard/account/security", locale),
      label: messages["account.nav.security"],
      hint: messages["account.nav.securityHint"],
      icon: "security",
    },
    {
      href: localizedPath("/dashboard/account/preferences", locale),
      label: messages["account.nav.preferences"],
      hint: messages["account.nav.preferencesHint"],
      icon: "preferences",
    },
    {
      href: localizedPath("/dashboard/account/notifications", locale),
      label: messages["account.nav.notifications"],
      hint: messages["account.nav.notificationsHint"],
      icon: "bell",
    },
  ];

  return (
    <WorkspacePage width="contentStart">
      <PageHeader
        title={messages["account.title"]}
        sub={messages["account.description"]}
      />
      {/* The window is the wrong thing to measure here: the console's sidebar
       * takes 16rem off the front of it, so a 1000px window leaves this section
       * the room of a 700px one and the column would fold away with space to
       * spare. Asking the section how wide it is answers that, and keeps the
       * answer right when the sidebar is collapsed to icons. */}
      <div className="@container">
        <div className="@2xl:grid-cols-[15rem_minmax(0,1fr)] @2xl:gap-6 grid gap-5">
          <AccountSettingsNav
            ariaLabel={messages["account.nav.label"]}
            items={sections}
          />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </WorkspacePage>
  );
}
