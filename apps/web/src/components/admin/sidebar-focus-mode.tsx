"use client";

import { useEffect, useRef } from "react";

import { useSidebar } from "~/components/ui/sidebar";
import { MOBILE_BREAKPOINT } from "~/hooks/use-mobile";

/**
 * Collapse the navigation rail while an editor is authoring.
 *
 * Creating or editing content is the one screen where navigation is not the
 * point: the source text and its ten translations need the width. Mount this
 * inside an authoring screen and the rail folds to icons on arrival and unfolds
 * again on the way out.
 *
 * Two things it deliberately does not do. It never re-collapses after the
 * editor opens the rail themselves — that would turn a click into a fight. And
 * it restores the rail on unmount, because collapsing writes the shared
 * `sidebar_state` cookie, and one visit to a create form should not leave the
 * console collapsed everywhere else.
 */
export function SidebarFocusMode() {
  const { state, setOpen } = useSidebar();
  // `setOpen` is rebuilt every time the rail opens or closes, so listing it as a
  // dependency would make this effect re-run on its own collapse: cleanup would
  // expand, the expansion would hand us a new `setOpen`, and we would collapse
  // again, forever. Both the setter and the live state are therefore read
  // through refs, and the effect runs once per mount.
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;
  const stateRef = useRef(state);
  stateRef.current = state;
  // Only the first render's value matters: whether the rail was open on arrival.
  const wasExpandedOnArrival = useRef(state === "expanded");
  const collapsedByUs = useRef(false);

  useEffect(() => {
    // On a narrow screen the rail is an overlay, so there is no width to
    // reclaim. `useIsMobile()` cannot answer this yet — it resolves its media
    // query in an effect and reports false on the first commit even on a phone
    // — so ask the viewport directly.
    const narrow = `(max-width: ${String(MOBILE_BREAKPOINT - 1)}px)`;
    if (window.matchMedia(narrow).matches) {
      return;
    }
    if (!wasExpandedOnArrival.current) return;
    collapsedByUs.current = true;
    setOpenRef.current(false);
    return () => {
      if (collapsedByUs.current && stateRef.current === "collapsed") {
        setOpenRef.current(true);
      }
      collapsedByUs.current = false;
    };
  }, []);

  return null;
}
