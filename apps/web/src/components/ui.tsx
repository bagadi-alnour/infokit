import { type ReactNode } from "react";

/**
 * Workspace primitives per docs/DESIGN.md (compact density is allowed in
 * the authenticated workspace; the public pages get their own, calmer set).
 * All colors come from token-backed utilities — never raw values here.
 */

export function PageHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub ? <p className="text-muted mt-1 text-sm">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border-line bg-surface rounded-card border p-4 ${className}`}
    >
      {title ? (
        <h2 className="text-muted mb-3 text-xs font-semibold uppercase tracking-wide">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint ? (
        <span className="text-muted mt-1 block text-xs">{hint}</span>
      ) : null}
    </label>
  );
}

const controlClass =
  "w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`${controlClass} ${className}`} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  const { className = "", ...rest } = props;
  return <textarea {...rest} className={`${controlClass} ${className}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return <select {...rest} className={`${controlClass} ${className}`} />;
}

const buttonVariants = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface hover:border-accent",
  danger: "bg-danger text-white",
  ghost: "text-accent hover:bg-accent-soft",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
}) {
  return (
    <button
      {...rest}
      className={`rounded-[10px] px-3.5 py-2 text-sm font-semibold ${buttonVariants[variant]} ${className}`}
    />
  );
}

const chipTones = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-neutral-soft text-neutral",
  accent: "bg-accent-soft text-accent",
} as const;

export function Chip({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof chipTones;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${chipTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted border-line rounded-card border border-dashed px-4 py-8 text-center text-sm">
      {children}
    </p>
  );
}
