"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface DashboardNavItem {
  href: string;
  label: string;
}

export function DashboardNav({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: readonly DashboardNavItem[];
}) {
  const pathname = usePathname();
  return (
    <nav
      className="border-line -mx-4 flex gap-1 overflow-x-auto border-b px-4 pb-3 md:mx-0 md:grid md:gap-1 md:overflow-visible md:border-b-0 md:px-0 md:pb-0"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active =
          item.href === items[0]?.href
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors md:w-full ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface hover:text-ink"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
