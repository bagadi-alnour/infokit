import Link from "next/link";
import { type ComponentProps, type ReactNode } from "react";

import { Icon, type IconName } from "~/components/icons";
import { Badge } from "~/components/ui/badge";
import { Button as ShadcnButton } from "~/components/ui/button";
import {
  Card as ShadcnCard,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader } from "~/components/ui/empty";
import {
  Field as ShadcnField,
  FieldDescription,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SelectField } from "~/components/ui/select-field";
import {
  Table as ShadcnTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { type Freshness } from "~/lib/freshness";
import { cn } from "~/lib/utils";

/**
 * Workspace patterns per docs/DESIGN.md (compact density is allowed in
 * the authenticated workspace; the public pages get their own, calmer set).
 * All colors come from token-backed utilities — never raw values here.
 */

const pageWidths = {
  /** Lists and record editors: use the whole inset. */
  full: "",
  /** Long forms that still need two columns. */
  content: "mx-auto w-full max-w-5xl",
  /**
   * The same reading width, held against the inset's start edge: a page with
   * its own inner navigation reads from one margin, so the section list stays
   * where the sidebar left off instead of floating in the middle.
   */
  contentStart: "w-full max-w-5xl",
  /** Single-column forms — a wide field is a hard field to scan. */
  narrow: "mx-auto w-full max-w-3xl",
} as const;

/**
 * One padded shell for every workspace page, so the console does not drift
 * between routes. The runbook and the simulator flow editor are the only pages
 * that opt out — both are deliberately full-bleed.
 */
export function WorkspacePage({
  children,
  width = "full",
}: {
  children: ReactNode;
  width?: keyof typeof pageWidths;
}) {
  return (
    <div className={cn("min-w-0 px-4 py-7 md:px-7 lg:px-8", pageWidths[width])}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  action,
  back,
  badges,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
  /** Where this page came from — rendered above the title, never as a crumb trail. */
  back?: { href: string; label: string };
  /** Status carried next to the title: colour is always paired with its word. */
  badges?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {back ? (
        <Link
          href={back.href}
          className="text-copy-muted hover:text-ink mb-3 inline-flex min-h-9 items-center gap-1.5 text-sm"
        >
          <Icon name="back" size={16} />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {badges}
          </div>
          {sub ? (
            <p className="text-copy-muted mt-2 max-w-3xl text-sm">{sub}</p>
          ) : null}
        </div>
        {action ? (
          <div className="flex flex-wrap items-center gap-2">{action}</div>
        ) : null}
      </div>
    </div>
  );
}

/** Small counts that support an action — never a passive vanity metric. */
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="border-line bg-surface rounded-card border p-4">
      <p className="text-copy-muted text-xs font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-copy-muted mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

const noticeTones = {
  info: "border-brand/40 bg-brand-soft",
  ok: "border-ok/40 bg-ok-soft",
  warn: "border-warn/40 bg-warn-soft",
  danger: "border-danger/40 bg-danger-soft",
} as const;

const noticeIcons: Record<keyof typeof noticeTones, IconName> = {
  info: "clock",
  ok: "check",
  warn: "alert",
  danger: "alert",
};

/**
 * Explains a state the editor cannot change from here (read-only, suspended,
 * demo data). Icon plus words, never colour alone (docs/DESIGN-SYSTEM.md §1).
 */
export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: keyof typeof noticeTones;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "text-ink rounded-card mb-5 flex gap-3 border p-4",
        noticeTones[tone],
      )}
    >
      <span className="mt-0.5 shrink-0">
        <Icon name={noticeIcons[tone]} size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {children ? (
          <div className="text-copy-muted mt-1 text-sm">{children}</div>
        ) : null}
      </div>
    </div>
  );
}

