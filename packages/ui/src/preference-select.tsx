"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Button, isWeb, Popover, Sheet, Text, XStack, YStack } from "tamagui";

export interface PreferenceOption<Value extends string = string> {
  value: Value;
  label: string;
  lang?: string;
  prefix?: ReactNode;
}

/**
 * A compact, accessible Tamagui select shared by web and native preference
 * controls. Touch platforms adapt the same option list into a bottom sheet.
 */
export function PreferenceSelect<Value extends string>({
  label,
  value,
  options,
  onValueChange,
  minWidth = 132,
  triggerMode = "label",
  triggerValue,
}: {
  label: string;
  value: Value;
  options: readonly PreferenceOption<Value>[];
  onValueChange: (value: Value) => void;
  minWidth?: number;
  triggerMode?: "label" | "icon";
  triggerValue?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);
  const triggerWidth = triggerMode === "icon" ? 44 : minWidth;
  const menuWidth = `${String(Math.max(minWidth, 176))}px`;

  function choose(nextValue: Value) {
    onValueChange(nextValue);
    setOpen(false);
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>, index: number) {
    const { key } = event;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
      return;
    }

    const optionElements = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
        '[role="option"]',
      ) ?? [],
    );
    if (optionElements.length === 0) return;

    event.preventDefault();
    const nextIndex =
      key === "Home"
        ? 0
        : key === "End"
          ? optionElements.length - 1
          : (index + (key === "ArrowDown" ? 1 : -1) + optionElements.length) %
            optionElements.length;
    optionElements[nextIndex]?.focus();
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      offset={8}
      stayInFrame={{ padding: 12 }}
      allowFlip
      zIndex={200000}
    >
      <Popover.Trigger asChild>
        <Button
          {...(isWeb
            ? {
                "aria-label": label,
                "aria-haspopup": "listbox" as const,
                "aria-expanded": open,
              }
            : {
                accessibilityLabel: label,
                accessibilityRole: "button" as const,
                accessibilityState: { expanded: open },
              })}
          width={triggerWidth}
          minWidth={triggerWidth}
          maxWidth={triggerWidth}
          minHeight={44}
          flexShrink={0}
          alignSelf="flex-start"
          alignItems="center"
          justifyContent="center"
          backgroundColor="$surface"
          borderColor="$borderStrong"
          borderRadius="$control"
          paddingHorizontal="$calais3"
          hoverStyle={{ backgroundColor: "$subtle", borderColor: "$accent" }}
          pressStyle={{ backgroundColor: "$accentSoft" }}
          focusStyle={{
            backgroundColor: "$subtle",
            borderColor: "$accent",
            outlineColor: "$accent",
            outlineWidth: 2,
          }}
        >
          {triggerMode === "icon"
            ? (triggerValue ?? selectedOption?.prefix)
            : null}
          {triggerMode === "label" ? (
            <XStack flex={1} alignItems="center" gap="$calais2">
              <Text
                accessibilityLanguage={selectedOption?.lang}
                flex={1}
                fontSize="$3"
                fontWeight="600"
              >
                {selectedOption?.label}
              </Text>
              <Text color="$mutedText" aria-hidden>
                ▾
              </Text>
            </XStack>
          ) : null}
        </Button>
      </Popover.Trigger>

      <Popover.Adapt when="sm" platform="touch">
        <Sheet native modal dismissOnSnapToBottom>
          <Sheet.Frame
            backgroundColor="$surface"
            borderTopLeftRadius="$panel"
            borderTopRightRadius="$panel"
            padding="$calais4"
          >
            <Sheet.Handle backgroundColor="$borderStrong" />
            <Sheet.ScrollView>
              <Popover.Adapt.Contents />
            </Sheet.ScrollView>
          </Sheet.Frame>
        </Sheet>
      </Popover.Adapt>

      <Popover.Content
        {...(isWeb
          ? {
              // Tamagui's cross-platform role type omits the valid ARIA listbox role.
              role: "listbox" as never,
              "aria-label": label,
            }
          : {
              accessibilityRole: "menu" as const,
              accessibilityLabel: label,
            })}
        // Explicit pixels prevent Tamagui from resolving 176 as a spacing token.
        width={menuWidth as never}
        minWidth={menuWidth as never}
        maxWidth="calc(100vw - 24px)"
        alignItems="stretch"
        backgroundColor="$surface"
        borderWidth={1}
        borderColor="$borderColor"
        borderRadius="$control"
        padding="$calais1"
      >
        <Text
          color="$mutedText"
          fontSize="$2"
          fontWeight="700"
          alignSelf="stretch"
          paddingHorizontal="$calais3"
          paddingVertical="$calais2"
        >
          {label}
        </Text>
        <YStack width="100%" alignSelf="stretch" gap="$calais1">
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <Button
                key={option.value}
                {...(isWeb
                  ? {
                      role: "option" as const,
                      "aria-selected": selected,
                      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                        moveFocus(event, index);
                      },
                    }
                  : {
                      accessibilityRole: "button" as const,
                      accessibilityState: { selected },
                    })}
                unstyled
                width="100%"
                alignSelf="stretch"
                minHeight={44}
                alignItems="center"
                justifyContent="flex-start"
                borderRadius={8}
                paddingHorizontal="$calais3"
                backgroundColor={selected ? "$accentSoft" : "transparent"}
                hoverStyle={{ backgroundColor: "$subtle" }}
                pressStyle={{ backgroundColor: "$accentSoft" }}
                focusStyle={{
                  backgroundColor: "$accentSoft",
                  outlineColor: "$accent",
                  outlineWidth: 2,
                }}
                onPress={() => {
                  choose(option.value);
                }}
              >
                <XStack
                  width="100%"
                  flex={1}
                  alignItems="center"
                  justifyContent="flex-start"
                  gap="$calais2"
                >
                  {option.prefix}
                  <Text
                    accessibilityLanguage={option.lang}
                    color={selected ? "$accent" : "$color"}
                    fontSize="$3"
                    fontWeight="600"
                  >
                    {option.label}
                  </Text>
                </XStack>
              </Button>
            );
          })}
        </YStack>
      </Popover.Content>
    </Popover>
  );
}
