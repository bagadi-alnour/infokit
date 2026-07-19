/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Workspace packages ship raw TypeScript; Next compiles them in place.
  transpilePackages: [
    "@calais/shared",
    "@calais/tokens",
    "@calais/ui",
    "@calais/validation",
  ],
};

export default config;
