import type { MetadataRoute } from "next";
import { supportedLocales } from "@infokit/shared/i18n";

import { absoluteUrl } from "~/seo/site";

/**
 * The console and the sign-in flow, in the three languages the interface exists
 * in. The eight reading-only locales have no such routes to keep out.
 */
const privatePaths = supportedLocales.flatMap((locale) => [
  `/${locale}/dashboard`,
  `/${locale}/login`,
]);

/**
 * `/api` is closed by default and opened for the two families a crawler
 * legitimately needs: the public JSON the phone app reads, and the routes that
 * serve cover images. Both re-answer the visibility question per request, so a
 * draft record or a members-only event is a 404 to a crawler holding the URL.
 *
 * Leaving them blocked would quietly cost the site its rich results — a crawler
 * that cannot fetch `og:image` shows a result without one.
 */
const publicApiPaths = ["/api/public/", "/api/events/"];

/**
 * The agents that answer a question rather than rank a page, named explicitly.
 *
 * Someone looking for a shower tonight increasingly asks an assistant instead
 * of reading a result list, and for several of these a missing rule is
 * ambiguous — read as consent by some crawlers and as refusal by others. This
 * content is verified, dated and published in order to be repeated, so the
 * permission is stated rather than left to be inferred. `Google-Extended` and
 * `Applebot-Extended` are not crawlers but usage tokens: allowing them opts the
 * content into being used as grounding, not only indexed.
 */
const answeringAgents = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "DuckAssistBot",
  "Amazonbot",
  "Meta-ExternalAgent",
  "MistralAI-User",
  "cohere-ai",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  // Allow rules are listed before the disallow they carve out of; every crawler
  // that matters resolves the overlap by the more specific path either way.
  const rules = {
    allow: ["/", ...publicApiPaths],
    disallow: ["/api/", ...privatePaths],
  };

  return {
    rules: [
      { userAgent: "*", ...rules },
      { userAgent: answeringAgents, ...rules },
    ],
    // No `Host:` line: it was one crawler's way of naming a preferred mirror,
    // is deprecated, and the canonical tags on the pages say it properly.
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
