/**
 * Calais Info design tokens — the single encoding of docs/DESIGN.md §2–§4.
 * Consumed by web (CSS-variable injection) and mobile (theme runtime).
 * Rule (AGENTS.md): no color decisions in components — semantic tokens only.
 */

export interface SemanticTheme {
  canvas: string;
  surface: string;
  surfaceSubtle: string;
  ink: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  neutralStatus: string;
  neutralStatusSoft: string;
}

export const light: SemanticTheme = {
  canvas: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceSubtle: "#F8FAFC",
  ink: "#181D26",
  textMuted: "#56606F",
  border: "#E0E2E6",
  borderStrong: "#B8C0CC",
  accent: "#1B61C9",
  accentHover: "#154EA3",
  accentSoft: "#EAF2FF",
  success: "#16794B",
  successSoft: "#EAF7F0",
  warning: "#9A6700",
  warningSoft: "#FFF4D6",
  danger: "#B4232C",
  dangerSoft: "#FDEBEC",
  neutralStatus: "#5F6876",
  neutralStatusSoft: "#EEF0F3",
};

/** Dark set derived in the prototype; same hierarchy, AA contrast kept. */
export const dark: SemanticTheme = {
  canvas: "#0F141C",
  surface: "#161C26",
  surfaceSubtle: "#1C2330",
  ink: "#E7EAF0",
  textMuted: "#9AA4B4",
  border: "#2A3242",
  borderStrong: "#414D63",
  accent: "#6FA3EF",
  accentHover: "#8FB8F4",
  accentSoft: "#182A47",
  success: "#4CC38A",
  successSoft: "#132A1E",
  warning: "#E3B558",
  warningSoft: "#2C2310",
  danger: "#F0808A",
  dangerSoft: "#331519",
  neutralStatus: "#9AA4B4",
  neutralStatusSoft: "#232B39",
};

/**
 * Service-category accents (docs/DESIGN.md §2). Color is never the only
 * identifier: every category also has a unique icon and a text label.
 */
export type ServiceCategoryCode =
  | "food"
  | "water"
  | "clothing"
  | "showers"
  | "material"
  | "charging"
  | "health"
  | "legal"
  | "shelter"
  | "activities"
  | "info";

export const categoryAccents: Record<
  ServiceCategoryCode,
  { light: string; dark: string }
> = {
  food: { light: "#D97706", dark: "#F0A045" },
  water: { light: "#1677A8", dark: "#4FA8D8" },
  clothing: { light: "#7C5CC4", dark: "#A78BE0" },
  showers: { light: "#167C80", dark: "#4FB0B4" },
  material: { light: "#6E7B3D", dark: "#A9B86A" },
  charging: { light: "#B25E09", dark: "#E09A4F" },
  health: { light: "#C13F5A", dark: "#E77B93" },
  legal: { light: "#4867B1", dark: "#7E9BE0" },
  shelter: { light: "#3E7A4E", dark: "#6FB183" },
  activities: { light: "#AD4A8E", dark: "#D689BF" },
  info: { light: "#52606D", dark: "#94A3B4" },
};

/** Radii (docs/DESIGN.md §4): buttons 12, cards 16, feature panels 24. */
export const radii = {
  control: 12,
  card: 16,
  panel: 24,
} as const;

/** 8px base grid with 4px compact step (docs/DESIGN.md §4). */
export const spacing = [4, 8, 12, 16, 24, 32, 48, 64] as const;

/** Minimum touch targets (docs/DESIGN.md §4). */
export const touchTarget = {
  public: 44,
  workspace: 36,
} as const;
