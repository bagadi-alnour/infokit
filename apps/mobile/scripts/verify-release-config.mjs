#!/usr/bin/env node
/**
 * The guard between a green pipeline and a dead app in the stores.
 *
 * `lib/client.ts` falls back to `http://localhost:3030` when
 * `EXPO_PUBLIC_INFOKIT_API_URL` is missing, and Expo inlines that value at
 * bundle time — on EAS's worker, not here. A release built without it installs
 * fine, opens fine, and then every request fails against a loopback address
 * that on a phone means the phone. Nothing in the build output says so. So the
 * URL is checked before a build is paid for, not after a reviewer finds it.
 *
 * Usage: node scripts/verify-release-config.mjs <build-profile>
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

/** @param {string} file */
function readJson(file) {
  return JSON.parse(readFileSync(join(mobileRoot, file), "utf8"));
}

const profileName = process.argv[2];
if (!profileName) {
  console.error(
    "Usage: node scripts/verify-release-config.mjs <build-profile>",
  );
  process.exit(2);
}

const easConfig = readJson("eas.json");
const profile = easConfig.build?.[profileName];

if (!profile) {
  const known = Object.keys(easConfig.build ?? {}).join(", ");
  console.error(
    `::error::Unknown EAS build profile '${profileName}'. Known: ${known}`,
  );
  process.exit(1);
}

// A loopback or private address means the bundle was never pointed at the
// deployed web app; anything non-https would be blocked by ATS on iOS anyway.
const apiUrl = (profile.env?.EXPO_PUBLIC_INFOKIT_API_URL ?? "").trim();
if (!apiUrl) {
  problems.push(
    `build.${profileName}.env.EXPO_PUBLIC_INFOKIT_API_URL is empty in eas.json. ` +
      `Set it to the deployed web app, e.g. "https://infokit.example" — without it the ` +
      `build silently talks to localhost.`,
  );
} else if (!/^https:\/\//.test(apiUrl)) {
  problems.push(
    `build.${profileName}.env.EXPO_PUBLIC_INFOKIT_API_URL must be an https URL, got '${apiUrl}'.`,
  );
} else if (
  /^https:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:|\/|$)/.test(apiUrl)
) {
  problems.push(
    `build.${profileName}.env.EXPO_PUBLIC_INFOKIT_API_URL points at a loopback address ('${apiUrl}').`,
  );
}

const appConfig = readJson("app.json").expo ?? {};

const projectId = appConfig.extra?.eas?.projectId;
if (typeof projectId !== "string" || projectId.trim().length === 0) {
  problems.push(
    "app.json has no extra.eas.projectId. Run `eas init` in apps/mobile once and commit the result.",
  );
}

if (!appConfig.icon) {
  problems.push(
    "app.json declares no icon, so the build would ship Expo's default. " +
      "Add a 1024x1024 PNG without an alpha channel under assets/.",
  );
}

if (!appConfig.version) {
  problems.push(
    "app.json has no version. It must match the version record in App Store Connect.",
  );
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`::error::${problem}`);
  process.exit(1);
}

console.log(
  `Release config OK for '${profileName}': ${appConfig.name} ${appConfig.version} -> ${apiUrl}`,
);
