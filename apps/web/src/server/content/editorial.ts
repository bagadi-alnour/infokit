import { createHash } from "node:crypto";

import {
  editorialLanguageCodes,
  type EditorialLanguage,
} from "~/lib/editorial-languages";

/**
 * Editorial publication engine helpers (docs/DATABASE-SCHEMA.md §8, §11).
 *
 * Publishing pins an exact, immutable payload: a source version carries the
 * canonical multilingual content, and each per-language publication records a
 * hash of that language's localized payload. Both hashes are computed here so
 * the authoring rows can keep changing while published pointers stay stable.
 */

export const editorialLanguages = editorialLanguageCodes;
export type { EditorialLanguage };

export interface LocalizedContent {
  title: string;
  summary: string | null;
  bodyHtml: string | null;
  plainText: string | null;
}

export interface SourceContent {
  sourceLanguage: string;
  articleDate: string | null;
  translations: Partial<Record<string, LocalizedContent>>;
}

/**
 * Deterministic JSON with recursively sorted object keys so the same logical
 * payload always hashes identically regardless of insertion order.
 */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalStringify(v)}`)
    .join(",")}}`;
}

/** Lowercase hexadecimal SHA-256 — matches the DB check constraints. */
export function hashContent(value: unknown): string {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex");
}

/** SHA-256 of one language's localized payload, scoped to its language code. */
export function localizedContentHash(
  languageCode: string,
  content: LocalizedContent,
): string {
  return hashContent({ languageCode, ...content });
}

/**
 * Stable, public-safe URL slug. Lowercases, strips diacritics, and collapses
 * everything else to single hyphens. Empty results fall back to a stub the
 * caller can disambiguate with a suffix.
 */
export function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150)
    .replace(/-+$/g, "");
  return slug || "article";
}
