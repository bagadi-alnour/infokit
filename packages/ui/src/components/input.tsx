import { useId, type ComponentProps } from "react";
import { TextInput, View } from "react-native";

import { cn } from "../lib/cn";
import { Text } from "./text";

export type InputProps = ComponentProps<typeof TextInput> & {
  /** Always visible — a placeholder is not a label. */
  label: string;
  hint?: string;
};

export function Input({ label, hint, className, ...props }: InputProps) {
  const hintId = useId();

  return (
    <View className="gap-1.5">
      <Text className="font-semibold">{label}</Text>
      <TextInput
        className={cn(
          "min-h-touch border-line-strong bg-surface text-ink rounded-control border px-3 text-base",
          className,
        )}
        accessibilityLabel={label}
        aria-describedby={hint ? hintId : undefined}
        {...props}
      />
      {hint ? (
        <Text nativeID={hintId} variant="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
