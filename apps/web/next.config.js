/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  experimental: {
    // Stylesheets travel inside the document instead of as a second request, so
    // the first paint waits on no round trip beyond the HTML: on a throttled
    // phone connection the public pages paint a full second sooner. It is worth
    // it because the public sheet is small — src/styles/globals.css is built
    // from the public sources only, about 12 kB compressed. The console pays for
    // this: its own larger sheet is inlined the same way, so a signed-in editor
    // re-reads it on every page instead of taking it from cache. That is the
    // right way round for who each surface is for.
    inlineCss: true,
  },
  // Workspace packages ship raw TypeScript; Next compiles them in place.
  transpilePackages: [
    "@infokit/shared",
    "@infokit/tokens",
    "@infokit/validation",
  ],
  async headers() {
    return [
      {
        source: "/:locale(fr|en|ar)/translate/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default config;
