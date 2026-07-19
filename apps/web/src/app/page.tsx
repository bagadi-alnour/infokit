import Link from "next/link";

/**
 * Placeholder landing — the public experience (finder, basic info,
 * simulator) is built against real verified content per PRODUCT.md §8.1.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-6 w-6 grid-cols-2 gap-0.5 *:rounded-[3px]"
        >
          <span className="bg-accent" />
          <span className="bg-ok" />
          <span className="bg-warn" />
          <span className="bg-danger" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Calais Info</h1>
      </div>
      <p className="text-muted max-w-md text-center text-sm">
        Private Slice 0 instrument. The public pages arrive once the first
        services are entered and verified with the organisations providing them.
      </p>
      <Link
        href="/dashboard"
        className="bg-accent rounded-control px-5 py-2.5 text-sm font-semibold text-white"
      >
        Open the editor console
      </Link>
    </main>
  );
}
