import type { PublicLocale } from "@infokit/shared/i18n";
import { Card, StatusPill, Text } from "@infokit/ui";
import { useEffect, useState } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useClock } from "~/lib/use-clock";
import { useDayProgress } from "~/lib/use-day-progress";
import { fill, type WelcomeStrings } from "~/lib/welcome-content";

/**
 * One drawing per feature page, each one doing the thing its page claims rather
 * than illustrating it: the clock is the reader's own, the ageing check date
 * behaves exactly as it will behave on a real entry, and the list of things the
 * app never asks for stays empty in front of them. Nothing here invents an
 * activity, an association or an opening time — a fabricated record would have
 * to be labelled as demo data (AGENTS.md rule 5), and a welcome screen is the
 * worst possible place to teach someone to trust an example.
 *
 * Every one of them holds still under "reduce motion" at the state that carries
 * the point, so the meaning never depends on having seen the movement.
 *
 * Reanimated drives geometry and opacity only. Colour stays on plain child
 * views: that is AGENTS.md rule 1, and also a requirement — an element handed an
 * animated `style` loses its `className` altogether.
 */

const hours = Array.from({ length: 24 }, (_, hour) => hour);
const styles = StyleSheet.create({ hour: { flex: 1 } });

/**
 * The reader's own hour, and the day it sits in.
 *
 * "Open right now" is a claim about this minute, so the page shows this minute:
 * the phone's clock, the hours already gone, and the hour being lived beating in
 * place. Under it, the four words every state in the app is written in.
 */
export function NowBand({
  locale,
  strings,
  reduceMotion,
}: {
  locale: PublicLocale;
  strings: WelcomeStrings;
  reduceMotion: boolean;
}) {
  const time = useClock(locale);
  const elapsed = useDayProgress();
  const currentHour = Math.min(23, Math.floor(elapsed * 24));

  const beat = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      beat.value = 1;
      return;
    }
    beat.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, [beat, reduceMotion]);
  const pulse = useAnimatedStyle<ViewStyle>(() => ({ opacity: beat.value }));

  return (
    <Card>
      <View className="flex-row items-baseline justify-between gap-3">
        <Text variant="eyebrow">{strings.visuals.now}</Text>
        <Text variant="title">{time}</Text>
      </View>

      {/* Laid out in the reading direction on purpose: the day runs from the
          margin a reader starts at, in every script. */}
      <View
        className="flex-row items-end gap-0.5"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {hours.map((hour) =>
          hour === currentHour ? (
            <Animated.View key={hour} style={[styles.hour, pulse]}>
              <View className="bg-brand h-5 w-full rounded-full" />
            </Animated.View>
          ) : (
            <View
              key={hour}
              className={`h-1.5 flex-1 rounded-full ${
                hour < currentHour ? "bg-brand-soft" : "bg-subtle"
              }`}
            />
          ),
        )}
      </View>
      <Text variant="muted">{strings.visuals.dayLabel}</Text>

      <View className="gap-2">
        <Text variant="eyebrow">{strings.statusLegendLabel}</Text>
        <View className="flex-row flex-wrap gap-2">
          <StatusPill role="open" label={strings.statusWords.open} />
          <StatusPill role="closed" label={strings.statusWords.closed} />
          <StatusPill role="uncertain" label={strings.statusWords.uncertain} />
          <StatusPill role="cancelled" label={strings.statusWords.cancelled} />
        </View>
      </View>
    </Card>
  );
}

/**
 * The ages the demonstration steps through: today, then straight to a fortnight
 * and on from there a day at a time.
 *
 * It skips one to eleven days because of Arabic, where a counted noun agrees
 * with the size of the count — three to ten days take a broken plural, eleven
 * upwards take the singular accusative — so a single `{days}` sentence can only
 * be right for one of those ranges. Staying inside 11 and up keeps every
 * language's one template correct, and the two ages that matter here are "today"
 * and "old enough to warn about" anyway.
 */
const youngestOldAge = 12;
const staleAfterDays = 14;
const oldestShown = 24;

function nextAge(current: number): number {
  if (current === 0) return youngestOldAge;
  return current >= oldestShown ? 0 : current + 1;
}

/**
 * A check date growing older, and the app changing its mind about it.
 *
 * This is the rule the page describes, running: information keeps the date it
 * was checked on, and once that date is old enough the app stops presenting it
 * as settled and asks the reader to confirm. Watching it age once is quicker
 * than reading the sentence twice.
 */
export function FreshnessBand({
  strings,
  reduceMotion,
}: {
  strings: WelcomeStrings;
  reduceMotion: boolean;
}) {
  const [days, setDays] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => {
      setDays(nextAge);
    }, 420);
    return () => {
      clearInterval(timer);
    };
  }, [reduceMotion]);

  const stale = days >= staleAfterDays;
  const age = `${String((days / oldestShown) * 100)}%` as `${number}%`;

  return (
    <Card>
      <Text variant="eyebrow">{strings.visuals.example}</Text>
      <View className="flex-row flex-wrap items-center gap-2">
        <StatusPill
          role={stale ? "uncertain" : "open"}
          label={
            days === 0
              ? strings.visuals.checkedToday
              : fill(strings.visuals.checkedDaysAgo, { days })
          }
        />
      </View>
      {/* The advice goes under the date rather than inside the pill, which is a
          single line by design: a sentence and a date share a 375pt row in
          English and in no other language. Always laid out, so the card does not
          change height every time the date crosses the threshold. */}
      <Text variant="muted" className={stale ? undefined : "opacity-0"}>
        {strings.visuals.stale}
      </Text>
      <View className="bg-subtle h-1.5 w-full overflow-hidden rounded-full">
        <View className="bg-brand h-full" style={{ width: age }} />
      </View>
    </Card>
  );
}

/**
 * The sign-up form that never appears.
 *
 * Every field a reader expects to be asked for, struck out one after another —
 * the page's claim made countable. It ends on all four crossed off and holds
 * there, which is also where it starts for anyone who asked for less motion.
 */
export function PrivacyBand({
  strings,
  reduceMotion,
}: {
  strings: WelcomeStrings;
  reduceMotion: boolean;
}) {
  const fields = strings.visuals.neverAskedItems;
  const [crossed, setCrossed] = useState(reduceMotion ? fields.length : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => {
      setCrossed((current) => (current >= fields.length ? 0 : current + 1));
    }, 800);
    return () => {
      clearInterval(timer);
    };
  }, [reduceMotion, fields.length]);

  return (
    <Card>
      <Text variant="eyebrow">{strings.visuals.neverAsked}</Text>
      <View className="flex-row flex-wrap gap-2">
        {fields.map((field, index) => {
          const off = index < crossed;
          return (
            <View
              key={field}
              className={`rounded-chip border px-2.5 py-1.5 ${
                off ? "border-line bg-subtle" : "border-line-strong bg-surface"
              }`}
            >
              <Text
                variant="muted"
                className={off ? "line-through" : "text-ink"}
              >
                {field}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
