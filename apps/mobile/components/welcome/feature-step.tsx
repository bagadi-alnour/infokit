import { Button, Card, Text } from "@infokit/ui";
import { ScrollView, View } from "react-native";

import { AutoAdvanceBar } from "~/components/welcome/auto-advance-bar";
import type { WelcomeFeature, WelcomeStrings } from "~/lib/welcome-content";

/**
 * One thing the app does, in the order a reader needs it: what is open, who
 * says so and when they checked, what it costs them.
 *
 * Each page opens with its own working demonstration (`visual`, see
 * feature-visuals.tsx) and then says in words what the reader has just watched
 * happen — the drawing first because it is the part that survives being read in
 * a language the app has not been translated into.
 */
export function FeatureStep({
  feature,
  strings,
  index,
  visual,
  isLast,
  autoAdvancing,
  autoAdvanceDuration,
  onBack,
  onSkip,
  onNext,
  indicator,
}: {
  feature: WelcomeFeature;
  strings: WelcomeStrings;
  index: number;
  visual: React.ReactNode;
  isLast: boolean;
  autoAdvancing: boolean;
  autoAdvanceDuration: number;
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
  indicator: React.ReactNode;
}) {
  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Button tone="quiet" block={false} onPress={onBack}>
          <Text>{strings.back}</Text>
        </Button>
        {isLast ? null : (
          <Button tone="quiet" block={false} onPress={onSkip}>
            <Text>{strings.skip}</Text>
          </Button>
        )}
      </View>

      {/* Every page names itself before it shows anything, in the same place the
          language step puts its title: a reader who lands here mid-flow should
          not have to work out the subject from a drawing. */}
      <View className="px-4 pb-1">
        <Text variant="title">{feature.title}</Text>
      </View>

      {/* Starts under the title rather than centring in what is left: a title
          with a page-height gap under it reads as the end of the page. */}
      <ScrollView contentContainerClassName="grow gap-4 px-4 pt-2 pb-4">
        {visual}

        <Text className="text-copy-muted">{feature.body}</Text>

        {feature.points.length > 0 ? (
          <Card>
            {feature.points.map((point) => (
              <View key={point} className="flex-row gap-2.5">
                <Text className="text-brand-deep font-semibold">·</Text>
                <Text className="flex-1">{point}</Text>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>

      <View className="bg-canvas border-line gap-3 border-t px-4 pt-3">
        <View className="flex-row items-center gap-3">
          {indicator}
          <AutoAdvanceBar
            running={autoAdvancing}
            duration={autoAdvanceDuration}
            resetKey={index}
          />
        </View>
        <Button onPress={onNext}>
          <Text>{isLast ? strings.finish : strings.next}</Text>
        </Button>
      </View>
    </View>
  );
}
