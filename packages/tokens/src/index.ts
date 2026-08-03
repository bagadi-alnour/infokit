/**
 * InfoKit design tokens — the single encoding of docs/DESIGN-SYSTEM.md.
 * Consumed by web (CSS-variable injection in apps/web) and by mobile
 * (NativeWind theme in apps/mobile).
 *
 * Rule (AGENTS.md): no colour decisions in components — semantic roles only.
 * Every value below is an opaque hex so the same token works in CSS and in
 * React Native, where `color-mix()` does not exist.
 */

export interface SemanticTheme {
  /** Page background. */
  canvas: string;
  /** Raised card / sheet background. */
  surface: string;
  /** Recessed band inside a surface (table headers, inset blocks). */
  surfaceSubtle: string;
  /** Canvas behind map geometry and raster tiles. */
  mapCanvas: string;
  /** Primary copy. */
  ink: string;
  /** Secondary copy — labels, metadata, hints. Never for body text. */
  textMuted: string;
  /** Hairline divider and default card ring. */
  border: string;
  /** Emphasised border — inputs, hovered cards. */
  borderStrong: string;
  /** Brand accent: primary buttons, active states, icons. */
  accent: string;
  /** Hover/pressed accent. */
  accentHover: string;
  /**
   * High-contrast accent for text on canvas/surface — inline links in
   * paragraphs and accent text that must clear 4.5:1.
   */
  accentDeep: string;
  /** Foreground for filled accent surfaces (solid buttons). */
  accentContrast: string;
  /** Accent wash: soft chips, selected rows, callouts. */
  accentSoft: string;
  /** Copy on `accentSoft`. */
  accentSoftInk: string;
  /** Status: open / verified / yes. */
  success: string;
  successSoft: string;
  /** Status: caution / expiring / unverified. */
  warning: string;
  warningSoft: string;
  /** Status: cancelled / error / no. */
  danger: string;
  dangerSoft: string;
  /** Status: closed / inactive / unknown. */
  neutralStatus: string;
  neutralStatusSoft: string;
  /**
   * Content families (docs/DESIGN-SYSTEM.md §5). One hue per kind of card, so a
   * reader recognises what they are holding before reading a word of it: the
   * agenda is indigo, articles are plum, guides are copper. Activities keep the
   * accent — they are the subject of the app.
   *
   * These are structural hues, never signals: they carry no state, they never
   * appear inside a status pill, and nothing may be understood from them alone
   * (rule 1). `…Accent` is the line and the label; `…Wash` is the fill behind it.
   */
  eventAccent: string;
  eventWash: string;
  articleAccent: string;
  articleWash: string;
  guideAccent: string;
  guideWash: string;
}

/** Light set — “Clinique”, the adopted system (docs/DESIGN-SYSTEM.md §3). */
export const light: SemanticTheme = {
  canvas: "#EFF5F3",
  surface: "#FBFEFD",
  surfaceSubtle: "#E4EFEC",
  mapCanvas: "#E4EFEC",
  ink: "#10231F",
  textMuted: "#5B6F6B",
  border: "#D3E2DE",
  borderStrong: "#BFD5D0",
  accent: "#0F766E",
  accentHover: "#0F6A63",
  accentDeep: "#0B544E",
  accentContrast: "#F0FBF9",
  accentSoft: "#D3ECE8",
  accentSoftInk: "#0B544E",
  success: "#0F7A3D",
  successSoft: "#D2E5DB",
  warning: "#8A5A06",
  warningSoft: "#E9E3D2",
  danger: "#A3282C",
  dangerSoft: "#EFDAD9",
  neutralStatus: "#5B6F6B",
  neutralStatusSoft: "#DEE6E3",
  eventAccent: "#3B4BA8",
  eventWash: "#E3E6F6",
  articleAccent: "#7A3A72",
  articleWash: "#F1E4EF",
  guideAccent: "#8F5220",
  guideWash: "#F4E7D9",
};

/** Dark set — same roles, same hierarchy, AA contrast kept. */
export const dark: SemanticTheme = {
  canvas: "#0D1A18",
  surface: "#142523",
  surfaceSubtle: "#1B302D",
  mapCanvas: "#11403C",
  ink: "#E6F2EF",
  textMuted: "#9FB3AF",
  border: "#22403C",
  borderStrong: "#2F5651",
  accent: "#4FD1C5",
  accentHover: "#64D6CB",
  accentDeep: "#A7E8E1",
  accentContrast: "#0D1A18",
  accentSoft: "#10403C",
  accentSoftInk: "#C9F2EE",
  success: "#59C98A",
  successSoft: "#173127",
  warning: "#DDB96A",
  warningSoft: "#2C2A1E",
  danger: "#EF8F8A",
  dangerSoft: "#2F2523",
  neutralStatus: "#9FB3AF",
  neutralStatusSoft: "#1D2B29",
  eventAccent: "#A9B4F5",
  eventWash: "#1B2340",
  articleAccent: "#E2A8D8",
  articleWash: "#2E2033",
  guideAccent: "#E4B489",
  guideWash: "#33261B",
};

/**
 * The four status roles the product needs (docs/DESIGN-SYSTEM.md §6).
 * Colour is never the only signal: each role also carries an icon and a word.
 */
export type StatusRole = "open" | "closed" | "cancelled" | "uncertain";

export const statusRoleTokens: Record<
  StatusRole,
  { fg: keyof SemanticTheme; bg: keyof SemanticTheme }
> = {
  open: { fg: "success", bg: "successSoft" },
  closed: { fg: "neutralStatus", bg: "neutralStatusSoft" },
  cancelled: { fg: "danger", bg: "dangerSoft" },
  uncertain: { fg: "warning", bg: "warningSoft" },
};

/**
 * Service categories. Chips are neutral: the icon and the word identify the
 * service, not a per-category hue (docs/DESIGN-SYSTEM.md §5).
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

/** Radii (docs/DESIGN-SYSTEM.md §4): 8 chips, 12 controls, 20 cards/panels. */
export const radii = {
  chip: 8,
  control: 12,
  card: 20,
  panel: 20,
  pill: 999,
} as const;

/** 4px base grid (docs/DESIGN-SYSTEM.md §4). */
export const spacing = [4, 8, 12, 16, 24, 32, 48, 64] as const;

/**
 * Two densities (docs/DESIGN-SYSTEM.md §4). The public site is always
 * comfortable; the editor workspace may compact its own chrome.
 */
export const density = {
  comfortable: 1,
  compact: 0.7,
} as const;

/** Minimum touch targets in px (docs/DESIGN-SYSTEM.md §4). */
export const touchTarget = {
  public: 48,
  workspace: 36,
} as const;

/**
 * Type families (docs/DESIGN-SYSTEM.md §4). Headings get the geometric face,
 * body the highly legible one; Arabic script has its own family in both roles.
 */
export const fontFamilies = {
  heading: "Work Sans",
  body: "Public Sans",
  arabic: "Noto Sans Arabic",
} as const;

/** Body copy never goes below 16px — the site is read on borrowed phones. */
export const minBodyFontSize = 16;

/**
 * Elevation is a ring plus a soft shadow, so cards stay legible when shadows
 * are dropped on low-end devices. Ring colours come from `border`/`borderStrong`.
 */
export const elevation = {
  sm: { blur: 2, y: 1, alpha: 0.04 },
  md: { blur: 12, y: 4, alpha: 0.06 },
  lg: { blur: 32, y: 12, alpha: 0.1 },
} as const;
