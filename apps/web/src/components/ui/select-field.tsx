"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

type SelectFieldOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

/**
 * Read a form's `<option>` markup into the item list the popup needs, so a
 * field keeps the shape every editor and every reviewer already knows from
 * HTML while the menu itself is ours.
 *
 * `<optgroup>` and fragments are walked through rather than rendered: the
 * console has no grouped menus yet, and silently dropping their children would
 * lose choices.
 */
function readOptions(children: React.ReactNode): SelectFieldOption[] {
  const options: SelectFieldOption[] = [];
  const walk = (nodes: React.ReactNode) => {
    for (const node of React.Children.toArray(nodes)) {
      if (!React.isValidElement(node)) continue;
      const props = node.props as {
        value?: string | number;
        disabled?: boolean;
        children?: React.ReactNode;
      };
      if (node.type === React.Fragment || node.type === "optgroup") {
        walk(props.children);
        continue;
      }
      options.push({
        value: String(props.value ?? ""),
        label: props.children ?? "",
        disabled: props.disabled,
      });
    }
  };
  walk(children);
  return options;
}

/**
 * The console's dropdown for forms: one shadcn/base-ui `Select` drawn in our
 * own palette and anchored under the field, taking the `<option>` children a
 * `<select>` would take.
 *
 * Every dropdown in the workspace is this control or `SelectControl` (its
 * value/onValueChange sibling for filters), so a menu never appears in the OS
 * palette on top of the field it belongs to (docs/DESIGN-SYSTEM.md §5). The
 * hidden input keeps the value in the surrounding form, including the plain GET
 * forms the list pages submit.
 */
export function SelectField({
  children,
  className,
  contentClassName,
  defaultValue,
  disabled,
  form,
  id,
  name,
  onValueChange,
  required,
  size = "default",
  value,
  ...labelling
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  defaultValue?: string;
  disabled?: boolean;
  form?: string;
  id?: string;
  name?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  size?: "sm" | "default";
  value?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const options = readOptions(children);
  // A `<select>` with nothing chosen submits its first option; keeping that
  // means a form that never touched the field still sends what it displays.
  const fallback = defaultValue ?? options[0]?.value ?? "";

  return (
    <Select
      items={options}
      disabled={disabled}
      form={form}
      id={id}
      name={name}
      required={required}
      {...(value === undefined
        ? { defaultValue: fallback }
        : {
            value,
            onValueChange: (next: unknown) => {
              onValueChange?.(typeof next === "string" ? next : "");
            },
          })}
    >
      <SelectTrigger
        size={size}
        className={cn("min-h-9 w-full", className)}
        {...labelling}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" className={contentClassName}>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
