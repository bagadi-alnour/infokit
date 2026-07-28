"use client";

import { Drawer } from "@base-ui/react/drawer";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Compass,
  House,
  Info,
  LogIn,
  MapPinned,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, type CSSProperties } from "react";

import { PublicAppearanceChoice } from "~/components/public/public-preferences";
import { cn } from "~/lib/utils";

export interface PublicNavItem {
  /** The section's own path, unlocalized: it also names the section's icon. */
  path: string;
  /** Where the reader goes — the same path, in their language. */
  href: string;
  label: string;
  current: boolean;
}

export interface PublicNavLabels {
  /** Accessible name of the navigation itself. */
  nav: string;
  menu: string;
  close: string;
  appearance: string;
  light: string;
  dark: string;
}

/**
 * The door the associations come in by. It is not one of the sections: nothing
 * a reader needs is behind it, so it sits below them, quieter, and says whose
 * door it is rather than only "sign in".
 */
export interface PublicSignInLink {
  href: string;
  label: string;
}

/**
 * One glyph per section, so a reader who is scanning rather than reading finds
 * the row by its shape. They are neutral on purpose: a content family may
 * colour its card, its page opening and its affordance word, and nothing else —
 * a menu is not one of the three (docs/DESIGN-SYSTEM.md §5).
 */
const sectionIcons: Record<string, LucideIcon> = {
  "/": House,
  // Activities are places you can walk to, so the section wears a pin: the
  // list's own second view is a map, and "near you" is the promise of both.
  "/activities": MapPinned,
  "/events": CalendarDays,
  "/simulator": Compass,
  "/articles": BookOpen,
  "/about": Info,
};

/** Three lines that fold into a cross, drawn rather than swapped for an icon. */
const barStyles =
  "bg-current absolute inset-x-0 h-[2px] rounded-full transition-[translate,rotate,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]";

/**
 * The panel is 3rem wider than what it shows and hangs that much past the edge
 * of the screen (Base UI calls it the bleed): a thumb that drags it further open
 * than it goes stretches the extra width instead of opening a gap at the bezel.
 * `-me-12` hangs it out, `pe-12` keeps the contents on the visible side, and the
 * resting-to-hidden distance is that much less than the full width.
 */
const bleed = "-me-12 w-[calc(min(21rem,86vw)+3rem)] pe-12";

/**
 * The rows arrive after the panel rather than with it, one just behind the
 * other, so the eye lands on the first section instead of on six at once.
 */
function rowDelay(index: number) {
  return `${String(120 + index * 35)}ms`;
}

/**
 * The sections, on a phone: one button on the bar, and a panel that slides in
 * from the reading edge with the sections written out at full size.
 *
 * Below `lg` the six sections cannot sit on one line without becoming a
 * side-scrolling strip that hides half of them and eats a third of a phone
 * screen, so they move here — each on its own 56px row, in reading order, the
 * current one marked by a rail as well as a wash (rule 1). It is a modal drawer:
 * focus stays inside it, Escape closes it, the page behind it does not scroll,
 * and a thumb can throw it back out towards the edge it came from.
 *
 * Below the sections, separated from them, are the two things that are not
 * sections: the associations' own door and the theme.
 *
 * The motion is the first thing dropped on a tired device (rule 7): every
 * transform here is decoration over a layout that is already correct, and
 * `prefers-reduced-motion` flattens all of it to a cut.
 */
