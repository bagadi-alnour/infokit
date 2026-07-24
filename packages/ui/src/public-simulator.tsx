"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Button,
  Card,
  H1,
  H2,
  Paragraph,
  Separator,
  Text,
  XStack,
  YStack,
  styled,
} from "tamagui";

import { ActionButton, BrandMark } from "./auth";

export type PublicSimulatorLanguage =
  "fr" | "en" | "ar" | "fa" | "prs" | "ps" | "ckb" | "ti" | "am" | "om" | "so";
export type PublicSimulatorSourceLanguage = "fr" | "en" | "ar";
export type PublicSimulatorNodeKind = "question" | "information" | "result";

export interface PublicSimulatorOption {
  id: string;
  key: string;
  label: string;
  preferNotToSay: boolean;
  nextNodeId: string | null;
}

export interface PublicSimulatorNode {
  id: string;
  key: string;
  kind: PublicSimulatorNodeKind;
  optional: boolean;
  prompt: string;
  explanation: string;
  resultBody: string;
  disclaimer: string;
  options: PublicSimulatorOption[];
  nextNodeId: string | null;
}

export interface PublicSimulatorDocument {
  flowId: string;
  versionId: string;
  slug: string;
  title: string;
  summary: string;
  sourceLanguage: PublicSimulatorSourceLanguage;
  displayLanguage: PublicSimulatorLanguage;
  fallbackUsed: boolean;
  versionNumber: number;
  lastReviewedAt: string | null;
  reviewDueAt: string | null;
  publishedAt: string | null;
  entryNodeId: string;
  nodes: PublicSimulatorNode[];
}

export interface PublicSimulatorLabels {
  brand: string;
  privacy: string;
  privacyDetail: string;
  source: string;
  lastReviewed: string;
  reviewDue: string;
  notAvailable: string;
  fallback: string;
  preview: string;
  previewDetail: string;
  begin: string;
  continue: string;
  back: string;
  startAgain: string;
  step: string;
  question: string;
  information: string;
  result: string;
  disclaimer: string;
}

const SimulatorCard = styled(Card, {
  name: "SimulatorCard",
  width: "100%",
  maxWidth: 680,
  backgroundColor: "$surface",
  borderWidth: 1,
  borderColor: "$borderColor",
  borderRadius: "$panel",
  padding: "$calais6",
  gap: "$calais4",
  shadowColor: "transparent",
  "$max-sm": {
    padding: "$calais5",
    borderRadius: "$card",
  },
});

const ChoiceButton = styled(Button, {
  name: "SimulatorChoiceButton",
  width: "100%",
  minHeight: 52,
  justifyContent: "space-between",
  backgroundColor: "$surface",
  borderWidth: 1,
  borderColor: "$borderStrong",
  borderRadius: "$control",
  paddingHorizontal: "$calais4",
  color: "$color",
  fontSize: "$4",
  fontWeight: "600",
  hoverStyle: {
    backgroundColor: "$accentSoft",
    borderColor: "$accent",
  },
  pressStyle: {
    backgroundColor: "$accentSoft",
    opacity: 0.88,
  },
  focusStyle: {
    borderColor: "$accent",
    outlineColor: "$accent",
    outlineWidth: 3,
  },
});

function formatStep(template: string, step: number) {
  return template.replace("{number}", String(step));
}

