"use client";

import type { ComponentProps, ReactNode } from "react";
import {
  Button,
  Card,
  H1,
  Input,
  Label,
  Paragraph,
  Spinner,
  Text,
  XStack,
  YStack,
  isWeb,
  styled,
} from "tamagui";

const AuthCard = styled(Card, {
  name: "AuthCard",
  width: "100%",
  maxWidth: 900,
  flexShrink: 0,
  padding: 0,
  overflow: "hidden",
  backgroundColor: "$surface",
  borderWidth: 1,
  borderColor: "$borderColor",
  borderRadius: "$panel",
  shadowColor: "transparent",
});

export const ActionButton = styled(Button, {
  name: "ActionButton",
  minHeight: 44,
  borderRadius: "$control",
  fontWeight: "600",
  pressStyle: { opacity: 0.86 },
  focusStyle: { outlineColor: "$accent", outlineWidth: 2 },
  variants: {
    tone: {
      primary: {
        backgroundColor: "$accent",
        color: "$accentContrast",
        hoverStyle: { backgroundColor: "$accentHover" },
      },
      outline: {
        backgroundColor: "$surface",
        color: "$color",
        borderWidth: 1,
        borderColor: "$borderStrong",
        hoverStyle: {
          backgroundColor: "$subtle",
          borderColor: "$accent",
          color: "$accent",
        },
      },
      ghost: {
        backgroundColor: "transparent",
        color: "$accent",
        hoverStyle: { backgroundColor: "$accentSoft" },
      },
    },
  } as const,
  defaultVariants: { tone: "primary" },
});

export const ActionLinkSurface = styled(XStack, {
  name: "ActionLinkSurface",
  minHeight: 44,
  width: "100%",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "$control",
  paddingHorizontal: "$calais4",
  pressStyle: { opacity: 0.86 },
  focusStyle: { outlineColor: "$accent", outlineWidth: 2 },
  variants: {
    tone: {
      primary: {
        backgroundColor: "$accent",
        color: "$accentContrast",
        hoverStyle: { backgroundColor: "$accentHover" },
      },
      outline: {
        backgroundColor: "$surface",
        color: "$color",
        borderWidth: 1,
        borderColor: "$borderStrong",
        hoverStyle: { borderColor: "$accent" },
      },
    },
  } as const,
  defaultVariants: { tone: "primary" },
});

export function BrandMark({ size = 24 }: { size?: number }) {
  const cell = (size - 2) / 2;
  return (
    <YStack width={size} height={size} gap={2} aria-hidden>
      <XStack gap={2}>
        <YStack width={cell} height={cell} borderRadius={3} bg="$accent" />
        <YStack width={cell} height={cell} borderRadius={3} bg="$success" />
      </XStack>
      <XStack gap={2}>
        <YStack width={cell} height={cell} borderRadius={3} bg="$warning" />
        <YStack width={cell} height={cell} borderRadius={3} bg="$danger" />
      </XStack>
    </YStack>
  );
}

