import { Callout, Text } from "@infokit/ui";
import { useCallback } from "react";

import { GuideCard } from "~/components/content-cards";
import { PageHeading, PayloadScreen } from "~/components/payload-screen";
import { publicClient } from "~/lib/client";
import { usePreferences } from "~/lib/preferences";
import { usePublicPayload } from "~/lib/use-public-payload";

/** The published guides — a tab of its own, and a card on home. */
export default function GuidesScreen() {
  const { locale, strings } = usePreferences();
  const load = useCallback(
    (signal: AbortSignal) => publicClient.listGuides({ locale, signal }),
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
            family="guide"
          />

          {/* Said before the first question, not after: someone deciding
              whether to answer needs to know where the answers go. */}
          <Callout tone="info">{payload.labels.privacy}</Callout>

          {payload.guides.length === 0 ? (
            <Text variant="muted">{payload.labels.empty}</Text>
          ) : (
            payload.guides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} labels={payload.labels} />
            ))
          )}
        </>
      )}
    </PayloadScreen>
  );
}
