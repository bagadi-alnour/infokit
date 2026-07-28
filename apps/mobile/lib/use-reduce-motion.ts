import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the phone asks for less motion. Motion is the first thing dropped
 * (docs/DESIGN-SYSTEM.md §2 rule 7), so every animated part of the welcome
 * reads this and renders its resting frame instead.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (current) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );

    return () => {
      current = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
