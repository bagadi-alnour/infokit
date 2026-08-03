import { BrandMark } from "~/components/public/brand-mark";
import { SurfaceCard } from "~/components/public/primitives";
import { cn } from "~/lib/utils";

function LoadingBlock({ className }: Readonly<{ className?: string }>) {
  return (
    <div
      className={cn("bg-subtle rounded-control", className)}
      aria-hidden="true"
    />
  );
}

/** Loading shape shared by every page in the sign-in flow. */
export function AuthPageSkeleton() {
  return (
    <section className="bg-canvas flex min-h-screen flex-col items-center px-4 py-6 md:py-10">
      <div className="flex w-full max-w-4xl flex-col gap-5" aria-busy="true">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <BrandMark size={36} />
          <div className="flex gap-2" aria-hidden="true">
            <LoadingBlock className="size-10" />
            <LoadingBlock className="h-10 w-24" />
          </div>
        </div>

        <SurfaceCard className="shadow-lift grid overflow-hidden md:grid-cols-[minmax(0,0.62fr)_minmax(0,1fr)]">
          <div
            className="bg-subtle border-line flex flex-col gap-5 border-b p-6 md:border-b-0 md:border-e md:p-7"
            aria-hidden="true"
          >
            <LoadingBlock className="bg-surface h-3 w-28" />
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <LoadingBlock className="bg-surface size-6 rounded-full" />
                <LoadingBlock
                  className={cn(
                    "bg-surface h-4",
                    index === 1 ? "w-4/5" : "w-2/3",
                  )}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-6 p-6 md:p-8" aria-hidden="true">
            <div className="grid gap-3">
              <LoadingBlock className="h-3 w-24" />
              <LoadingBlock className="h-8 w-3/4" />
              <LoadingBlock className="h-4 w-full" />
              <LoadingBlock className="h-4 w-5/6" />
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <LoadingBlock className="h-3 w-20" />
                <LoadingBlock className="h-12 w-full" />
              </div>
              <div className="grid gap-2">
                <LoadingBlock className="h-3 w-24" />
                <LoadingBlock className="h-12 w-full" />
              </div>
              <LoadingBlock className="h-12 w-full" />
            </div>
          </div>
        </SurfaceCard>
      </div>
    </section>
  );
}
