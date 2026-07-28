"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon, type IconName } from "~/components/icons";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "~/components/ui/sidebar";
import { cn } from "~/lib/utils";

export interface DashboardNavSubItem {
  href: string;
  label: string;
  icon: IconName;
  /** Matched with startsWith unless the item is the section root. */
  exact?: boolean;
}

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
  /** Matched with startsWith unless the item is the section root. */
  exact?: boolean;
  children?: readonly DashboardNavSubItem[];
}

export interface DashboardNavGroup {
  /** Omitted for the first group: a single entry needs no heading. */
  label?: string;
  items: readonly DashboardNavItem[];
}

function hrefParts(href: string) {
  const [pathAndQuery = href, fragment] = href.split("#", 2);
  return {
    path: pathAndQuery.split("?", 1)[0] ?? pathAndQuery,
    hash: fragment ? `#${fragment}` : "",
  };
}

function pathIsActive(
  item: Pick<DashboardNavSubItem, "href" | "exact">,
  pathname: string,
) {
  const { path } = hrefParts(item.href);
  return item.exact
    ? pathname === path
    : pathname === path || pathname.startsWith(`${path}/`);
}

function childIsActive(
  item: DashboardNavSubItem,
  siblings: readonly DashboardNavSubItem[],
  pathname: string,
  hash: string,
) {
  if (!pathIsActive(item, pathname)) return false;
  const parts = hrefParts(item.href);
  if (parts.hash) return hash === parts.hash;

  // When another entry points to a section on the same page, the root entry
  // owns the page only while none of those section links is selected.
  return !siblings.some((sibling) => {
    const siblingParts = hrefParts(sibling.href);
    return (
      siblingParts.path === parts.path &&
      siblingParts.hash.length > 0 &&
      siblingParts.hash === hash
    );
  });
}

function NavCount({
  count,
  active,
  nested,
}: {
  count: number;
  active: boolean;
  nested: boolean;
}) {
  return (
    <>
      <SidebarMenuBadge
        className={cn(
          "top-2! h-5 rounded-full px-1.5 text-[11px] font-semibold",
          nested ? "end-8" : null,
          active ? "bg-brand/15 text-brand" : "bg-surface text-copy-muted",
        )}
      >
        {count}
      </SidebarMenuBadge>
      {count > 0 ? (
        <span
          aria-hidden
          className="bg-brand absolute end-1.5 top-1.5 hidden size-1.5 rounded-full group-data-[collapsible=icon]:block"
        />
      ) : null}
    </>
  );
}

const primaryItemClassName = cn(
  "text-copy-muted group/nav relative h-9 gap-2.5 rounded-lg px-2.5 text-[0.9rem] font-medium [&_svg]:size-[18px]",
  "hover:bg-surface hover:text-ink",
  "data-active:bg-brand-soft data-active:text-brand-soft-ink data-active:font-semibold",
  "data-active:before:bg-brand data-active:before:absolute data-active:before:inset-y-2 data-active:before:start-0 data-active:before:w-[3px] data-active:before:rounded-e-full",
);

function DashboardNavEntry({
  item,
  pathname,
  hash,
}: {
  item: DashboardNavItem;
  pathname: string;
  hash: string;
}) {
  const {
    isMobile,
    setOpenMobile,
    setOpen: setSidebarOpen,
    state: sidebarState,
  } = useSidebar();
  const children = item.children ?? [];
  const nested = children.length > 0;
  const active =
    pathIsActive(item, pathname) ||
    children.some((child) => pathIsActive(child, pathname));
  const [expanded, setExpanded] = useState(active);

  useEffect(() => {
    if (active) setExpanded(true);
  }, [active]);

  if (!nested) {
    return (
      <SidebarMenuItem>
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
          tooltip={
            item.count === undefined
              ? item.label
              : `${item.label} (${String(item.count)})`
          }
          className={cn(
            primaryItemClassName,
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
          <NavCount count={item.count} active={active} nested={false} />
        ) : null}
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        aria-expanded={expanded}
        isActive={active}
        tooltip={
          item.count === undefined
            ? item.label
            : `${item.label} (${String(item.count)})`
        }
        onClick={() => {
          if (!isMobile && sidebarState === "collapsed") {
            setSidebarOpen(true);
            setExpanded(true);
            return;
          }
          setExpanded((value) => !value);
        }}
        className={cn(
          primaryItemClassName,
          item.count === undefined ? "pe-8" : "pe-16",
          "group-data-[collapsible=icon]:pe-2.5!",
          active && expanded
            ? "data-active:bg-transparent data-active:text-ink data-active:before:hidden"
            : null,
        )}
      >
        <Icon
          name={item.icon}
          size={18}
          className={cn(
            "shrink-0 transition-colors",
            active ? "text-brand" : "text-copy-muted group-hover/nav:text-ink",
          )}
        />
        <span className="truncate">{item.label}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4! absolute end-2 transition-transform duration-200 group-data-[collapsible=icon]:hidden",
            expanded ? "rotate-180" : null,
          )}
        />
      </SidebarMenuButton>
      {item.count !== undefined ? (
        <NavCount count={item.count} active={active} nested />
      ) : null}
      {expanded ? (
        <SidebarMenuSub>
          {children.map((child) => {
            const childActive = childIsActive(child, children, pathname, hash);
            return (
              <SidebarMenuSubItem key={child.href}>
                <SidebarMenuSubButton
                  render={
                    <Link
                      href={child.href}
                      aria-current={childActive ? "page" : undefined}
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                      }}
                    />
                  }
                  isActive={childActive}
                  className={cn(
                    "text-copy-muted h-8 gap-2 rounded-md px-2 text-[0.825rem] font-medium",
                    "hover:bg-surface hover:text-ink",
                    "data-active:bg-brand-soft data-active:text-brand-soft-ink data-active:font-semibold",
                  )}
                >
                  <Icon
                    name={child.icon}
                    size={15}
                    className={childActive ? "text-brand" : "text-copy-muted"}
                  />
                  <span>{child.label}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  );
}

export function DashboardNav({
  ariaLabel,
  groups,
}: {
  ariaLabel: string;
  groups: readonly DashboardNavGroup[];
}) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const readHash = () => {
      setHash(window.location.hash);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => {
      window.removeEventListener("hashchange", readHash);
    };
  }, [pathname]);

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
            {group.items.map((item) => (
              <DashboardNavEntry
                key={item.href}
                item={item}
                pathname={pathname}
                hash={hash}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </nav>
  );
}
