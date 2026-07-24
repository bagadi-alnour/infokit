import assert from "node:assert/strict";
import test from "node:test";

import { preferredLocale } from "./preferred-locale";

void test("uses the highest-weight supported browser language", () => {
  assert.equal(preferredLocale("de-DE,de;q=0.9,fr;q=0.8,en;q=0.7"), "fr");
  assert.equal(preferredLocale("en-GB;q=0.8,ar;q=0.9"), "ar");
});

void test("preserves browser order when language weights match", () => {
  assert.equal(preferredLocale("fr-CA,en-US"), "fr");
  assert.equal(preferredLocale("en-US,fr-FR"), "en");
});

void test("detects languages from the full public catalogue", () => {
  assert.equal(preferredLocale("fa-IR,fr;q=0.7"), "fa");
  assert.equal(preferredLocale("ps-AF,en;q=0.8"), "ps");
  assert.equal(preferredLocale("so-SO,en;q=0.8"), "so");
});

void test("falls back to English for missing or unsupported languages", () => {
  assert.equal(preferredLocale(null), "en");
  assert.equal(preferredLocale("es-ES,de;q=0.8"), "en");
  assert.equal(preferredLocale("fr;q=0,en;q=0"), "en");
});
