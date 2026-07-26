import type { ComponentProps, ReactNode } from "react";
import { View } from "react-native";

import { cn } from "../lib/cn";
import { Text } from "./text";

/** A raised surface with a hairline ring — elevation survives without shadows. */
export function Card({ className, ...props }: ComponentProps<typeof View>) {
  return (
    <View
      className={cn(
        "bg-surface border-line rounded-card gap-3 border p-4",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: ComponentProps<typeof Text>) {
  return <Text variant="heading" className={className} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: ComponentProps<typeof Text>) {
  return (
    <Text
      variant="body"
      className={cn("text-copy-muted", className)}
      {...props}
    />
  );
}

/** Label + value row, the shape every fact on a card is read in. */
export function MetaRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-0.5">
      <Text variant="eyebrow">{label}</Text>
      <Text>{children}</Text>
    </View>
  );
}
