import { Text } from "@infokit/ui";
import { useCallback } from "react";

import { ArticleCard } from "~/components/content-cards";
import { PageHeading, PayloadScreen } from "~/components/payload-screen";
import { publicClient } from "~/lib/client";
import { usePreferences } from "~/lib/preferences";
import { usePublicPayload } from "~/lib/use-public-payload";

/** The articles, newest first — the order the server publishes them in. */
export default function ArticlesScreen() {
  const { locale, strings } = usePreferences();
  const load = useCallback(
    (signal: AbortSignal) => publicClient.listArticles({ locale, signal }),
    [locale],
  );
  const request = usePublicPayload(load);

  return (
    <PayloadScreen request={request} strings={strings}>
      {(payload) => (
        <>
          <PageHeading
            eyebrow={payload.page.eyebrow}
            title={payload.page.title}
            description={payload.page.description}
            family="article"
          />

          {payload.articles.length === 0 ? (
            <Text variant="muted">{payload.labels.empty}</Text>
          ) : (
            payload.articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                labels={payload.labels}
              />
            ))
          )}
        </>
      )}
    </PayloadScreen>
  );
}
