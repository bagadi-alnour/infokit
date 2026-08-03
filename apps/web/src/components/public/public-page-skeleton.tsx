import { BrandMark } from "~/components/public/brand-mark";
import { SurfaceCard } from "~/components/public/primitives";
import { cn } from "~/lib/utils";

function LoadingBlock({
  className,
}: Readonly<{
  className?: string;
}>) {
  return (
    <div
      className={cn("bg-subtle rounded-control", className)}
      aria-hidden="true"
    />
  );
}

/**
 * Route-level fallback for the public reading surface.
 *
 * It mirrors the stable header, page opening and answer cards without showing
 * invented copy. The blocks stay static: the design contract reserves repeating
 * animation for the open-now status indicator.
 */
export function PublicPageSkeleton() {
  return (
    <div className="bg-canvas flex min-h-screen flex-col overflow-x-clip">
      <header className="border-line bg-surface border-b">
        <div className="max-w-300 mx-auto flex min-h-16 w-full items-center gap-3 px-4 py-2 md:px-6 lg:px-8">
          <BrandMark size={36} />
          <div
            className="hidden flex-1 items-center gap-2 lg:flex"
            aria-hidden="true"
          >
            {Array.from({ length: 5 }, (_, index) => (
              <LoadingBlock
                key={index}
                className={cn(
                  "h-9",
                  index === 1 ? "w-24" : index === 3 ? "w-20" : "w-16",
                )}
              />
            ))}
          </div>
          <div className="ms-auto flex items-center gap-2" aria-hidden="true">
            <LoadingBlock className="h-12 w-20" />
            <LoadingBlock className="size-12" />
            <LoadingBlock className="size-12 lg:hidden" />
          </div>
        </div>
      </header>

      <main className="max-w-300 mx-auto w-full flex-1 px-4 py-8 md:px-6 md:py-12 lg:px-8">
        <div aria-busy="true">
          <header className="mb-8 flex max-w-3xl flex-col gap-3 md:mb-10">
            <LoadingBlock className="h-3 w-24" />
            <LoadingBlock className="h-10 w-4/5 max-w-xl md:h-12" />
            <div className="mt-1 grid max-w-2xl gap-2">
              <LoadingBlock className="h-4 w-full" />
              <LoadingBlock className="h-4 w-5/6" />
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <SurfaceCard
                key={index}
                className="flex min-h-44 flex-col gap-4 p-5"
                aria-hidden="true"
              >
                <div className="flex items-center justify-between gap-4">
                  <LoadingBlock className="h-3 w-20" />
                  <LoadingBlock className="size-8 rounded-full" />
                </div>
                <LoadingBlock
                  className={cn(
                    "h-6",
                    index % 3 === 0
                      ? "w-4/5"
                      : index % 3 === 1
                        ? "w-2/3"
                        : "w-3/4",
                  )}
                />
                <div className="grid gap-2">
                  <LoadingBlock className="h-3 w-full" />
                  <LoadingBlock className="h-3 w-5/6" />
                </div>
                <LoadingBlock className="mt-auto h-4 w-28" />
              </SurfaceCard>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-line bg-surface mt-12 border-t">
        <div
          className="max-w-300 mx-auto grid w-full gap-5 px-4 py-8 md:grid-cols-[1fr_auto] md:px-6 lg:px-8"
          aria-hidden="true"
        >
          <div className="grid gap-3">
            <LoadingBlock className="h-5 w-32" />
            <LoadingBlock className="h-3 w-full max-w-md" />
          </div>
          <div className="flex gap-3">
            <LoadingBlock className="h-12 w-28" />
            <LoadingBlock className="h-12 w-28" />
          </div>
        </div>
      </footer>
    </div>
  );
}
