import { cva, type VariantProps } from "class-variance-authority";
import {
  CalendarDays,
  CircleAlert,
  Clock,
  Info,
  ShieldCheck,
  TriangleAlert,
  Video,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type {
  ComponentProps,
  ComponentType,
  ElementType,
  ReactNode,
} from "react";

import type { PublicActivityStatus } from "@infokit/shared/public-content";
import { familyStyles, type ContentFamily } from "~/lib/content-families";
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

/** The link that swallows its whole card, so the card is the touch target. */
export const cardLink =
  "rounded-control after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2";

/**
 * A card's own frame: the padding, the column, and the position that lets
 * `cardLink` cover it. It does not move under the pointer — an answer that
 * shifts as the cursor crosses it is chrome competing with what it says.
 */
export const cardShell = "relative flex flex-col p-5";

/**
 * The same frame, answering the pointer by rising 2px. Kept for the shelves
 * where a card is one of several routes onward rather than the answer itself.
 * No shadow moves: shadows are the second thing this site drops (§2 rule 7).
 */
export const liftCard = `${cardShell} transition-all hover:-translate-y-0.5`;

/** Card surface: ring first, shadow second (docs/DESIGN-SYSTEM.md §4). */
export function SurfaceCard({
  className,
  as: As = "div",
  ...props
}: Omit<ComponentProps<"div">, "ref"> & {
  as?: "div" | "article" | "section" | "li" | "ul";
}) {
  // Polymorphic on a closed set of block elements; the props we accept are the
  // common HTML attributes, so a single loose element type is enough here.
  const Component = As as ElementType;
  return (
    <Component
      className={cn(
        // A card is one thing: on paper it is never split across two sheets.
        "bg-surface border-line rounded-card shadow-ring border print:break-inside-avoid",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The families are shared with the console (docs/DESIGN-SYSTEM.md §5), so the
 * table itself lives in ~/lib/content-families and both surfaces read it.
 */
export { familyStyles, type ContentFamily };

export function Eyebrow({
  children,
  family = "activity",
  className,
}: {
  children: ReactNode;
  /** Tints the eyebrow — the one element that carries the family on an opening. */
  family?: ContentFamily;
  className?: string;
}) {
  const tone = familyStyles[family];
  return (
    <p className={cn("text-eyebrow", tone.text, className)}>
      <span
        className={cn(
          "me-2 inline-block size-2 rounded-full align-middle",
          tone.dot,
        )}
        aria-hidden
      />
      {children}
    </p>
  );
}

/**
 * An event is a date first, so the date gets the one washed block the agenda
 * family is allowed (docs/DESIGN-SYSTEM.md §5) — and it doubles as the control
 * that keeps it: one tap and the event is in the reader's own calendar, hour and
 * timezone included, instead of being re-typed onto the wrong day.
 *
 * Shared by the agenda and the single-event page so the hue follows the content
 * from the list into the detail screen on the same element, rather than the page
 * drawing the date as one more neutral chip.
 */
export function EventDateBlock({
  href,
  dateLabel,
  timeLabel,
  ariaLabel,
  className,
}: {
  href: string;
  dateLabel: string;
  timeLabel: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      aria-label={ariaLabel}
      className={cn(
        "rounded-control focus-visible:outline-brand bg-event-wash text-event hover:shadow-ring inline-flex items-center gap-2 px-3 py-1.5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2",
        className,
      )}
    >
      <CalendarDays className="size-4 shrink-0" aria-hidden />
      <span className="underline decoration-1 underline-offset-2">
        {dateLabel}
      </span>
      <span className="inline-flex items-center gap-1.5 font-medium">
        <Clock className="size-4 shrink-0" aria-hidden />
        {timeLabel}
      </span>
    </a>
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

/**
 * Where an online event happens, said the way a place is said — one chip, in
 * the same row as the date.
 *
 * It is a link when the organisers have published one, opening in its own tab
 * like the map link does: someone reading an agenda is still deciding, and
 * losing the list to look at a meeting room is a bad trade. Without a link it
 * is still worth saying: "online" answers "can I attend from here", which is
 * the question, and the link often arrives later than the announcement.
 */
export function OnlineChip({
  label,
  url,
}: {
  label: string;
  url: string | null;
}) {
  const chip = (
    <Chip
      icon={<Video className="size-4" aria-hidden />}
      className={
        url
          ? "hover:border-brand hover:text-brand-deep underline decoration-1 underline-offset-2"
          : undefined
      }
    >
      {label}
    </Chip>
  );
  if (url === null) return chip;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="rounded-chip focus-visible:outline-brand focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {chip}
    </a>
  );
}

/**
 * The glyph an "open now" pill wears instead of a check: a dot with a beat.
 *
 * A check says "this was verified", which is the freshness marker's job and the
 * wrong claim on a state that is only true at this minute — a live dot is what a
 * reader already reads as "now". The dot takes the pill's own colour and the beat
 * is the halo behind it, so a reader who has asked for less motion keeps the dot
 * and loses only the pulse (docs/DESIGN-SYSTEM.md §2 rule 7). The word beside it
 * still says "Open", which is what carries the state (rule 1).
 */
function LiveDot({
  className,
}: {
  className?: string;
  "aria-hidden"?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
      aria-hidden
    >
      <span className="absolute size-2.5 animate-ping rounded-full bg-current opacity-60" />
      <span className="relative size-2.5 rounded-full bg-current" />
    </span>
  );
}

/** An icon, or the beating dot: sized and hidden by the pill that draws it. */
type StatusGlyph = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean;
}>;

const STATUS_PRESENTATION: Record<
  PublicActivityStatus,
  { className: string; Icon: StatusGlyph }
> = {
  open: { className: "bg-ok-soft text-ok", Icon: LiveDot },
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

/**
 * "Checked 3 days ago" — freshness is content, not chrome (§5).
 *
 * The value is worded by the server, as an age: `dateTime` carries the instant
 * itself so a machine reads the claim exactly, and `title` gives a pointer the
 * calendar date behind the wording. Both are optional — a record that has never
 * been checked has no instant to name.
 */
export function FreshnessNote({
  label,
  value,
  dateTime,
  title,
  tone = "ok",
  className,
}: {
  label: string;
  value: string;
  dateTime?: string | null;
  title?: string;
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
      <ShieldCheck className="size-4 shrink-0" aria-hidden />
      <span>
        {label}{" "}
        {dateTime ? (
          <time dateTime={dateTime} title={title} className="font-semibold">
            {value}
          </time>
        ) : (
          <span className="font-semibold">{value}</span>
        )}
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
        {/* The glyph is the accent, the word is not: rule 4 gives the mid-tone
            accent to fills, icons and borders, and a row whose icon is drawn in
            the metadata grey has two greys where it needs one — the eye has
            nothing to run down the column by. This is what `Chip` already does
            with its own icon. */}
        {icon ? (
          <span className="text-brand flex items-center">{icon}</span>
        ) : null}
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
