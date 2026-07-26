import { Button, Callout, Text } from "@infokit/ui";
import { ActivityIndicator, View } from "react-native";

import type { ConnectionStrings } from "~/lib/client";

/**
 * What a reader sees when there is no content yet. Both are worded as facts,
 * never as reassurance: someone deciding whether to walk across town needs to
 * know the app is showing nothing, not that something is "almost ready".
 */
export function LoadingState({ strings }: { strings: ConnectionStrings }) {
  return (
    <View className="items-center gap-3 py-10" accessibilityRole="progressbar">
      <ActivityIndicator />
      <Text variant="muted">{strings.loading}</Text>
    </View>
  );
}

export function ErrorState({
  strings,
  unreachable,
  onRetry,
}: {
  strings: ConnectionStrings;
  unreachable: boolean;
  onRetry: () => void;
}) {
  return (
    <View className="gap-3">
      <Callout tone="warning" title={strings.failedTitle}>
        {unreachable ? strings.offlineBody : strings.failedBody}
      </Callout>
      <Button tone="outline" onPress={onRetry}>
        <Text>{strings.retry}</Text>
      </Button>
    </View>
  );
}
