"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/organizations", label: "Organisations" },
  { href: "/dashboard/places", label: "Places" },
  { href: "/dashboard/services", label: "Services" },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="grid gap-0.5" aria-label="Editor console">
      {items.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-[10px] px-3 py-2 text-sm font-medium ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
