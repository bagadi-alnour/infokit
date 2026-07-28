import type { PageCatalog } from "@infokit/shared/i18n/catalogs";

import type { StewardContactValues } from "~/lib/steward-contact";

import type { DataTableLabels } from "./data-table";

/**
 * The catalogue's row shapes, its label bundle, and the handful of readings the
 * three tables share.
 *
 * The page reads the database and hands each tab a flat list: labels are
 * already resolved to the reader's language there, so a table never has to
 * know how a translation is stored (docs/DATABASE-SCHEMA.md §7).
 */

/** Every catalogue string, plus the record table's own chrome. */
export type CatalogueLabels = PageCatalog<"dashboard-catalogue"> & {
  table: DataTableLabels;
  /**
   * The shared console catalogue, for the strings a catalogue row borrows from
   * every other content type — the steward contact's wording.
   */
  shared: Record<string, string>;
};

/** A row an editor may act on, and what they may do to it. */
type Actionable = {
  canEdit: boolean;
  /** False when something still references the row — deleting would orphan it. */
  canDelete: boolean;
};

export type CatalogueServiceRow = Actionable & {
  id: string;
  /** Resolved label for this reader; falls back to French, then the code. */
  name: string;
  /** The French label, which is the canonical one the inline editor writes. */
  nameFr: string;
  code: string | null;
  icon: string;
  categoryId: string;
  categoryLabel: string;
  /** Null for a platform-wide row; an id for an association's own. */
  organizationId: string | null;
  active: boolean;
  /** Activities offering this service. */
  usageCount: number;
  /** Workspace-only "who to ask about this row"; never published. */
  steward: StewardContactValues;
};

export type CatalogueCategoryRow = Actionable & {
  id: string;
  label: string;
  code: string;
  icon: string;
  enabled: boolean;
  displayOrder: number;
  serviceCount: number;
};

export type CatalogueTagRow = Actionable & {
  id: string;
  label: string;
  labelFr: string;
  code: string;
  namespace: string;
  visibility: "public" | "workspace";
  colorToken: string;
  organizationId: string | null;
  active: boolean;
  /** Activities and articles carrying this tag. */
  usageCount: number;
};

/** Options for the service editor's category dropdown. */
export type CatalogueCategoryOption = { id: string; label: string };

/**
 * Who may write which scope. Both panels need it: it decides whether a row
 * shows its controls, and whether the "new" form offers a scope choice.
 */
export type CatalogueRights = {
  canManageGlobal: boolean;
  canManageOrg: boolean;
  /** The association in scope, when one is selected in the console shell. */
  scopeOrgId: string | null;
  scopeOrgName: string;
};

/** The colours a tag may be shown in, offered wherever a tag is written. */
export const tagColorTokens = [
  "neutral",
  "accent",
  "ok",
  "warn",
  "danger",
] as const;

/** "Public" or "Workspace only" — the words a reader sees for a stored value. */
export function visibilityText(
  labels: CatalogueLabels,
  value: CatalogueTagRow["visibility"],
) {
  return value === "public"
    ? labels["catalogue.tags.visibility.public"]
    : labels["catalogue.tags.visibility.workspace"];
}

/**
 * Which pair of words a row's on/off state is told in. A category is enabled or
 * disabled and every other catalogue row is active or inactive; the same value
 * also names the form field the switch posts, so the words and the field cannot
 * drift apart.
 */
export type StateKind = "active" | "enabled";

export function stateWords(labels: CatalogueLabels, kind: StateKind) {
  return kind === "enabled"
    ? {
        on: labels["catalogue.status.enabled"],
        off: labels["catalogue.status.disabled"],
      }
    : {
        on: labels["catalogue.status.active"],
        off: labels["catalogue.status.inactive"],
      };
}

/**
 * Whether a list holds both platform rows and an association's own. With only
 * one kind present, a scope filter would ask a question with a single answer.
 */
export function hasMixedScopes(
  rows: readonly { organizationId: string | null }[],
) {
  return (
    rows.some((row) => row.organizationId === null) &&
    rows.some((row) => row.organizationId !== null)
  );
}

/** The scope dropdown as a predicate. An unset filter keeps every row. */
export function matchesScope(scope: string, organizationId: string | null) {
  if (scope === "") return true;
  return scope === "global" ? organizationId === null : organizationId !== null;
}

/** The state dropdown as a predicate. An unset filter keeps every row. */
export function matchesState(state: string, on: boolean) {
  return state === "" || String(on) === state;
}
