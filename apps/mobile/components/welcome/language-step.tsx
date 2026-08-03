import {
  brandName,
  localeMetadata,
  publicSupportedLocales,
  type PublicLocale,
} from "@infokit/shared/i18n";
import { Button, directionProps, Text } from "@infokit/ui";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import {
  fill,
  localeGreetings,
  type WelcomeStrings,
} from "~/lib/welcome-content";

/** How long each unselected card is outlined before the next one takes over. */
const pulseInterval = 1600;

/**
 * One language. The greeting is the affordance — a reader who cannot read
 * fr/en/ar recognises their own script and word before any label. Selection is
 * a fill plus a check, never the outline the pulse uses, so the two never read
 * as the same thing.
 */
function LanguageCard({
  code,
  selected,
  pulsing,
  detectedLabel,
  featured = false,
  onPress,
}: {
  code: PublicLocale;
  selected: boolean;
  pulsing: boolean;
  detectedLabel?: string;
  /** The phone's own language: one full-width card above the grid. */
  featured?: boolean;
  onPress: () => void;
}) {
  const { label, direction } = localeMetadata[code];
  // The grid cards share a row two at a time; the featured one is a block in the
  // column above it, where growing would stretch it down the whole page.
  const layout = featured ? "w-full" : "grow basis-[46%]";
  // The one place a card is read in a language other than the app's: each
  // greeting is set in its own direction, so its own alignment comes with it
  // instead of the app-wide one.
  const align = direction === "rtl" ? "text-right" : "text-left";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={
        detectedLabel ? `${label} — ${detectedLabel}` : undefined
      }
      onPress={onPress}
      className={`rounded-control min-h-touch justify-center border p-3 ${layout} ${
        selected ? "bg-brand-soft border-brand" : "bg-surface border-line"
      }`}
      {...directionProps(direction)}
    >
      {pulsing ? (
        <Animated.View
          entering={FadeIn.duration(400)}
          exiting={FadeOut.duration(800)}
          pointerEvents="none"
          className="rounded-control border-brand-deep absolute inset-0 border-2"
        />
      ) : null}
      <View className="flex-row items-center justify-between gap-2">
        <View className="shrink">
          <Text
            variant="heading"
            className={selected ? `text-brand-soft-ink ${align}` : align}
          >
            {localeGreetings[code]}
          </Text>
          <Text
            variant="muted"
            className={selected ? `text-brand-soft-ink ${align}` : align}
          >
            {detectedLabel ? `${label} · ${detectedLabel}` : label}
          </Text>
        </View>
        {selected ? (
          <Text className="text-brand-soft-ink text-lg font-semibold">✓</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Step one: the only step that waits. Auto-advancing past a language choice is
 * how a reader ends up in a language they cannot read, so nothing here moves on
 * its own except the outline that shows the cards are tappable.
 */
export function LanguageStep({
  strings,
  selected,
  detected,
  onSelect,
  onContinue,
  reduceMotion,
  indicator,
}: {
  strings: WelcomeStrings;
  selected: PublicLocale;
  detected: PublicLocale;
  onSelect: (locale: PublicLocale) => void;
  onContinue: () => void;
  reduceMotion: boolean;
  indicator: ReactNode;
}) {
  const others = publicSupportedLocales.filter((code) => code !== detected);
  const [pulseIndex, setPulseIndex] = useState(0);
  // Measured rather than assumed: eleven cards fit on a large phone and do not
  // on a small one, and a hint pointing down at nothing is a hint that teaches
  // the reader to ignore hints.
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrolledBy, setScrolledBy] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => {
      setPulseIndex((previous) => (previous + 1) % others.length);
    }, pulseInterval);
    return () => {
      clearInterval(timer);
    };
  }, [reduceMotion, others.length]);

  const pulsingCode = reduceMotion ? null : others[pulseIndex];
  const selectedLabel = localeMetadata[selected].label;
  const hidden = contentHeight - viewportHeight - scrolledBy;
  const showScrollHint = hidden > 24;

  return (
    <View className="flex-1">
      <ScrollView
        contentContainerClassName="gap-3 px-4 pb-4"
        onLayout={({ nativeEvent }) => {
          setViewportHeight(nativeEvent.layout.height);
        }}
        onContentSizeChange={(_width, height) => {
          setContentHeight(height);
        }}
        onScroll={({ nativeEvent }) => {
          setScrolledBy(nativeEvent.contentOffset.y);
        }}
        scrollEventThrottle={80}
      >
        <View className="gap-1 pt-2">
          <Text variant="eyebrow">{brandName(selected)}</Text>
          <Text variant="title">{strings.languageTitle}</Text>
          {/* The opening line names the selection, so it stops mentioning the
              phone's language the moment the reader picks a different one. */}
          <Text className="text-copy-muted">
            {fill(
              selected === detected
                ? strings.languageBody
                : strings.languagePicked,
              { language: selectedLabel },
            )}
          </Text>
        </View>

        <LanguageCard
          code={detected}
          selected={selected === detected}
          pulsing={false}
          featured
          detectedLabel={strings.detected}
          onPress={() => {
            onSelect(detected);
          }}
        />

        <View className="flex-row flex-wrap gap-2.5">
          {others.map((code) => (
            <LanguageCard
              key={code}
              code={code}
              selected={selected === code}
              pulsing={code === pulsingCode && selected !== code}
              onPress={() => {
                onSelect(code);
              }}
            />
          ))}
        </View>
      </ScrollView>

      <View className="bg-canvas border-line gap-3 border-t px-4 pt-3">
        {showScrollHint ? (
          <Text variant="muted" className="text-center">
            ↓ {strings.scrollHint}
          </Text>
        ) : null}
        {indicator}
        <Button onPress={onContinue}>
          <Text>{fill(strings.continueIn, { language: selectedLabel })}</Text>
        </Button>
      </View>
    </View>
  );
}
