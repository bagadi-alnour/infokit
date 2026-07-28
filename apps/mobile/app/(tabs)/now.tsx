import { Callout, Text } from "@infokit/ui";
import { useCallback } from "react";

import { ActivityCard } from "~/components/content-cards";
import { PageHeading, PayloadScreen } from "~/components/payload-screen";
import { publicClient } from "~/lib/client";
import { usePreferences } from "~/lib/preferences";
import { usePublicPayload } from "~/lib/use-public-payload";

/**
 * Every published activity with the state it is in at this hour.
 *
 * No filter row here yet: on a phone the map answers "near me" and each card
 * already says open, closed, to confirm or cancelled, which is what the web
 * filters are mostly used for. The list stays a plain list so it can be read top
 * to bottom.
 */
export default function NowScreen() {
  const { locale, strings } = usePreferences();
  const load = useCallback(
    (signal: AbortSignal) => publicClient.listActivities({ locale, signal }),
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
          />

          <Callout tone="info">{payload.page.freshnessNotice}</Callout>

          {payload.activities.length === 0 ? (
            <Text variant="muted">{payload.labels.empty}</Text>
          ) : (
            payload.activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                labels={payload.labels}
              />
            ))
          )}
        </>
      )}
    </PayloadScreen>
  );
}
