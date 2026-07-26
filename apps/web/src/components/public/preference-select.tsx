"use client";

import type { ReactNode } from "react";

import { ChoiceSelect } from "~/components/public/choice-select";

export interface PreferenceOption<T extends string> {
  value: T;
  label: string;
  lang?: string;
}

/**
 * A labelled dropdown for viewer preferences (language, theme). It opens under
 * the control instead of over it, so the current choice stays readable while
 * the reader picks another one — see ~/components/public/choice-select.
 */
export function PreferenceSelect<T extends string>({
  label,
  value,
  options,
  onValueChange,
  icon,
  className,
}: {
  label: string;
  value: T;
  options: readonly PreferenceOption<T>[];
  onValueChange: (value: T) => void;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <ChoiceSelect
      label={label}
      value={value}
      options={options}
      onValueChange={(next) => {
        onValueChange(next as T);
      }}
      icon={icon}
      className={className}
      triggerClassName="w-auto font-semibold"
    />
  );
}
