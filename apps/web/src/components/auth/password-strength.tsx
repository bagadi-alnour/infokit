"use client";

import { useMemo } from "react";

import { cn } from "~/lib/utils";

export type PasswordStrengthLabels = {
  label: string;
  weak: string;
  fair: string;
  good: string;
  strong: string;
  veryStrong: string;
  minLength: string;
  uppercase: string;
  lowercase: string;
  number: string;
  special: string;
};

type StrengthLevel = "weak" | "fair" | "good" | "strong" | "veryStrong";

const strengthStyles: Record<StrengthLevel, { bar: string; text: string }> = {
  weak: { bar: "bg-danger", text: "text-danger" },
  fair: { bar: "bg-warn", text: "text-warn" },
  good: { bar: "bg-brand", text: "text-brand-deep" },
  strong: { bar: "bg-ok/80", text: "text-ok" },
  veryStrong: { bar: "bg-ok", text: "text-ok" },
};

/**
 * The five-signal calculator used by the reference app, aligned with
 * InfoKit's existing 12-character password policy.
 */
export function PasswordStrength({
  password,
  labels,
}: {
  password: string;
  labels: PasswordStrengthLabels;
}) {
  const requirements = useMemo(
    () => ({
      minLength: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    }),
    [password],
  );

  const strength = useMemo(() => {
    const passed = Object.values(requirements).filter(Boolean).length;
    if (passed <= 2)
      return { level: "weak" as const, score: Math.max(1, passed) };
    if (passed === 3) return { level: "fair" as const, score: 3 };
    if (passed === 4) return { level: "good" as const, score: 4 };
    return password.length >= 16
      ? { level: "veryStrong" as const, score: 5 }
      : { level: "strong" as const, score: 5 };
  }, [password, requirements]);

  if (!password) return null;

  const strengthLabel = labels[strength.level];
  const style = strengthStyles[strength.level];
  const checklist = [
    { met: requirements.uppercase, label: labels.uppercase },
    { met: requirements.lowercase, label: labels.lowercase },
    { met: requirements.number, label: labels.number },
    { met: requirements.special, label: labels.special },
    { met: requirements.minLength, label: labels.minLength },
  ];

  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-copy-muted">{labels.label}</span>
          <span className={cn("font-semibold", style.text)}>
            {strengthLabel}
          </span>
        </div>
        <div
          className="grid grid-cols-5 gap-1"
          role="meter"
          aria-label={labels.label}
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={strength.score}
          aria-valuetext={strengthLabel}
        >
          {[1, 2, 3, 4, 5].map((segment) => (
            <span
              key={segment}
              className={cn(
                "h-1.5 rounded-full transition-colors",
                segment <= strength.score ? style.bar : "bg-line",
              )}
              aria-hidden
            />
          ))}
        </div>
      </div>
      <ul className="grid grid-cols-5 gap-1 text-[0.625rem] sm:text-xs">
        {checklist.map((item) => (
          <li
            key={item.label}
            className={cn(
              "min-w-0 whitespace-nowrap text-center leading-tight",
              item.met ? "text-ok font-semibold" : "text-copy-muted",
            )}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
