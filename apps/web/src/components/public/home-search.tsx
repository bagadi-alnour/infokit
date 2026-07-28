"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { Building2, MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { TaxonomyIcon } from "~/components/taxonomy-icon";
import {
  matchingSuggestionGroups,
  type SearchSuggestion,
  type SearchSuggestionGroup,
} from "~/lib/search-suggestions";

/**
 * Enough rows per heading to show that a heading has more behind it, few enough
 * that five headings still fit on a phone screen above the keyboard.
 */
const ROWS_PER_GROUP = 4;

/** The glyph for the two kinds the taxonomy has no icon for. */
const KIND_ICONS = {
  place: MapPin,
  organization: Building2,
} as const;

function SuggestionGlyph({ suggestion }: { suggestion: SearchSuggestion }) {
  const Fallback =
    suggestion.kind === "place" || suggestion.kind === "organization"
      ? KIND_ICONS[suggestion.kind]
      : null;
  return (
    <span
      className="bg-brand-soft text-brand-deep rounded-chip flex size-9 shrink-0 items-center justify-center"
      aria-hidden
    >
      {suggestion.icon ? (
        <TaxonomyIcon name={suggestion.icon} size={18} />
      ) : Fallback ? (
        <Fallback className="size-[18px]" />
      ) : null}
    </span>
  );
}

/**
 * The home page's search box, with the published words offered as you type.
 *
 * It is a plain GET form first and a suggestion list second, in that order. The
 * input is `name="q"` and the form's action is the activity list, which seeds its
 * own search box from `?q=` and searches the whole published set. What the popup
 * adds is a shortcut, not the way in — on a device where the script never
 * arrives, or fails, the form is still a form and the reader loses nothing
 * (docs/DESIGN-SYSTEM.md §2 rule 7, degradation order).
 *
 * There is no Search button beside the field: a phone keyboard puts its own search
 * key where the thumb already is, the suggestions are the affordance on a desktop,
 * and a button that repeated what Enter does only made the field narrower. Which
 * is why Enter is handled here rather than left to the browser's implicit
 * submission — with no button in the form, that is the page's only search, and it
 * is worth being explicit about instead of inherited.
 *
 * Nothing is typed anywhere but into this page. The index is delivered with the
 * page, matching happens in the browser, and no keystroke is ever sent to a
 * server — a search box on a site read by people who cannot afford to be
 * searchable must not become a log of what they need (docs/PRODUCT.md §3).
 *
 * The popup opens only once something typed actually matches: an empty dropdown
 * under a search box reads as "there is nothing", which would be a lie about the
 * corpus rather than a fact about the four letters typed so far.
 */
export function HomeSearch({
  action,
  groups,
  labels,
}: {
  /** Where the form goes when the reader just presses Enter. */
  action: string;
  groups: SearchSuggestionGroup[];
  labels: {
    /** The box's accessible name — it says what can be searched. */
    search: string;
    placeholder: string;
  };
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [wantsPopup, setWantsPopup] = useState(false);

  const matches = useMemo(
    () => matchingSuggestionGroups({ groups, query, perGroup: ROWS_PER_GROUP }),
    [groups, query],
  );

  return (
    <Autocomplete.Root
      items={groups}
      // Matching is ours: the folding that makes one box work in eleven
      // languages is not something a default comparison can do.
      filteredItems={matches}
      value={query}
      onValueChange={setQuery}
      itemToStringValue={(suggestion: SearchSuggestion) => suggestion.label}
      open={wantsPopup && matches.length > 0}
      onOpenChange={setWantsPopup}
      // The page behind the popup keeps scrolling: this is a suggestion, not a
      // dialogue the reader has to finish.
      modal={false}
    >
      <form
        action={action}
        method="get"
        role="search"
        className="mt-7 max-w-2xl"
      >
        <label htmlFor="home-search" className="sr-only">
          {labels.search}
        </label>
        {/* The focus ring is drawn inside the field's own edge rather than as a
            halo around it: the popup below is the width of this box, so a ring
            that sat outside would make the field wider than its own suggestions
            for exactly as long as they are on screen. Border and ring are the
            same brand colour and meet, so what the reader sees is one 2px edge
            (docs/DESIGN-SYSTEM.md §2 rule 5). */}
        <Autocomplete.InputGroup className="border-line-strong bg-surface shadow-ring rounded-control focus-within:border-brand focus-within:outline-brand flex items-center gap-3 border px-5 focus-within:outline-1 focus-within:-outline-offset-1">
          <Search className="text-copy-muted size-5 shrink-0" aria-hidden />
          <Autocomplete.Input
            id="home-search"
            name="q"
            type="search"
            // The browser's own history dropdown would cover this one.
            autoComplete="off"
            placeholder={labels.placeholder}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing)
                return;
              // While a suggestion is highlighted, Enter belongs to that row: it
              // is the reader choosing an answer, and the row opens its own page.
              if (event.currentTarget.getAttribute("aria-activedescendant"))
                return;
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }}
            // WebKit draws its own clear cross inside a search field, in its own
            // blue: the one colour on this page that no token owns. The field
            // carries one glyph, and the suggestions carry the rest.
            className="text-ink placeholder:text-copy-muted min-h-14 w-full bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:hidden"
          />
        </Autocomplete.InputGroup>
      </form>

      <Autocomplete.Portal>
        <Autocomplete.Positioner sideOffset={8} className="isolate z-50">
          {/* The popup hangs off the field, so it is shaped like the field:
              the same width, the same hairline weight and the control radius,
              not the card radius of a panel that stands on its own
              (docs/DESIGN-SYSTEM.md §3). */}
          <Autocomplete.Popup className="border-line-strong bg-surface shadow-float rounded-control w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 overflow-hidden border duration-100">
            <Autocomplete.List className="max-h-[min(24rem,var(--available-height))] overflow-y-auto overscroll-contain p-2">
              {(group: SearchSuggestionGroup) => (
                <Autocomplete.Group
                  key={group.kind}
                  items={group.items}
                  className="not-first:border-line not-first:mt-1 not-first:border-t not-first:pt-1"
                >
                  <Autocomplete.GroupLabel className="text-eyebrow text-copy-muted px-2 pb-1 pt-2">
                    {group.label}
                  </Autocomplete.GroupLabel>
                  <Autocomplete.Collection>
                    {(suggestion: SearchSuggestion) => (
                      <Autocomplete.Item
                        key={suggestion.id}
                        value={suggestion}
                        onClick={() => {
                          router.push(suggestion.href);
                        }}
                        className="data-highlighted:bg-brand-soft rounded-control flex min-h-14 cursor-pointer select-none items-center gap-3 px-2"
                      >
                        <SuggestionGlyph suggestion={suggestion} />
                        {/* Each row is read in its own direction: an
                            association's French name inside an Arabic page is
                            still French, and without this the ellipsis eats the
                            start of the name instead of its end. */}
                        <span className="min-w-0 flex-1" dir="auto">
                          <span className="text-ink block truncate text-[0.95rem] font-semibold">
                            {suggestion.label}
                          </span>
                          {suggestion.hint ? (
                            <span className="text-copy-muted block truncate text-sm">
                              {suggestion.hint}
                            </span>
                          ) : null}
                        </span>
                      </Autocomplete.Item>
                    )}
                  </Autocomplete.Collection>
                </Autocomplete.Group>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