export function PublicSimulatorExperience({
  document,
  labels,
  lastReviewedLabel,
  reviewDueLabel,
  headerActions,
  preview = false,
}: {
  document: PublicSimulatorDocument;
  labels: PublicSimulatorLabels;
  lastReviewedLabel: string;
  reviewDueLabel: string;
  headerActions?: ReactNode;
  preview?: boolean;
}) {
  const nodes = useMemo(
    () => new Map(document.nodes.map((node) => [node.id, node])),
    [document.nodes],
  );
  const [started, setStarted] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState(document.entryNodeId);
  const [history, setHistory] = useState<string[]>([]);
  const currentNode = nodes.get(currentNodeId);

  function restart() {
    setCurrentNodeId(document.entryNodeId);
    setHistory([]);
    setStarted(true);
  }

  function move(nextNodeId: string | null) {
    if (!nextNodeId || !currentNode) return;
    setHistory((current) => [...current, currentNode.id]);
    setCurrentNodeId(nextNodeId);
  }

  function back() {
    setHistory((current) => {
      const previous = current.at(-1);
      if (previous) setCurrentNodeId(previous);
      return current.slice(0, -1);
    });
  }

  const kindLabel =
    currentNode?.kind === "question"
      ? labels.question
      : currentNode?.kind === "information"
        ? labels.information
        : labels.result;

  return (
    <YStack minHeight="100vh" backgroundColor="$subtle">
      <XStack
        role="banner"
        minHeight={68}
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap="$calais3"
        paddingHorizontal="$calais5"
        paddingVertical="$calais3"
        backgroundColor="$surface"
        borderBottomWidth={1}
        borderColor="$borderColor"
        $max-sm={{ paddingHorizontal: "$calais4" }}
      >
        <XStack alignItems="center" gap="$calais3">
          <BrandMark size={28} />
          <Text fontSize="$5" fontWeight="700">
            {labels.brand}
          </Text>
        </XStack>
        {headerActions}
      </XStack>

      <YStack
        role="main"
        width="100%"
        maxWidth={760}
        alignSelf="center"
        paddingHorizontal="$calais4"
        paddingVertical="$calais7"
        gap="$calais4"
        $max-sm={{ paddingVertical: "$calais5" }}
      >
        {preview ? (
          <XStack
            role="status"
            alignItems="flex-start"
            gap="$calais3"
            padding="$calais4"
            backgroundColor="$warningSoft"
            borderWidth={1}
            borderColor="$warning"
            borderRadius="$card"
          >
            <Text color="$warning" fontWeight="800" aria-hidden>
              !
            </Text>
            <YStack flex={1} gap="$calais1">
              <Text color="$warning" fontWeight="700">
                {labels.preview}
              </Text>
              <Text color="$warning" fontSize="$3" lineHeight="$4">
                {labels.previewDetail}
              </Text>
            </YStack>
          </XStack>
        ) : null}

        {document.fallbackUsed ? (
          <XStack
            role="status"
            padding="$calais4"
            backgroundColor="$accentSoft"
            borderRadius="$card"
          >
            <Text color="$accent" fontSize="$3" fontWeight="600">
              {labels.fallback}
            </Text>
          </XStack>
        ) : null}

        {!started ? (
          <SimulatorCard>
            <YStack gap="$calais2">
              <Text
                color="$accent"
                fontSize="$2"
                fontWeight="800"
                textTransform="uppercase"
                letterSpacing={0.8}
              >
                {labels.information}
              </Text>
              <H1
                fontSize="$8"
                lineHeight="$8"
                fontWeight="700"
                $max-sm={{ fontSize: "$7", lineHeight: "$7" }}
              >
                {document.title}
              </H1>
              {document.summary ? (
                <Paragraph
                  maxWidth={640}
                  color="$mutedText"
                  fontSize="$4"
                  lineHeight="$6"
                >
                  {document.summary}
                </Paragraph>
              ) : null}
            </YStack>

            <YStack
              gap="$calais3"
              padding="$calais4"
              backgroundColor="$accentSoft"
              borderRadius="$card"
            >
              <Text color="$accent" fontWeight="700">
                {labels.privacy}
              </Text>
              <Paragraph color="$color" fontSize="$3" lineHeight="$5">
                {labels.privacyDetail}
              </Paragraph>
            </YStack>

            <XStack flexWrap="wrap" gap="$calais4">
              <YStack minWidth={180} gap="$calais1">
                <Text color="$mutedText" fontSize="$2" fontWeight="700">
                  {labels.lastReviewed}
                </Text>
                <Text fontSize="$3">{lastReviewedLabel}</Text>
              </YStack>
              <YStack minWidth={180} gap="$calais1">
                <Text color="$mutedText" fontSize="$2" fontWeight="700">
                  {labels.reviewDue}
                </Text>
                <Text fontSize="$3">{reviewDueLabel}</Text>
              </YStack>
            </XStack>

            <ActionButton
              tone="primary"
              minHeight={52}
              fontSize="$4"
              onPress={() => {
                setStarted(true);
              }}
            >
              {labels.begin}
            </ActionButton>
          </SimulatorCard>
        ) : currentNode ? (
          <SimulatorCard key={currentNode.id} role="region" aria-live="polite">
            <XStack alignItems="center" justifyContent="space-between" gap="$3">
              <Text color="$accent" fontSize="$2" fontWeight="800">
                {formatStep(labels.step, history.length + 1)}
              </Text>
              <Text color="$mutedText" fontSize="$2" fontWeight="700">
                {kindLabel}
              </Text>
            </XStack>
            <Separator borderColor="$borderColor" />

            <YStack gap="$calais3">
              <H2
                fontSize="$7"
                lineHeight="$7"
                fontWeight="700"
                $max-sm={{ fontSize: "$6", lineHeight: "$6" }}
              >
                {currentNode.prompt}
              </H2>
              {currentNode.explanation ? (
                <Paragraph color="$mutedText" fontSize="$4" lineHeight="$6">
                  {currentNode.explanation}
                </Paragraph>
              ) : null}
            </YStack>

            {currentNode.kind === "question" ? (
              <YStack gap="$calais3">
                {currentNode.options.map((option) => (
                  <ChoiceButton
                    key={option.id}
                    onPress={() => {
                      move(option.nextNodeId);
                    }}
                    disabled={!option.nextNodeId}
                  >
                    <Text flex={1} fontSize="$4">
                      {option.label}
                    </Text>
                    <Text color="$accent" fontSize="$5" aria-hidden>
                      →
                    </Text>
                  </ChoiceButton>
                ))}
              </YStack>
            ) : currentNode.kind === "information" ? (
              <ActionButton
                tone="primary"
                minHeight={52}
                fontSize="$4"
                onPress={() => {
                  move(currentNode.nextNodeId);
                }}
                disabled={!currentNode.nextNodeId}
              >
                {labels.continue}
              </ActionButton>
            ) : (
              <YStack gap="$calais4">
                <Paragraph fontSize="$4" lineHeight="$6">
                  {currentNode.resultBody}
                </Paragraph>
                {currentNode.disclaimer ? (
                  <YStack
                    gap="$calais2"
                    padding="$calais4"
                    backgroundColor="$subtle"
                    borderRadius="$card"
                    borderWidth={1}
                    borderColor="$borderColor"
                  >
                    <Text fontSize="$2" fontWeight="800">
                      {labels.disclaimer}
                    </Text>
                    <Paragraph color="$mutedText" fontSize="$3" lineHeight="$5">
                      {currentNode.disclaimer}
                    </Paragraph>
                  </YStack>
                ) : null}
                <ActionButton
                  tone="outline"
                  minHeight={52}
                  fontSize="$4"
                  onPress={restart}
                >
                  {labels.startAgain}
                </ActionButton>
              </YStack>
            )}

            {history.length > 0 && currentNode.kind !== "result" ? (
              <Button
                alignSelf="flex-start"
                minHeight={44}
                chromeless
                color="$accent"
                fontWeight="700"
                onPress={back}
              >
                ← {labels.back}
              </Button>
            ) : null}
          </SimulatorCard>
        ) : (
          <SimulatorCard>
            <H2>{labels.notAvailable}</H2>
            <ActionButton tone="outline" onPress={restart}>
              {labels.startAgain}
            </ActionButton>
          </SimulatorCard>
        )}

        <Text
          role="contentinfo"
          alignSelf="center"
          color="$mutedText"
          fontSize="$2"
          textAlign="center"
        >
          {labels.source} · {labels.privacy}
        </Text>
      </YStack>
    </YStack>
  );
}
