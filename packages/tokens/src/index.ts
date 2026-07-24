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
  canvas: "#F4F8FA",
  surface: "#FFFFFF",
  surfaceSubtle: "#EAF1F4",
  ink: "#142A35",
  textMuted: "#536B76",
  border: "#D2DFE4",
  borderStrong: "#9FB5BE",
  accent: "#245F8F",
  accentHover: "#1B4B72",
  accentSoft: "#DFEDF7",
  success: "#267254",
  successSoft: "#E3F2EB",
  warning: "#8A5B12",
  warningSoft: "#F9ECCE",
  danger: "#A53E49",
  dangerSoft: "#F8E5E7",
  neutralStatus: "#586D77",
  neutralStatusSoft: "#E7EEF1",
};

/** Dark set derived in the prototype; same hierarchy, AA contrast kept. */
export const dark: SemanticTheme = {
  canvas: "#0E1B22",
  surface: "#14262F",
  surfaceSubtle: "#1B303A",
  ink: "#E8F0F3",
  textMuted: "#A6B8C0",
  border: "#29434E",
  borderStrong: "#46626E",
  accent: "#7DB6E0",
  accentHover: "#9BC9E9",
  accentSoft: "#173A54",
  success: "#67C59A",
  successSoft: "#17382B",
  warning: "#E4B765",
  warningSoft: "#3B2D14",
  danger: "#EE919A",
  dangerSoft: "#421E24",
  neutralStatus: "#A6B8C0",
  neutralStatusSoft: "#233740",
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

/**
 * Radii (docs/DESIGN.md §4). One rounded family across the product: controls,
 * cards, and feature panels all use the 24px panel radius so buttons and cards
 * match the filter-panel corner the design settled on.
 */
export const radii = {
  control: 24,
  card: 24,
  panel: 24,
} as const;

/** 8px base grid with 4px compact step (docs/DESIGN.md §4). */
export const spacing = [4, 8, 12, 16, 24, 32, 48, 64] as const;

/** Minimum touch targets (docs/DESIGN.md §4). */
export const touchTarget = {
  public: 44,
  workspace: 36,
} as const;
