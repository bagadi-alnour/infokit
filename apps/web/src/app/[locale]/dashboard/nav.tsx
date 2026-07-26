"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "~/components/icons";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";
import { cn } from "~/lib/utils";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
  /** Matched with startsWith unless the item is the section root. */
  exact?: boolean;
}

export interface DashboardNavGroup {
  /** Omitted for the first group: a single entry needs no heading. */
  label?: string;
  items: readonly DashboardNavItem[];
}

export function DashboardNav({
  ariaLabel,
  groups,
}: {
  ariaLabel: string;
  groups: readonly DashboardNavGroup[];
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <nav aria-label={ariaLabel} className="px-1 py-1">
      {groups.map((group, index) => (
        <SidebarGroup
          key={group.label ?? `group-${String(index)}`}
          className="gap-1 px-2 py-1.5"
        >
          {group.label ? (
            <SidebarGroupLabel className="text-copy-muted h-7 px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.09em]">
              {group.label}
            </SidebarGroupLabel>
          ) : null}
          <SidebarMenu className="gap-1">
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

              return (
                <SidebarMenuItem key={item.href}>
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
                    // Collapsed to icons the badge shrinks to a dot, so the
                    // count rides along in the tooltip instead of vanishing.
                    tooltip={
                      item.count === undefined
                        ? item.label
                        : `${item.label} (${String(item.count)})`
                    }
                    className={cn(
                      // One row height for every entry, an 18px glyph, and copy
                      // that only reaches full contrast where the cursor or the
                      // current page is — so the section you are in is the one
                      // thing that stands out.
                      "text-copy-muted group/nav relative h-9 gap-2.5 rounded-lg px-2.5 text-[0.9rem] font-medium [&_svg]:size-[18px]",
                      "hover:bg-surface hover:text-ink",
                      "data-active:bg-brand-soft data-active:text-brand-soft-ink data-active:font-semibold",
                      // The accent bar reads as "you are here" even when the
                      // sidebar is collapsed to icons.
                      "data-active:before:bg-brand data-active:before:absolute data-active:before:inset-y-2 data-active:before:start-0 data-active:before:w-[3px] data-active:before:rounded-e-full",
                      item.count !== undefined
                        ? "group-data-[collapsible=icon]:pe-2.5!"
                        : null,
                    )}
                  >
                    <Icon
                      name={item.icon}
                      size={18}
                      className={cn(
                        "shrink-0 transition-colors",
                        active
                          ? "text-brand"
                          : "text-copy-muted group-hover/nav:text-ink",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </SidebarMenuButton>
                  {item.count !== undefined ? (
                    <>
                      <SidebarMenuBadge
                        className={cn(
                          "top-2! h-5 rounded-full px-1.5 text-[11px] font-semibold",
                          active
                            ? "bg-brand/15 text-brand"
                            : "bg-surface text-copy-muted",
                        )}
                      >
                        {item.count}
                      </SidebarMenuBadge>
                      {/* Collapsed to icons the number has nowhere to go; a dot
                       * still says "there is something in here". */}
                      {item.count > 0 ? (
                        <span
                          aria-hidden
                          className="bg-brand absolute end-1.5 top-1.5 hidden size-1.5 rounded-full group-data-[collapsible=icon]:block"
                        />
                      ) : null}
                    </>
                  ) : null}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </nav>
  );
}
