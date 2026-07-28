import type { PublicLocale } from "@infokit/shared/i18n";
import { useEffect, useMemo, useState } from "react";

/**
 * The hour, in the reader's language and the phone's own zone.
 *
 * This is the one thing in the app the client is allowed to format: it is not
 * content, it is the reader's own clock — and it is what makes "open now" a
 * claim someone can check. It ticks every fifteen seconds rather than every
 * second: the app is read, not watched.
 */
export function useClock(locale: PublicLocale): string {
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }),
    [locale],
  );
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 15_000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  return formatter.format(now);
}
