import { isPublicLocale, type PublicLocale } from "@infokit/shared/i18n";

/**
 * Resolves the browser's weighted Accept-Language list to a public locale.
 * Unsupported languages never become route segments; English is the neutral
 * fallback for the unlocalized entry point.
 */
export function preferredLocale(
  acceptLanguage: string | null | undefined,
): PublicLocale {
  if (!acceptLanguage) return "en";

  const candidates = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [rawLanguage = "", ...parameters] = part.trim().split(";");
      const qualityParameter = parameters.find((parameter) =>
        parameter.trim().startsWith("q="),
      );
      const quality = qualityParameter
        ? Number(qualityParameter.trim().slice(2))
        : 1;
      return {
        language: rawLanguage.toLowerCase().split("-")[0],
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      };
    })
    .filter((candidate) => candidate.quality > 0)
    .sort(
      (left, right) => right.quality - left.quality || left.index - right.index,
    );

  for (const candidate of candidates) {
    if (isPublicLocale(candidate.language)) return candidate.language;
  }
  return "en";
}
