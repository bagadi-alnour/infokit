"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon, type IconName } from "~/components/icons";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";

export interface CommandSearchItem {
  href: string;
  label: string;
  icon: IconName;
  /** Words an editor may type instead of the label (synonyms, old names). */
  keywords?: readonly string[];
  /** Short trailing context, e.g. the section the destination belongs to. */
  hint?: string;
}

export interface CommandSearchGroup {
  label: string;
  items: readonly CommandSearchItem[];
}

/**
 * One keyboard-first entry point to every console destination: pages and the
 * create actions that would otherwise take two clicks through the sidebar.
 * The field in the navbar *is* the search field — suggestions drop straight
 * below it, so there is never a second input to look at. Everything it offers
 * is a link, so the palette never becomes the only way to reach something.
 */
export function AdminCommandSearch({
  groups,
  labels,
}: {
  groups: readonly CommandSearchGroup[];
  labels: {
    open: string;
    placeholder: string;
    shortcut: string;
    title: string;
    empty: string;
  };
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(href);
  }

  return (
    <Command
      ref={rootRef}
      loop
      label={labels.title}
      className="relative h-auto min-w-0 flex-1 overflow-visible bg-transparent p-0 md:max-w-md"
    >
      <CommandInput
        ref={inputRef}
        value={query}
        onValueChange={(value) => {
          setQuery(value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        // Escape closes the list without leaving the field, so a second click
        // in the still-focused field has to bring it back.
        onClick={() => {
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        placeholder={labels.placeholder}
        aria-label={labels.open}
        className="pe-12"
      />
      {/* A key combination reads left to right in every locale: in Arabic the
       * bidi algorithm would otherwise render "⌘K" as "K⌘". */}
      <kbd
        dir="ltr"
        aria-hidden
        className="border-line bg-subtle text-copy-muted pointer-events-none absolute end-2.5 top-1/2 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 text-[10px] font-semibold lg:inline-block"
      >
        {labels.shortcut}
      </kbd>
      {open ? (
        <div className="border-line bg-popover text-popover-foreground absolute top-full z-50 mt-1.5 w-full min-w-64 rounded-lg border p-1 shadow-md">
          <CommandList>
            <CommandEmpty>{labels.empty}</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.items.map((item) => (
                  <CommandItem
                    key={`${group.label}:${item.href}:${item.label}`}
                    value={`${item.label} ${item.hint ?? ""}`}
                    keywords={item.keywords ? [...item.keywords] : undefined}
                    onSelect={() => {
                      go(item.href);
                    }}
                  >
                    <Icon name={item.icon} size={16} />
                    <span className="truncate">{item.label}</span>
                    {item.hint ? (
                      <span className="text-copy-muted min-w-0 flex-1 truncate text-end text-xs">
                        {item.hint}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </div>
      ) : null}
    </Command>
  );
}
