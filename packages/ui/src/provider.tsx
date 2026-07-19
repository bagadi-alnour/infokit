"use client";

import type { ReactNode } from "react";
import { TamaguiProvider, Theme } from "tamagui";

import { tamaguiConfig } from "./config";

export type CalaisColorTheme = "light" | "dark";

export function CalaisUIProvider({
  children,
  theme = "light",
}: {
  children: ReactNode;
  theme?: CalaisColorTheme;
}) {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
      <Theme name={theme}>{children}</Theme>
    </TamaguiProvider>
  );
}
