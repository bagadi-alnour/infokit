/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
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
