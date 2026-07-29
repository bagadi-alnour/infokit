import { formatMessage, type PublicLocale } from "@infokit/shared/i18n";
import type { PublicTransitLink } from "@infokit/shared/public-content";

import type { TransitLink } from "~/lib/transit-links";

/**
 * Stored transport links, turned into the words a reader sees.
 *
 * Only the mode is translated — the line and the stop are the network's own
 * names, and a reader asking a driver for a stop needs the name that is printed
 * on the pole, not a translation of it. The minutes go through `Intl` so a reader
 * in Arabic gets Arabic-Indic digits like every other number on the page.
 *
 * Shared by the activity and the event presenters, so one journey reads the same
 * way whichever surface it appears on.
 */
export function presentTransitLinks({
  links,
  messages,
  locale,
}: {
  links: readonly TransitLink[];
  messages: Record<string, string>;
  locale: PublicLocale;
}): PublicTransitLink[] {
  const minutes = new Intl.NumberFormat(locale);
  return links.map((link) => {
    const modeLabel = messages[`transit.mode.${link.mode}`] ?? link.mode;
    const walkLabel =
      link.walkMinutes === null
        ? null
        : formatMessage(messages["transit.walk"] ?? "", {
            minutes: minutes.format(link.walkMinutes),
          });
    return {
      // The two unions are written out in two packages; assigning one to the
      // other here is what makes a drift between them a typecheck failure.
      mode: link.mode,
      modeLabel,
      line: link.line,
      stopName: link.stopName,
      walkLabel,
      // "Bus 5 · Théâtre · 4 min walk" — the same middle dot the rest of the
      // public surfaces join short facts with.
      label: [
        link.line === null ? modeLabel : `${modeLabel} ${link.line}`,
        link.stopName,
        walkLabel,
      ]
        .filter((part): part is string => part !== null)
        .join(" · "),
    };
  });
}