export function AuthShell({
  brand,
  privateLabel,
  securityTitle,
  securityItems,
  eyebrow,
  title,
  description,
  headerActions,
  children,
}: {
  brand: string;
  privateLabel: string;
  securityTitle: string;
  securityItems: readonly string[];
  eyebrow: string;
  title: string;
  description: string;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <YStack
      minHeight={isWeb ? "100vh" : "100%"}
      flex={1}
      alignItems="center"
      justifyContent={isWeb ? "flex-start" : "center"}
      backgroundColor="$subtle"
      paddingHorizontal="$calais4"
      paddingVertical="$calais6"
      $max-sm={{ paddingVertical: "$calais4" }}
    >
      <YStack width="100%" maxWidth={900} gap="$calais4">
        <XStack
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap="$calais3"
          paddingHorizontal="$calais1"
        >
          <XStack alignItems="center" gap="$calais3">
            <BrandMark />
            <Text fontWeight="700">{brand}</Text>
            <Text
              color="$mutedText"
              fontSize="$2"
              fontWeight="600"
              $max-sm={{ display: "none" }}
            >
              {privateLabel}
            </Text>
          </XStack>
          {headerActions}
        </XStack>

        <AuthCard flexDirection="row" $max-sm={{ flexDirection: "column" }}>
          <YStack
            width="38%"
            backgroundColor="$subtle"
            borderEndWidth={1}
            borderColor="$borderColor"
            padding="$calais6"
            gap="$calais4"
            $max-sm={{
              width: "100%",
              borderEndWidth: 0,
              borderBottomWidth: 1,
              padding: "$calais5",
            }}
          >
            <Text
              color="$mutedText"
              fontSize="$2"
              fontWeight="700"
              textTransform="uppercase"
              letterSpacing={0.4}
            >
              {securityTitle}
            </Text>
            <YStack gap="$calais3">
              {securityItems.map((item, index) => (
                <XStack key={item} alignItems="flex-start" gap="$calais3">
                  <YStack
                    width={22}
                    height={22}
                    alignItems="center"
                    justifyContent="center"
                    borderRadius={11}
                    backgroundColor="$accentSoft"
                  >
                    <Text color="$accent" fontSize="$1" fontWeight="700">
                      {index + 1}
                    </Text>
                  </YStack>
                  <Paragraph
                    flex={1}
                    color="$mutedText"
                    fontSize="$3"
                    lineHeight={20}
                  >
                    {item}
                  </Paragraph>
                </XStack>
              ))}
            </YStack>
          </YStack>

          <YStack
            width="62%"
            padding="$calais6"
            gap="$calais6"
            $max-sm={{ width: "100%", padding: "$calais5" }}
          >
            <YStack gap="$calais3">
              <Text
                color="$accent"
                fontSize="$2"
                fontWeight="700"
                textTransform="uppercase"
                letterSpacing={0.4}
              >
                {eyebrow}
              </Text>
              <H1 fontSize="$8" lineHeight={38} fontWeight="600">
                {title}
              </H1>
              <Paragraph color="$mutedText" fontSize="$5" lineHeight={24}>
                {description}
              </Paragraph>
            </YStack>
            {children}
          </YStack>
        </AuthCard>
      </YStack>
    </YStack>
  );
}

export function AuthTextField({
  id,
  label,
  labelAction,
  description,
  inputProps,
}: {
  id: string;
  label: string;
  labelAction?: ReactNode;
  description?: string;
  inputProps?: Omit<ComponentProps<typeof Input>, "id">;
}) {
  return (
    <YStack gap="$calais2">
      <XStack alignItems="center" justifyContent="space-between" gap="$calais3">
        <Label htmlFor={id} fontSize="$3" fontWeight="600" flexShrink={1}>
          {label}
        </Label>
        {labelAction}
      </XStack>
      <Input
        id={id}
        minHeight={44}
        borderRadius="$control"
        borderColor="$borderStrong"
        backgroundColor="$surface"
        color="$color"
        focusStyle={{ borderColor: "$accent", outlineColor: "$accent" }}
        {...inputProps}
      />
      {description ? (
        <Paragraph color="$mutedText" fontSize="$2" lineHeight={18}>
          {description}
        </Paragraph>
      ) : null}
    </YStack>
  );
}

export function StatusNotice({
  tone,
  children,
}: {
  tone: "info" | "warning" | "danger";
  children: ReactNode;
}) {
  const styles = {
    info: { backgroundColor: "$accentSoft", color: "$accent" },
    warning: { backgroundColor: "$warningSoft", color: "$warning" },
    danger: { backgroundColor: "$dangerSoft", color: "$danger" },
  } as const;
  const style = styles[tone];
  return (
    <YStack
      role="alert"
      aria-live="polite"
      borderRadius="$control"
      padding="$calais4"
      backgroundColor={style.backgroundColor}
    >
      <Paragraph color={style.color} fontSize="$3" lineHeight={20}>
        {children}
      </Paragraph>
    </YStack>
  );
}

export function PendingActionLabel({
  pending,
  label,
  pendingLabel,
  tone = "primary",
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
  tone?: "primary" | "outline" | "ghost";
}) {
  const color =
    tone === "primary"
      ? "$accentContrast"
      : tone === "ghost"
        ? "$accent"
        : "$color";

  return (
    <XStack alignItems="center" justifyContent="center" gap="$calais2">
      {pending ? <Spinner size="small" color={color} /> : null}
      <Text color={color}>{pending ? pendingLabel : label}</Text>
    </XStack>
  );
}
