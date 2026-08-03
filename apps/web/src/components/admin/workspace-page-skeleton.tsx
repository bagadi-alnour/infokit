import { WorkspacePage } from "~/components/admin/workspace";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

function StaticSkeleton({
  className,
}: Readonly<{
  className?: string;
}>) {
  return <Skeleton className={cn("animate-none", className)} />;
}

/**
 * Generic workspace page fallback. The dashboard layout remains mounted, so
 * navigation, search and account actions do not disappear during a route change.
 */
export function WorkspacePageSkeleton() {
  return (
    <WorkspacePage>
      <div aria-busy="true">
        <header
          className="mb-6 flex flex-wrap items-start justify-between gap-4"
          aria-hidden="true"
        >
          <div className="grid w-full max-w-2xl gap-3">
            <StaticSkeleton className="h-7 w-52" />
            <StaticSkeleton className="h-3 w-full" />
            <StaticSkeleton className="h-3 w-4/5" />
          </div>
          <StaticSkeleton className="h-9 w-28" />
        </header>

        <div
          className="border-line bg-surface rounded-card overflow-hidden border"
          aria-hidden="true"
        >
          <div className="border-line flex flex-wrap items-center gap-3 border-b p-4">
            <StaticSkeleton className="h-9 min-w-44 flex-1" />
            <StaticSkeleton className="h-9 w-28" />
            <StaticSkeleton className="h-9 w-24" />
          </div>
          <div className="divide-line divide-y">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-6 px-4 py-3 md:grid-cols-[minmax(0,1.3fr)_minmax(8rem,0.7fr)_auto]"
              >
                <div className="grid gap-2">
                  <StaticSkeleton
                    className={cn(
                      "h-4",
                      index % 3 === 0
                        ? "w-2/3"
                        : index % 3 === 1
                          ? "w-4/5"
                          : "w-1/2",
                    )}
                  />
                  <StaticSkeleton className="h-3 w-32" />
                </div>
                <StaticSkeleton className="hidden h-4 w-24 md:block" />
                <StaticSkeleton className="h-8 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </WorkspacePage>
  );
}
