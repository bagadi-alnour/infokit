import { ArrowRight, House, Map, MapPin, Search } from "lucide-react";

import type { PublicLocale } from "@infokit/shared/i18n";
import { ActionLink, SurfaceCard } from "~/components/public/primitives";
import { localizedPath } from "~/i18n/routing";

export function PublicNotFoundPage({
  locale,
  messages,
}: {
  locale: PublicLocale;
  messages: Record<string, string>;
}) {
  return (
    <section
      aria-labelledby="not-found-title"
      className="flex min-h-[32rem] items-center py-4 md:py-8"
    >
      <SurfaceCard className="w-full overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(19rem,2fr)]">
          <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-14">
            <p className="text-eyebrow text-brand-deep">
              {messages["notFound.eyebrow"]}
            </p>
            <h1
              id="not-found-title"
              className="text-ink mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl"
            >
              {messages["notFound.title"]}
            </h1>
            <p className="text-copy-muted mt-4 max-w-2xl text-lg leading-relaxed">
              {messages["notFound.description"]}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ActionLink
                href={localizedPath("/", locale)}
                size="large"
                className="sm:w-auto"
              >
                <House className="size-5" aria-hidden />
                {messages["notFound.home"]}
              </ActionLink>
              <ActionLink
                href={localizedPath("/activities", locale)}
                tone="outline"
                size="large"
                className="sm:w-auto"
              >
                <Search className="size-5" aria-hidden />
                {messages["notFound.activities"]}
                <ArrowRight className="size-5 rtl:rotate-180" aria-hidden />
              </ActionLink>
            </div>
          </div>

          <div
            className="border-line bg-subtle relative flex min-h-64 items-center justify-center overflow-hidden border-t p-8 lg:min-h-[28rem] lg:border-s lg:border-t-0"
            aria-hidden
          >
            <div className="relative h-52 w-full max-w-72">
              <div className="border-line-strong absolute start-8 top-7 h-32 w-40 rounded-[50%] border border-dashed sm:start-12 sm:w-44" />
              <div className="bg-surface border-line shadow-ring absolute start-1 top-2 flex size-16 items-center justify-center rounded-full border">
                <MapPin className="text-brand-deep size-7" />
              </div>
              <div className="bg-surface border-line shadow-ring rounded-card absolute bottom-2 end-1 flex size-24 items-center justify-center border">
                <Map className="text-brand-deep size-10" />
              </div>
              <div className="bg-brand text-brand-ink shadow-lift absolute start-1/2 top-1/2 flex size-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-2xl font-bold tabular-nums rtl:translate-x-1/2">
                404
              </div>
            </div>
          </div>
        </div>
      </SurfaceCard>
    </section>
  );
}
