"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";

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
 * The column sits beside the section wherever the dashboard's own sidebar is
 * persistent. The grid follows the reading direction, so this is the left in
 * LTR and the right in RTL. Narrow screens get one scrolling row above the
 * section.
 */
export function AccountSettingsNav({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: readonly AccountSettingsNavItem[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    // Keep every small account section warm. Link prefetching is viewport
    // based; doing this explicitly also covers keyboard navigation and keeps
    // the behaviour predictable when this rail becomes scrollable on phones.
    for (const item of items) router.prefetch(item.href);
  }, [items, router]);

  function markPending(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ): void {
    // A modified click opens elsewhere and must not change this page's state.
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    if (href !== pathname) setPendingHref(href);
  }

  return (
    <nav
      aria-label={ariaLabel}
      className="min-w-0 self-start lg:sticky lg:top-20"
    >
      <ul className="border-line bg-surface rounded-card flex gap-1 overflow-x-auto border p-1.5 lg:flex-col lg:overflow-visible">
        {items.map((item) => {
          const active = pathname === item.href;
          const visuallyActive = pendingHref
            ? pendingHref === item.href
            : active;
          const pending = pendingHref === item.href;
          return (
            <li key={item.href} className="lg:min-w-0">
              <Link
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                aria-busy={pending || undefined}
                onClick={(event) => {
                  markPending(event, item.href);
                }}
                onFocus={() => {
                  router.prefetch(item.href);
                }}
                onPointerEnter={() => {
                  router.prefetch(item.href);
                }}
                className={cn(
                  "group/section focus-visible:ring-brand/50 flex min-h-9 items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[0.9rem] font-medium outline-none transition-colors focus-visible:ring-2 motion-reduce:transition-none lg:whitespace-normal",
                  visuallyActive
                    ? "bg-brand-soft text-brand-soft-ink font-semibold"
                    : "text-copy-muted hover:bg-canvas hover:text-ink",
                )}
              >
                <Icon
                  name={item.icon}
                  size={18}
                  className={cn(
                    "shrink-0",
                    visuallyActive
                      ? "text-brand"
                      : "text-copy-muted group-hover/section:text-ink",
                    pending && "animate-pulse motion-reduce:animate-none",
                  )}
                />
                <span className="min-w-0">
                  <span className="block truncate">{item.label}</span>
                  {/* The hint is the reason to click; while the row is still
                   * scrolling sideways it would only make it longer, so it
                   * waits for the column. */}
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
