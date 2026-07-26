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
 * Wide windows get the column beside the section (the sidebar side follows the
 * reading direction, since the layout grid is laid out with logical
 * properties); a narrow one gets a single scrolling row above it.
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
      <ul className="border-line bg-surface rounded-card flex gap-1 overflow-x-auto border p-1.5 lg:flex-col lg:overflow-visible">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="lg:min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group/section focus-visible:ring-brand/50 flex min-h-9 items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[0.9rem] font-medium outline-none focus-visible:ring-2 lg:whitespace-normal",
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
                  {/* The hint is the reason to click; on a phone the row is
                   * already scrolling sideways, so it stays behind lg. */}
                  <span className="text-copy-muted hidden truncate text-xs font-normal lg:block">
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
