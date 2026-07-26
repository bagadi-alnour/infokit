import { loadPageCatalog } from "@infokit/shared/i18n/catalogs";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { requireRouteLocale } from "~/i18n/route-locale";

export const dynamic = "force-dynamic";

export default async function TranslationUnavailablePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = requireRouteLocale((await params).locale);
  const labels = await loadPageCatalog(locale, "dashboard-articles");
  return (
    <main className="mx-auto grid min-h-dvh max-w-2xl place-items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{labels["translator.unavailableTitle"]}</CardTitle>
        </CardHeader>
        <CardContent className="text-copy-muted">
          {labels["translator.unavailableBody"]}
        </CardContent>
      </Card>
    </main>
  );
}
