import { type ComponentProps, type ReactNode } from "react";

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
import { NativeSelect } from "~/components/ui/native-select";
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
        {sub ? <p className="text-copy-muted mt-1 text-sm">{sub}</p> : null}
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
    <ShadcnCard
      className={cn(
        "border-line bg-surface rounded-card h-full gap-0 border py-0 shadow-none ring-0",
        className,
      )}
    >
      {title ? (
        <CardHeader className="px-4 pb-0 pt-4">
          <CardTitle>
            <h2 className="text-copy-muted text-xs font-semibold uppercase tracking-wide">
              {title}
            </h2>
          </CardTitle>
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

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <Input {...props} className={cn("min-h-9", props.className)} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return <Textarea {...props} className={cn("min-h-20", props.className)} />;
}

export function Select(
  props: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
    size?: "sm" | "default";
  },
) {
  return <NativeSelect {...props} className={cn("w-full", props.className)} />;
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

export function Chip({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof chipTones;
  children: ReactNode;
}) {
  return (
    <Badge
      variant="secondary"
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
