import { localeMetadata, type PublicLocale } from "@infokit/shared/i18n";
import { directionProps } from "@infokit/ui";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FeatureStep } from "~/components/welcome/feature-step";
import {
  FreshnessBand,
  NowBand,
  PrivacyBand,
} from "~/components/welcome/feature-visuals";
import { LanguageStep } from "~/components/welcome/language-step";
import { StepIndicator } from "~/components/welcome/step-indicator";
import { deviceLocale } from "~/lib/client";
import { usePreferences } from "~/lib/preferences";
import { useReduceMotion } from "~/lib/use-reduce-motion";
import { welcomeStrings } from "~/lib/welcome-content";

/** Long enough to read a short page out loud; the bar shows it running. */
const autoAdvanceDuration = 6000;

/**
 * First run: choose a language, then three pages saying what the app answers.
 *
 * The language choice comes first because everything after it is written in the
 * language chosen — the flow itself is the proof that the switch worked. The
 * feature pages advance on their own so the app introduces itself without
 * asking for taps, but the reader can swipe, go back, or skip out at any point,
 * and any of those stops the timer for good: a page that keeps moving under
 * someone's thumb is a page they cannot finish reading.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { locale, setLocale, completeWelcome } = usePreferences();
  const detected = useMemo(() => deviceLocale(), []);
  const strings = welcomeStrings(locale);
  const reduceMotion = useReduceMotion();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The animated pager, not the plain one: `Animated.ScrollView` adds its own
  // members to the instance, so a `ScrollView` ref does not fit it.
  const scroller = useRef<Animated.ScrollView>(null);

  const [step, setStep] = useState(0);
  const [readerDriving, setReaderDriving] = useState(false);
  // The live pager position, in pages. Held on the UI thread so the step dots
  // can follow a finger mid-swipe instead of jumping when the page settles.
  const progress = useSharedValue(0);

  const features = strings.features;
  const total = features.length + 1;
  // RTL mirrors a progress flow rather than mirroring each page: the pages are
  // laid out end-to-start, so "next" always means forward in the reading
  // direction (docs/DESIGN-SYSTEM.md §2 rule 8).
  const rtl = localeMetadata[locale].direction === "rtl";
  const offsetOf = useCallback(
    (target: number) => (rtl ? total - 1 - target : target) * width,
    [rtl, total, width],
  );

  const goTo = useCallback(
    (target: number) => {
      setStep(target);
      scroller.current?.scrollTo({
        x: offsetOf(target),
        animated: !reduceMotion,
      });
    },
    [offsetOf, reduceMotion],
  );

  const finish = useCallback(() => {
    completeWelcome();
    router.replace("/");
  }, [completeWelcome, router]);

  // Realign after a rotation or a switch into an RTL language, where the page
  // order itself flips. `stepRef` rather than `step` in the dependency list on
  // purpose: `goTo` owns ordinary step changes, and re-running this on every one
  // would fight its animation.
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    scroller.current?.scrollTo({
      x: offsetOf(stepRef.current),
      animated: false,
    });
  }, [offsetOf]);

  const autoAdvancing =
    step > 0 && step < total - 1 && !readerDriving && !reduceMotion;

  useEffect(() => {
    if (!autoAdvancing) return;
    const timer = setTimeout(() => {
      goTo(step + 1);
    }, autoAdvanceDuration);
    return () => {
      clearTimeout(timer);
    };
  }, [autoAdvancing, step, goTo]);

  const takeOver = useCallback(() => {
    setReaderDriving(true);
  }, []);

  // Reported in pages and in reading order, so the dots read left-to-right in
  // French and right-to-left in Arabic without the indicator knowing either.
  const onScroll = useAnimatedScrollHandler((event) => {
    const page = width === 0 ? 0 : event.contentOffset.x / width;
    progress.value = rtl ? total - 1 - page : page;
  });

  const selectLocale = useCallback(
    (next: PublicLocale) => {
      setLocale(next);
    },
    [setLocale],
  );

  // One working demonstration per feature page, in the page order below.
  const visuals = [
    <NowBand
      key="now"
      locale={locale}
      strings={strings}
      reduceMotion={reduceMotion}
    />,
    <FreshnessBand
      key="freshness"
      strings={strings}
      reduceMotion={reduceMotion}
    />,
    <PrivacyBand key="privacy" strings={strings} reduceMotion={reduceMotion} />,
  ];

  const pages = [
    <LanguageStep
      key="language"
      strings={strings}
      selected={locale}
      detected={detected}
      onSelect={selectLocale}
      onContinue={() => {
        goTo(1);
      }}
      reduceMotion={reduceMotion}
      indicator={
        <StepIndicator
          step={0}
          total={total}
          progress={progress}
          strings={strings}
        />
      }
    />,
    ...features.map((feature, index) => {
      const featureStep = index + 1;
      const isLast = featureStep === total - 1;
      return (
        <FeatureStep
          key={feature.title}
          feature={feature}
          strings={strings}
          index={index}
          visual={visuals[index]}
          isLast={isLast}
          autoAdvancing={autoAdvancing && step === featureStep}
          autoAdvanceDuration={autoAdvanceDuration}
          onBack={() => {
            takeOver();
            goTo(featureStep - 1);
          }}
          onSkip={finish}
          onNext={() => {
            takeOver();
            if (isLast) finish();
            else goTo(featureStep + 1);
          }}
          indicator={
            <StepIndicator
              step={featureStep}
              total={total}
              progress={progress}
              strings={strings}
            />
          }
        />
      );
    }),
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        className="bg-canvas flex-1"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <Animated.ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          // The pager keeps its own axis: the pages below are already reversed
          // for RTL and addressed by `offsetOf`, so letting the scroller mirror
          // too would flip the same flow twice.
          {...directionProps("ltr")}
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={takeOver}
          onMomentumScrollEnd={({ nativeEvent }) => {
            const page = Math.round(nativeEvent.contentOffset.x / width);
            setStep(rtl ? total - 1 - page : page);
          }}
        >
          {(rtl ? [...pages].reverse() : pages).map((page, index) => (
            <View
              key={index}
              className="flex-1"
              {...directionProps(rtl ? "rtl" : "ltr", { width })}
            >
              {page}
            </View>
          ))}
        </Animated.ScrollView>
      </View>
    </>
  );
}
