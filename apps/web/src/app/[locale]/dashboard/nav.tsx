"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "~/components/icons";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
  disabled?: boolean;
  sectionStart?: boolean;
}

export function DashboardNav({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: readonly DashboardNavItem[];
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <nav aria-label={ariaLabel}>
      <SidebarGroup>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => {
            const active =
              item.href === items[0]?.href
                ? pathname === item.href
                : pathname.startsWith(item.href);
            const content = (
              <>
                <Icon name={item.icon} size={18} aria-hidden />
                <span>{item.label}</span>
              </>
            );

            return (
              <SidebarMenuItem
                key={item.href}
                className={
                  item.sectionStart
                    ? "border-sidebar-border mt-3 border-t pt-3"
                    : undefined
                }
              >
                {item.disabled ? (
                  <SidebarMenuButton
                    disabled
                    tooltip={item.label}
                    className="text-copy-muted"
                  >
                    {content}
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton
                    render={
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => {
                          if (isMobile) setOpenMobile(false);
                        }}
                      />
                    }
                    isActive={active}
                    title={item.label}
                  >
                    {content}
                  </SidebarMenuButton>
                )}
                {item.count !== undefined ? (
                  <SidebarMenuBadge>{item.count}</SidebarMenuBadge>
                ) : null}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>
    </nav>
  );
}