/** Irreversible or wide-impact actions, kept away from ordinary saves. */
export function DangerZone({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-danger/40 rounded-card border border-dashed p-4">
      <h2 className="text-danger text-xs font-semibold uppercase tracking-wide">
        {title}
      </h2>
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}

/** Read-only rendering of a value an actor may see but not edit. */
export function ReadOnlyField({
  label,
  value,
  dir,
}: {
  label: string;
  value?: string | number | null;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div>
      <p className="text-copy-muted text-xs font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-line text-sm" dir={dir}>
        {value === null || value === undefined || value === "" ? "—" : value}
      </p>
    </div>
  );
}

export function Card({
  title,
  hint,
  action,
  children,
  className = "",
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ShadcnCard
      className={cn(
        "border-line bg-surface rounded-card h-full gap-0 border py-0 shadow-none ring-0",
        className,
      )}
    >
      {title ? (
        <CardHeader className="flex-row items-start justify-between gap-3 px-4 pb-0 pt-4">
          <CardTitle className="min-w-0">
            <h2 className="text-copy-muted text-xs font-semibold uppercase tracking-wide">
              {title}
            </h2>
            {hint ? (
              <p className="text-copy-muted mt-1.5 text-xs font-normal normal-case tracking-normal">
                {hint}
              </p>
            ) : null}
          </CardTitle>
          {action}
        </CardHeader>
      ) : null}
      <CardContent className={cn("p-4", title && "pt-3")}>
        {children}
      </CardContent>
    </ShadcnCard>
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
    <ShadcnField className="gap-1">
      <FieldLabel className="w-full flex-col items-stretch gap-1 leading-normal">
        <span>{label}</span>
        {children}
      </FieldLabel>
      {hint ? (
        <FieldDescription className="text-copy-muted text-xs">
          {hint}
        </FieldDescription>
      ) : null}
    </ShadcnField>
  );
}

/**
 * Same row as `Field`, for controls that are not a plain input: a wrapping
 * `<label>` would steal the click and the accessible name from a composite
 * control such as the date picker's popover trigger, so the label points at it
 * by id instead.
 */
export function ControlField({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <ShadcnField className="gap-1">
      <FieldLabel htmlFor={htmlFor} className="leading-normal">
        {label}
      </FieldLabel>
      {children}
      {hint ? (
        <FieldDescription className="text-copy-muted text-xs">
          {hint}
        </FieldDescription>
      ) : null}
    </ShadcnField>
  );
}

export function TextInput(props: ComponentProps<typeof Input>) {
  return <Input {...props} className={cn("min-h-9", props.className)} />;
}

export function TextArea(props: ComponentProps<typeof Textarea>) {
  return <Textarea {...props} className={cn("min-h-20", props.className)} />;
}

/**
 * Every dropdown in the workspace is the same control: `SelectField` takes the
 * `<option>` children a `<select>` takes, so a form reads the same as it always
 * did while the menu is drawn in our palette, under the field rather than over
 * it (docs/DESIGN-SYSTEM.md §5).
 */
export function Select(props: ComponentProps<typeof SelectField>) {
  return <SelectField {...props} className={cn("w-full", props.className)} />;
}

export type WorkspaceButtonVariant =
  "primary" | "secondary" | "danger" | "ghost";

const buttonVariantMap: Record<
  WorkspaceButtonVariant,
  NonNullable<ComponentProps<typeof ShadcnButton>["variant"]>
> = {
  primary: "default",
  secondary: "outline",
  danger: "destructive",
  ghost: "ghost",
};

export function Button({
  variant = "primary",
  className,
  type = "submit",
  ...rest
}: Omit<ComponentProps<typeof ShadcnButton>, "variant"> & {
  variant?: WorkspaceButtonVariant;
}) {
  return (
    <ShadcnButton
      {...rest}
      type={type}
      variant={buttonVariantMap[variant]}
      className={cn("min-h-9", className)}
    />
  );
}

const chipTones = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-neutral-soft text-neutral",
  accent: "bg-brand-soft text-brand",
} as const;

export type ChipTone = keyof typeof chipTones;

export function Chip({
  tone = "neutral",
  title,
  children,
}: {
  tone?: keyof typeof chipTones;
  /** Longer explanation of a short label — e.g. what a role code grants. */
  title?: string;
  children: ReactNode;
}) {
  return (
    <Badge
      variant="secondary"
      title={title}
      className={cn(
        "h-auto rounded-full border-0 px-2.5 py-0.5 font-semibold",
        chipTones[tone],
      )}
    >
      {children}
    </Badge>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Empty className="border-line rounded-card border py-8">
      <EmptyHeader>
        <EmptyDescription className="text-copy-muted">
          {children}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** Record table per docs/DESIGN.md workspace components. */
export const Table = ShadcnTable;

export function TH({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <TableHead
      className={cn(
        "text-copy-muted h-auto px-3 py-2 text-[11px] font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {children}
    </TableHead>
  );
}

export function TD({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <TableCell className={cn("px-3 py-2.5", className)}>{children}</TableCell>
  );
}

export { TableBody, TableHeader, TableRow };

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>
  );
}

/**
 * Server-rendered filters: a plain GET form, so a filtered list is a URL an
 * editor can bookmark, share, and reach with the keyboard alone.
 */
export function FilterBar({
  action,
  submitLabel,
  children,
}: {
  action: string;
  submitLabel: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      method="get"
      className="mb-4 flex flex-wrap items-end gap-3"
    >
      {children}
      <Button variant="secondary">{submitLabel}</Button>
    </form>
  );
}

const freshnessTone: Record<Freshness, string> = {
  today: "bg-ok",
  current: "bg-ok/50",
  due_soon: "bg-warn",
  overdue: "bg-danger",
  never: "bg-line-strong",
};

/**
 * Quiet freshness signal (docs/DESIGN-BRIEF.md §11): color paired with an
 * accessible label — never the only carrier of meaning.
 */
export function FreshnessDot({
  state,
  label,
}: {
  state: Freshness;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" title={label}>
      <span
        aria-hidden
        className={`inline-block h-2 w-2 rounded-full ${freshnessTone[state]}`}
      />
      <span className="text-copy-muted">{label}</span>
    </span>
  );
}
