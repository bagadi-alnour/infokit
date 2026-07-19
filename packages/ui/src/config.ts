import { defaultConfig } from "@tamagui/config/v5";
import { dark, light, radii, spacing } from "@calais/tokens";
import { createTamagui } from "tamagui";

function theme(source: typeof light, base: typeof defaultConfig.themes.light) {
  return {
    ...base,
    background: source.canvas,
    color: source.ink,
    surface: source.surface,
    subtle: source.surfaceSubtle,
    mutedText: source.textMuted,
    borderColor: source.border,
    borderStrong: source.borderStrong,
    accent: source.accent,
    accentHover: source.accentHover,
    accentSoft: source.accentSoft,
    accentContrast: source.canvas,
    success: source.success,
    successSoft: source.successSoft,
    warning: source.warning,
    warningSoft: source.warningSoft,
    danger: source.danger,
    dangerSoft: source.dangerSoft,
  };
}

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  settings: {
    ...defaultConfig.settings,
    onlyAllowShorthands: false,
  },
  tokens: {
    ...defaultConfig.tokens,
    radius: {
      ...defaultConfig.tokens.radius,
      control: radii.control,
      card: radii.card,
      panel: radii.panel,
    },
    space: {
      ...defaultConfig.tokens.space,
      calais1: spacing[0],
      calais2: spacing[1],
      calais3: spacing[2],
      calais4: spacing[3],
      calais5: spacing[4],
      calais6: spacing[5],
      calais7: spacing[6],
      calais8: spacing[7],
    },
  },
  themes: {
    ...defaultConfig.themes,
    light: theme(light, defaultConfig.themes.light),
    dark: theme(dark, defaultConfig.themes.dark),
  },
});

export type CalaisTamaguiConfig = typeof tamaguiConfig;

declare module "tamagui" {
  // Tamagui discovers the application config through this intentionally empty declaration merge.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends CalaisTamaguiConfig {}
}
