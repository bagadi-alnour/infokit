import { brandName } from "@infokit/shared/i18n";
import type { PublicGuideDetailPayload } from "@infokit/shared/public-content";
import type {
  PublicSimulatorLabels,
  PublicSimulatorNode,
} from "@infokit/shared/public-simulator";
import { Button, Callout, Card, CardTitle, MetaRow, Text } from "@infokit/ui";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { ForwardChevron } from "~/components/forward-chevron";
import { PayloadScreen } from "~/components/payload-screen";
import { publicClient } from "~/lib/client";
import { usePreferences } from "~/lib/preferences";
import { usePublicPayload } from "~/lib/use-public-payload";

function formatStep(template: string, step: number): string {
  return template.replace("{number}", String(step));
}

function paragraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

/**
 * One guide, one decision per screen.
 *
 * Nothing the reader answers leaves this screen — no storage, no request, no
 * analytics — which is why the privacy line is on the start card and repeated at
 * the foot. The walk is identical to the web reader's, deliberately: the same
 * document, the same order, the same words.
 */
export default function GuideScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { locale, strings } = usePreferences();
  const load = useCallback(
    (signal: AbortSignal) => publicClient.getGuide(slug, { locale, signal }),
    [slug, locale],
  );
  const request = usePublicPayload(load);
  const title =
    request.state.status === "ready"
      ? request.state.payload?.document.title
      : undefined;

  return (
    <>
      <Stack.Screen options={{ title: title ?? brandName(locale) }} />
      <PayloadScreen request={request} strings={strings}>
        {(payload) => (
          <GuideWalk key={payload.document.versionId} payload={payload} />
        )}
      </PayloadScreen>
    </>
  );
}

function GuideWalk({ payload }: { payload: PublicGuideDetailPayload }) {
  const { document, labels, lastReviewedLabel, reviewDueLabel } = payload;
  const nodes = useMemo(
    () => new Map(document.nodes.map((node) => [node.id, node])),
    [document.nodes],
  );
  const [started, setStarted] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState(document.entryNodeId);
  const [history, setHistory] = useState<string[]>([]);
  const currentNode = nodes.get(currentNodeId);

  const restart = () => {
    setCurrentNodeId(document.entryNodeId);
    setHistory([]);
    setStarted(true);
  };

  const move = (nextNodeId: string | null) => {
    if (!nextNodeId || !currentNode) return;
    setHistory((current) => [...current, currentNode.id]);
    setCurrentNodeId(nextNodeId);
  };

  const goBack = () => {
    setHistory((current) => {
      const previous = current.at(-1);
      if (previous) setCurrentNodeId(previous);
      return current.slice(0, -1);
    });
  };

  return (
    <>
      {document.fallbackUsed ? (
        <Callout tone="info">{labels.fallback}</Callout>
      ) : null}

      {!started ? (
        // The invitation keeps the washed card of the guide family, so starting
        // a guide looks like the card that offered it.
        <Card className="border-guide bg-guide-wash">
          <Text variant="eyebrow" className="text-guide">
            {labels.source}
          </Text>
          <Text variant="title">{document.title}</Text>
          {document.summary ? (
            <Text className="text-copy-muted">{document.summary}</Text>
          ) : null}

          <View className="bg-surface border-line rounded-card gap-1 border p-4">
            <Text className="font-semibold">{labels.privacy}</Text>
            <Text>{labels.privacyDetail}</Text>
          </View>

          <MetaRow label={labels.lastReviewed}>{lastReviewedLabel}</MetaRow>
          <MetaRow label={labels.reviewDue}>{reviewDueLabel}</MetaRow>

          <Button
            onPress={() => {
              setStarted(true);
            }}
          >
            <Text>{labels.begin}</Text>
          </Button>
        </Card>
      ) : currentNode ? (
        <GuideStep
          node={currentNode}
          labels={labels}
          step={history.length + 1}
          canGoBack={history.length > 0}
          onChoose={move}
          onBack={goBack}
          onRestart={restart}
        />
      ) : (
        // A published guide can point at a node that a newer version removed.
        <Card>
          <CardTitle>{labels.notAvailable}</CardTitle>
          <Button tone="outline" onPress={restart}>
            <Text>{labels.startAgain}</Text>
          </Button>
        </Card>
      )}

      <Text variant="muted" className="text-center">
        {labels.source} · {labels.privacy}
      </Text>
    </>
  );
}

function GuideStep({
  node,
  labels,
  step,
  canGoBack,
  onChoose,
  onBack,
  onRestart,
}: {
  node: PublicSimulatorNode;
  labels: PublicSimulatorLabels;
  step: number;
  canGoBack: boolean;
  onChoose: (nextNodeId: string | null) => void;
  onBack: () => void;
  onRestart: () => void;
}) {
  const kindLabel =
    node.kind === "question"
      ? labels.question
      : node.kind === "information"
        ? labels.information
        : labels.result;

  return (
    <Card>
      {/* The step card stays on plain surface — the questions need the quiet —
          and carries the family only in the rule that counts the steps. */}
      <View className="border-guide flex-row items-center justify-between border-b pb-3">
        <Text variant="muted">{formatStep(labels.step, step)}</Text>
        <Text variant="eyebrow" className="text-guide">
          {kindLabel}
        </Text>
      </View>

      <Text variant="title">{node.prompt}</Text>
      {node.explanation ? (
        <Text className="text-copy-muted">{node.explanation}</Text>
      ) : null}

      {node.kind === "question" ? (
        <View className="gap-3">
          {node.options.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              disabled={!option.nextNodeId}
              onPress={() => {
                onChoose(option.nextNodeId);
              }}
              className={
                option.nextNodeId
                  ? "border-line-strong bg-surface rounded-control active:bg-subtle min-h-[56px] flex-row items-center justify-between gap-3 border px-4 py-3"
                  : "border-line bg-surface rounded-control min-h-[56px] flex-row items-center justify-between gap-3 border px-4 py-3 opacity-60"
              }
            >
              <Text className="flex-1 font-semibold">{option.label}</Text>
              <ForwardChevron tone="brand" />
            </Pressable>
          ))}
        </View>
      ) : node.kind === "information" ? (
        <Button
          disabled={!node.nextNodeId}
          onPress={() => {
            onChoose(node.nextNodeId);
          }}
        >
          <Text>{labels.continue}</Text>
        </Button>
      ) : (
        <View className="gap-4">
          {paragraphs(node.resultBody).map((block, index) => (
            <Text key={index}>{block}</Text>
          ))}
          {node.disclaimer ? (
            <Callout tone="warning" title={labels.disclaimer}>
              {node.disclaimer}
            </Callout>
          ) : null}
          <Button tone="outline" onPress={onRestart}>
            <Text>{labels.startAgain}</Text>
          </Button>
        </View>
      )}

      {canGoBack && node.kind !== "result" ? (
        <Button tone="quiet" onPress={onBack}>
          <Text>{labels.back}</Text>
        </Button>
      ) : null}
    </Card>
  );
}
