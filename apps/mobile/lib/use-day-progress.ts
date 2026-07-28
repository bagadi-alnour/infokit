import { useEffect, useState } from "react";

/** Midnight to midnight, in the phone's own zone. */
function fractionOfDay(): number {
  const now = new Date();
  return (now.getHours() * 60 + now.getMinutes()) / (24 * 60);
}

/**
 * How much of the reader's day has already gone, as 0 to 1.
 *
 * Paired with `useClock`, this is what lets the welcome say "right now" and mean
 * it: the hour drawn on screen is the reader's own, not a picture of somebody
 * else's afternoon. It moves once a minute, which is the smallest step the
 * drawing can show anyway.
 */
export function useDayProgress(): number {
  const [progress, setProgress] = useState(fractionOfDay);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(fractionOfDay());
    }, 60_000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  return progress;
}
