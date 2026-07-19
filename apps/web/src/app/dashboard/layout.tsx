import Link from "next/link";

import { Chip } from "~/components/ui";
import { DashboardNav } from "./nav";

/**
 * Slice 0 editor console — single platform editor, localhost only.
 * BLOCKER before any deployment (even the private instrument): real
 * authentication with 2FA (PRODUCT.md §8.1, RISKS.md R10).
 */
export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="bg-subtle min-h-screen">
      <header className="border-line bg-surface flex items-center gap-3 border-b px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span
            aria-hidden
            className="grid h-5 w-5 grid-cols-2 gap-0.5 *:rounded-[2px]"
          >
            <span className="bg-accent" />
            <span className="bg-ok" />
            <span className="bg-warn" />
            <span className="bg-danger" />
          </span>
          Calais Info
        </Link>
        <span className="text-muted text-sm">Editor console</span>
        <span className="ml-auto">
          <Chip tone="warn">
            Local instrument — auth required before deploy
          </Chip>
        </span>
      </header>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-6 md:self-start">
          <DashboardNav />
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
