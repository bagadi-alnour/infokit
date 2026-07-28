"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "~/components/icons";
import { cn } from "~/lib/utils";

export interface AccountSettingsNavItem {
  href: string;
  label: string;
  /** What this section decides, in three or four words. */
  hint: string;
  icon: IconName;
}

/**
 * The account area's own navigation: one destination per settings section, so
 * a change of password and a change of notification channel never share a
 * form. Every entry is a route, which keeps the current section in the URL —
 * bookmarkable, linkable from an email, and restored by a page reload.
 *
 * The column sits beside the section wherever the section has the room for it —
 * a container query, not the window, since the console's own sidebar has
 * already taken its share (the sidebar side follows the reading direction, as
 * the layout grid is laid out with logical properties). Anything narrower gets
 * a single scrolling row above the section instead.
 */
export function AccountSettingsNav({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: readonly AccountSettingsNavItem[];
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={ariaLabel} className="min-w-0">
      <ul className="border-line bg-surface rounded-card @2xl:flex-col @2xl:overflow-visible flex gap-1 overflow-x-auto border p-1.5">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="@2xl:min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group/section focus-visible:ring-brand/50 @2xl:whitespace-normal flex min-h-9 items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[0.9rem] font-medium outline-none focus-visible:ring-2",
                  active
                    ? "bg-brand-soft text-brand-soft-ink font-semibold"
                    : "text-copy-muted hover:bg-canvas hover:text-ink",
                )}
              >
                <Icon
                  name={item.icon}
                  size={18}
                  className={cn(
                    "shrink-0",
                    active
                      ? "text-brand"
                      : "text-copy-muted group-hover/section:text-ink",
                  )}
                />
                <span className="min-w-0">
                  <span className="block truncate">{item.label}</span>
                  {/* The hint is the reason to click; while the row is still
                   * scrolling sideways it would only make it longer, so it
                   * waits for the column. */}
                  <span className="text-copy-muted @2xl:block hidden truncate text-xs font-normal">
                    {item.hint}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
