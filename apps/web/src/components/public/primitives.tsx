import { cva, type VariantProps } from "class-variance-authority";
import {
  CheckCircle2,
  CircleAlert,
  Clock,
  Info,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ElementType, ReactNode } from "react";

import type { PublicActivityStatus } from "@infokit/shared/public-content";
import { cn } from "~/lib/utils";

/**
 * Public-surface primitives (docs/DESIGN-SYSTEM.md §5). They are deliberately
 * separate from the shadcn set used by the editor workspace: the public site is
 * always in the comfortable density with 48px targets, and it must stay
 * readable when shadows, images or fonts are dropped.
 */

const actionStyles = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-60 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        solid: "bg-brand text-brand-ink hover:bg-brand-hover",
        outline:
          "border-line-strong bg-surface text-ink hover:border-brand hover:text-brand-deep border",
        quiet: "text-brand-deep hover:bg-brand-soft",
        soft: "bg-brand-soft text-brand-soft-ink hover:bg-brand-soft/70",
      },
      size: {
        /** Rule 6: 48px minimum on the public site. */
        default: "min-h-12 px-5 text-base",
        large: "min-h-14 px-6 text-lg",
        compact: "min-h-12 px-4 text-sm",
        block: "min-h-12 w-full px-5 text-base",
      },
    },
    defaultVariants: { tone: "solid", size: "default" },
  },
);

export type ActionStyleProps = VariantProps<typeof actionStyles>;

export function actionClass({
  className,
  ...props
}: ActionStyleProps & { className?: string }) {
  return cn(actionStyles(props), className);
}

export function ActionLink({
  tone,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & ActionStyleProps) {
  return (
    <Link className={cn(actionStyles({ tone, size }), className)} {...props} />
  );
}

export function ActionAnchor({
  tone,
  size,
  className,
  ...props
}: ComponentProps<"a"> & ActionStyleProps) {
  return (
    <a className={cn(actionStyles({ tone, size }), className)} {...props} />
  );
}

export function ActionButton({
  tone,
  size,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & ActionStyleProps) {
  return (
    <button
      type={type}
      className={cn(actionStyles({ tone, size }), className)}
      {...props}
    />
  );
}

/** Card surface: ring first, shadow second (docs/DESIGN-SYSTEM.md §4). */
export function SurfaceCard({
  className,
  as: As = "div",
  ...props
}: Omit<ComponentProps<"div">, "ref"> & {
  as?: "div" | "article" | "section" | "li";
}) {
  // Polymorphic on a closed set of block elements; the props we accept are the
  // common HTML attributes, so a single loose element type is enough here.
  const Component = As as ElementType;
  return (
    <Component
      className={cn(
        "bg-surface border-line rounded-card shadow-ring border",
        className,
      )}
      {...props}
    />
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-eyebrow", className)}>
      <span
        className="bg-brand me-2 inline-block size-2 rounded-full align-middle"
        aria-hidden
      />
      {children}
    </p>
  );
}

/**
 * Neutral chip: the icon and the word identify the thing, never a hue
 * (docs/DESIGN-SYSTEM.md §5).
 */
export function Chip({
  icon,
  children,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-subtle border-line text-ink rounded-chip inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-sm font-medium",
        className,
      )}
    >
      {icon ? (
        <span className="text-brand-deep flex items-center">{icon}</span>
      ) : null}
      {children}
    </span>
  );
}

const STATUS_PRESENTATION: Record<
  PublicActivityStatus,
  { className: string; Icon: typeof CheckCircle2 }
> = {
  open: { className: "bg-ok-soft text-ok", Icon: CheckCircle2 },
  closed: { className: "bg-neutral-soft text-neutral", Icon: Clock },
  cancelled: { className: "bg-danger-soft text-danger", Icon: XCircle },
  uncertain: { className: "bg-warn-soft text-warn", Icon: TriangleAlert },
};

export function statusWord(
  status: PublicActivityStatus,
  labels: {
    statusOpen: string;
    statusClosed: string;
    statusCancelled: string;
    statusUncertain: string;
  },
) {
  switch (status) {
    case "open":
      return labels.statusOpen;
    case "cancelled":
      return labels.statusCancelled;
    case "uncertain":
      return labels.statusUncertain;
    default:
      return labels.statusClosed;
  }
}

/** Rule 1: colour never alone — icon **and** word, every time. */
export function StatusPill({
  status,
  label,
  detail,
  className,
}: {
  status: PublicActivityStatus;
  label: string;
  detail?: string | null;
  className?: string;
}) {
  const { className: tone, Icon } = STATUS_PRESENTATION[status];
  return (
    <span
      className={cn(
        "rounded-chip inline-flex items-center gap-2 px-2.5 py-1.5 text-sm font-semibold",
        tone,
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span>{label}</span>
      {detail ? (
        <span className="font-medium opacity-90">· {detail}</span>
      ) : null}
    </span>
  );
}

/** "Checked <date>" — freshness is content, not chrome (§5). */
export function FreshnessNote({
  label,
  value,
  tone = "ok",
  className,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "neutral";
  className?: string;
}) {
  const toneClass =
    tone === "warn"
      ? "text-warn"
      : tone === "neutral"
        ? "text-copy-muted"
        : "text-ok";
  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium",
        toneClass,
        className,
      )}
    >
      <ShieldCheck className="size-4" aria-hidden />
      <span>
        {label} <span className="font-semibold">{value}</span>
      </span>
    </p>
  );
}

const calloutStyles = cva(
  "rounded-card flex items-start gap-3 border p-4 text-base",
  {
    variants: {
      tone: {
        info: "border-brand-soft bg-brand-soft text-brand-soft-ink",
        warning: "border-warn/40 bg-warn-soft text-warn",
        danger: "border-danger/40 bg-danger-soft text-danger",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

const CALLOUT_ICON = {
  info: Info,
  warning: TriangleAlert,
  danger: CircleAlert,
} as const;

/** Notice: icon, bold one-line summary, then detail (§5). */
export function Callout({
  tone = "info",
  title,
  children,
  className,
  role = "status",
}: {
  tone?: "info" | "warning" | "danger";
  title?: string;
  children?: ReactNode;
  className?: string;
  role?: "status" | "alert" | "note";
}) {
  const Icon = CALLOUT_ICON[tone];
  return (
    <div
      role={role === "note" ? undefined : role}
      className={cn(calloutStyles({ tone }), className)}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? (
          <div
            className={cn("text-[0.95rem] leading-relaxed", title && "mt-1")}
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** A count with its label. Never used for anything the reader must act on. */
export function Stat({
  value,
  label,
  className,
}: {
  value: number | string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="font-display text-ink text-3xl font-bold tabular-nums leading-none">
        {value}
      </span>
      <span className="text-copy-muted text-xs font-bold uppercase tracking-[0.1em]">
        {label}
      </span>
    </div>
  );
}

/** Metadata row: uppercase label, then value. Labels are never body copy. */
export function MetaRow({
  label,
  icon,
  children,
  className,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}
    >
      <dt className="text-copy-muted inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em]">
        {icon}
        {label}
      </dt>
      <dd className="text-ink min-w-0 flex-1 text-[0.95rem] leading-snug">
        {children}
      </dd>
    </div>
  );
}

export const inlineLinkClass =
  "text-brand-deep font-medium underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded-sm";
