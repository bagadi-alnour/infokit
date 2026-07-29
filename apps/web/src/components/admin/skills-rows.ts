import { formatMessage } from "@infokit/shared/i18n";
import type { PageCatalog } from "@infokit/shared/i18n/catalogs";

import type { CatalogueLabels } from "./catalogue-rows";

/**
 * The row shapes of /dashboard/skills, and the readings its six tabs share.
 *
 * The page resolves every name to the reader's language and counts what points
 * at each row, then hands the tabs flat lists — the same division of labour the
 * catalogue page uses, so a table never has to know how a name is stored.
 *
 * The enum unions are spelled out here rather than imported from the schema:
 * these types cross into client components, and a client file importing the
 * server's table definitions would drag the database into the browser bundle.
 */

/**
 * Every string this page reads. The skills catalogue is its own, and the
 * catalogue bundle comes along because the shared columns and row controls are
 * written against it — "Scope", "Delete", "Save changes" are the same words
 * here as in the taxonomy.
 */
export type SkillsLabels = PageCatalog<"dashboard-skills"> & CatalogueLabels;

export type SkillKindValue =
  "skill" | "software" | "driving_permit" | "certification";

/** How far a row reaches beyond the association that wrote it. */
export type ReachValue =
  "organization" | "all_organizations" | "all_organizations_and_translators";

export type NecessityValue = "required" | "preferred";

/** What a person's declaration is worth right now. */
export type DeclarationState =
  | "self_declared"
  | "awaiting_verification"
  | "verified"
  | "rejected"
  | "expired";

/** A row an editor may act on, and what they may do to it. */
type Actionable = {
  canEdit: boolean;
  /** False while declarations or requirements still point at the row. */
  canDelete: boolean;
};

export type SkillTableRow = Actionable & {
  id: string;
  /** Resolved for this reader; falls back to French. */
  name: string;
  nameFr: string;
  nameEn: string;
  nameAr: string;
  code: string;
  kind: SkillKindValue;
  descriptionFr: string;
  /** Null for a platform row; an id for an association's own. */
  organizationId: string | null;
  /** "InfoKit", or the association that wrote it. */
  ownerName: string;
  visibility: ReachValue;
  verificationRequired: boolean;
  validityMonths: number | null;
  referenceUrl: string;
  active: boolean;
  /** Declarations plus requirement conditions — everything that would break. */
  usageCount: number;
  /** Only the platform may take a row over, and only one it does not own. */
  canPromote: boolean;
};

export type CourseTableRow = Actionable & {
  id: string;
  title: string;
  titleFr: string;
  titleEn: string;
  titleAr: string;
  slug: string;
  description: string;
  provider: string;
  url: string;
  organizationId: string | null;
  ownerName: string;
  visibility: ReachValue;
  verificationRequired: boolean;
  validityMonths: number | null;
  active: boolean;
  usageCount: number;
};

/**
 * A language, read-only. `published` is `languages.enabled` — whether content
 * can be published in it, which is a different question from whether anybody
 * speaks it, and the reason this tab exists at all.
 */
export type LanguageTableRow = {
  code: string;
  /** The language's own name, as its speakers write it. */
  name: string;
  /**
   * The same language named in the reader's language, so a French coordinator
   * looking for Pashto finds « pachto » under پښتو.
   */
  secondaryName: string;
  published: boolean;
  /** Members and translators who declared it. */
  speakerCount: number;
};

export type RequirementItemRow = {
  id: string;
  group: "skill" | "course" | "language";
  /** The name of the skill, course or language this condition points at. */
  label: string;
  necessity: NecessityValue;
  mustBeVerified: boolean;
  mustBeCurrent: boolean;
  minimumCount: number | null;
  note: string;
};

export type RequirementSetRow = {
  id: string;
  name: string;
  code: string;
  description: string;
  items: RequirementItemRow[];
};

/** One declaration waiting on a decision. */
export type VerifyTableRow = {
  id: string;
  kind: "skill" | "course";
  /** Which catalogue row was declared. */
  item: string;
  personName: string;
  personKind: "member" | "translator";
  /** ISO date the declaration was made, already formatted for the reader. */
  declaredOn: string;
};

/** What a target looks like on the wire: `skill:<uuid>`, `language:fr`. */
export type RequirementTargetOption = {
  value: string;
  label: string;
  /** The group name, shown under the option so the list reads as three lists. */
  description: string;
};

export const skillKindValues: readonly SkillKindValue[] = [
  "skill",
  "software",
  "driving_permit",
  "certification",
];

export const reachValues: readonly ReachValue[] = [
  "organization",
  "all_organizations",
  "all_organizations_and_translators",
];

export function kindText(labels: SkillsLabels, kind: SkillKindValue) {
  if (kind === "software") return labels["skills.kind.software"];
  if (kind === "driving_permit") return labels["skills.kind.driving_permit"];
  if (kind === "certification") return labels["skills.kind.certification"];
  return labels["skills.kind.skill"];
}

export function reachText(labels: SkillsLabels, reach: ReachValue) {
  if (reach === "all_organizations") {
    return labels["skills.reach.all_organizations"];
  }
  if (reach === "all_organizations_and_translators") {
    return labels["skills.reach.all_organizations_and_translators"];
  }
  return labels["skills.reach.organization"];
}

/** "12 months", or the fact that it never runs out. */
export function validityText(labels: SkillsLabels, months: number | null) {
  return months === null
    ? labels["skills.validity.forever"]
    : formatMessage(labels["skills.validity.months"], {
        count: String(months),
      });
}

/** Who a declaration has to convince: a verifier, or nobody. */
export function checkText(labels: SkillsLabels, verificationRequired: boolean) {
  return verificationRequired
    ? labels["skills.check.required"]
    : labels["skills.check.none"];
}

export function necessityText(labels: SkillsLabels, value: NecessityValue) {
  return value === "preferred"
    ? labels["skills.requirements.necessity.preferred"]
    : labels["skills.requirements.necessity.required"];
}

export function targetGroupText(
  labels: SkillsLabels,
  group: RequirementItemRow["group"],
) {
  if (group === "course") return labels["skills.requirements.group.courses"];
  if (group === "language")
    return labels["skills.requirements.group.languages"];
  return labels["skills.requirements.group.skills"];
}

/** "Two of the group", or everybody on the mission. */
export function minimumCountText(
  labels: SkillsLabels,
  minimumCount: number | null,
) {
  return minimumCount === null
    ? labels["skills.requirements.everyone"]
    : formatMessage(labels["skills.requirements.minimumCountValue"], {
        count: String(minimumCount),
      });
}

export function publishedText(labels: SkillsLabels, published: boolean) {
  return published
    ? labels["skills.languages.published.yes"]
    : labels["skills.languages.published.no"];
}

export function personKindText(
  labels: SkillsLabels,
  personKind: VerifyTableRow["personKind"],
) {
  return personKind === "translator"
    ? labels["skills.verify.translator"]
    : labels["skills.verify.member"];
}

export function declarationKindText(
  labels: SkillsLabels,
  kind: VerifyTableRow["kind"],
) {
  return kind === "course"
    ? labels["skills.verify.kind.course"]
    : labels["skills.verify.kind.skill"];
}

/** The kind dropdown as a predicate. An unset filter keeps every row. */
export function matchesKind(filter: string, kind: SkillKindValue) {
  return filter === "" || filter === kind;
}

/** The reach dropdown as a predicate. An unset filter keeps every row. */
export function matchesReach(filter: string, reach: ReachValue) {
  return filter === "" || filter === reach;
}
