import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

function StaticSkeleton({ className }: Readonly<{ className?: string }>) {
  return <Skeleton className={cn("animate-none", className)} />;
}

/** Route fallback for translator invitation, profile and assignment pages. */
export function TranslationPageSkeleton() {
  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-4 py-8 md:px-6">
      <div aria-busy="true">
        <header className="mb-6 flex items-start gap-3" aria-hidden="true">
          <StaticSkeleton className="size-11 shrink-0 rounded-xl" />
          <div className="grid w-full max-w-xl gap-2">
            <StaticSkeleton className="h-3 w-28" />
            <StaticSkeleton className="h-8 w-3/4" />
            <StaticSkeleton className="h-3 w-1/2" />
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }, (_, cardIndex) => (
            <Card key={cardIndex} aria-hidden="true">
              <CardHeader>
                <StaticSkeleton className="h-5 w-36" />
              </CardHeader>
              <CardContent className="grid gap-5">
                {Array.from({ length: 4 }, (_, fieldIndex) => (
                  <div key={fieldIndex} className="grid gap-2">
                    <StaticSkeleton
                      className={cn(
                        "h-3",
                        fieldIndex % 2 === 0 ? "w-24" : "w-32",
                      )}
                    />
                    <StaticSkeleton
                      className={cn(
                        "w-full",
                        fieldIndex === 1 ? "h-24" : "h-10",
                      )}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