export function PublicNavMenu({
  items,
  labels,
  signIn,
  direction,
}: {
  items: readonly PublicNavItem[];
  labels: PublicNavLabels;
  signIn: PublicSignInLink;
  /** The panel rests against the reading edge, which side that is. */
  direction: "ltr" | "rtl";
}) {
  const [open, setOpen] = useState(false);
  const rtl = direction === "rtl";

  return (
    <Drawer.Root
      open={open}
      onOpenChange={setOpen}
      // It leaves towards the edge it rests against, whichever way the page
      // runs: everything else here is a logical property, but a swipe is a
      // physical gesture and a translate is a physical distance (rule 8).
      swipeDirection={rtl ? "left" : "right"}
    >
      <Drawer.Trigger
        aria-label={labels.menu}
        className="border-line bg-surface text-ink hover:border-brand hover:text-brand-deep rounded-control focus-visible:outline-brand group inline-flex size-12 shrink-0 items-center justify-center border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 lg:hidden"
      >
        <span className="relative block h-4 w-6" aria-hidden>
          <span
            className={cn(
              barStyles,
              "group-data-popup-open:[translate:0_7px] group-data-popup-open:rotate-45 top-0",
            )}
          />
          <span
            className={cn(
              barStyles,
              "group-data-popup-open:opacity-0 top-[7px]",
            )}
          />
          <span
            className={cn(
              barStyles,
              "group-data-popup-open:[translate:0_-7px] group-data-popup-open:-rotate-45 top-[14px]",
            )}
          />
        </span>
      </Drawer.Trigger>

      <Drawer.Portal>
        {/* The scrim thins out under the finger as the panel is thrown away, so
         *  the page behind it comes back at the speed of the gesture. */}
        <Drawer.Backdrop className="data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:duration-0 fixed inset-0 z-50 min-h-dvh bg-black opacity-[calc(0.55*(1-var(--drawer-swipe-progress,0)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] supports-[-webkit-touch-callout:none]:absolute" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-stretch justify-end">
          <Drawer.Popup
            style={
              {
                "--menu-hidden": rtl
                  ? "calc(-100% + 3rem - 2px)"
                  : "calc(100% - 3rem + 2px)",
              } as CSSProperties
            }
            className={cn(
              "border-line bg-surface shadow-float rounded-s-panel group flex h-full flex-col border-s outline-none will-change-transform",
              bleed,
              "data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-ending-style:[transform:translateX(var(--menu-hidden))] data-starting-style:[transform:translateX(var(--menu-hidden))] data-swiping:select-none transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] [transform:translateX(var(--drawer-swipe-movement-x))]",
            )}
          >
            {/* The head repeats the bar's own padding, so the cross lands where
             *  the burger was and the title starts where the rows below it do. */}
            <div className="border-line flex items-center justify-between gap-3 border-b px-4 py-2">
              <Drawer.Title className="text-eyebrow text-copy-muted ps-2">
                {labels.menu}
              </Drawer.Title>
              <Drawer.Close
                aria-label={labels.close}
                className="text-copy-muted hover:bg-subtle hover:text-ink rounded-control focus-visible:outline-brand inline-flex size-12 items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <X className="size-5" aria-hidden />
              </Drawer.Close>
            </div>

            <nav
              aria-label={labels.nav}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"
            >
              <ul className="flex flex-col gap-1">
                {items.map((item, index) => {
                  const Icon = sectionIcons[item.path] ?? Info;
                  return (
                    <li
                      key={item.path}
                      style={{ transitionDelay: rowDelay(index) }}
                      className="group-data-starting-style:[translate:0_0.6rem] group-data-starting-style:opacity-0 transition-[translate,opacity] duration-500 ease-out"
                    >
                      <Link
                        href={item.href}
                        aria-current={item.current ? "page" : undefined}
                        onClick={() => {
                          setOpen(false);
                        }}
                        className={cn(
                          "group/row rounded-control focus-visible:outline-brand relative flex min-h-14 items-center gap-3 px-3 text-[1.0625rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                          item.current
                            ? "bg-brand-soft text-brand-soft-ink"
                            : "text-ink hover:bg-subtle",
                        )}
                      >
                        {item.current ? (
                          <span
                            className="bg-brand absolute inset-y-3 start-0 w-1 rounded-full"
                            aria-hidden
                          />
                        ) : null}
                        <Icon
                          className={cn(
                            "size-5 shrink-0",
                            item.current
                              ? "text-brand-deep"
                              : "text-copy-muted",
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">{item.label}</span>
                        <ChevronRight
                          className="text-copy-muted size-4 shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100 rtl:rotate-180"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div
              style={{ transitionDelay: rowDelay(items.length) }}
              className="border-line group-data-starting-style:[translate:0_0.6rem] group-data-starting-style:opacity-0 flex flex-col gap-3 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[translate,opacity] duration-500 ease-out"
            >
              <Link
                href={signIn.href}
                onClick={() => {
                  setOpen(false);
                }}
                className="group/row text-copy-muted hover:bg-subtle hover:text-ink rounded-control focus-visible:outline-brand flex min-h-12 items-center gap-3 px-3 text-[0.95rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <LogIn className="size-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">{signIn.label}</span>
                <ChevronRight
                  className="size-4 shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100 rtl:rotate-180"
                  aria-hidden
                />
              </Link>

              <PublicAppearanceChoice
                label={labels.appearance}
                lightLabel={labels.light}
                darkLabel={labels.dark}
              />
            </div>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
