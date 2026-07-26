import type { ReactNode } from "react";
import { View } from "react-native";

import { cn } from "../lib/cn";
import { Text } from "./text";

export type CalloutTone = "info" | "success" | "warning" | "danger";

/** Word first, colour second: every tone names itself in its title. */
const toneClasses: Record<CalloutTone, { box: string; title: string }> = {
  info: { box: "bg-brand-soft border-brand", title: "text-brand-soft-ink" },
  success: { box: "bg-ok-soft border-ok", title: "text-ok" },
  warning: { box: "bg-warn-soft border-warn", title: "text-warn" },
  danger: { box: "bg-danger-soft border-danger", title: "text-danger" },
};

export function Callout({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: CalloutTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const style = toneClasses[tone];

  return (
    <View
      className={cn("rounded-control gap-1 border p-3.5", style.box, className)}
      accessibilityRole="alert"
    >
      {title ? (
        <Text className={cn("font-semibold", style.title)}>{title}</Text>
      ) : null}
      {typeof children === "string" ? <Text>{children}</Text> : children}
    </View>
  );
}
