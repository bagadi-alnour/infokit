# Dashboard design QA

- Reference: `/Users/bagadi/.codex/generated_images/019f79f2-00be-79a1-b241-189ea4309b7a/exec-e33c4867-d374-4adb-9b03-2327738fea91.png`
- Implementation capture: `/Users/bagadi/.codex/visualizations/2026/07/19/019f79f2-00be-79a1-b241-189ea4309b7a/dashboard-final.jpg`
- Side-by-side comparison: `/Users/bagadi/.codex/visualizations/2026/07/19/019f79f2-00be-79a1-b241-189ea4309b7a/dashboard-comparison.jpg`
- Tested viewport: 1442 × 1025 CSS pixels, English, dark theme, Calais demo organisation, 19 July 2026.
- Tested routes: `/en/dashboard` and the selected `/en/dashboard/activities` record.

## Verified experience

- Wide layout resolves to a 250 px navigation rail, an 840.86 px runbook, and a 352 px calendar/create rail with no document-level horizontal overflow.
- Calendar selection updates the runbook date and does not expose same-day freshness actions on another date.
- A same-day occurrence confirmation updates the visible state and reduces the remaining confirmation count.
- New activity, reusable-service assignment, exceptional closure, theme, and language menus open without runtime errors.
- Existing or future members can be assigned by email with expertise and association-only visibility. Public attribution reveals separately authored public name/expertise fields and never reuses the member email or private profile.
- The member, activity, service, schedule, and closure inputs have programmatic labels and keyboard-accessible native/shadcn controls.

## Findings resolved

- P1: Replaced non-navigating Base UI button/link composition with Next links styled by the shadcn button variants.
- P1: Replaced locale-dependent calendar `data-day` output with a stable ISO value to remove hydration mismatches.
- P1: Wrapped dropdown labels and items in the Base UI menu group required by the downloaded shadcn primitive.
- P1: Added explicit input/select label associations throughout the create and member-assignment workflows.
- P1: Added visible cancelled, uncertain, and confirmed occurrence badges and corrected future-date summary/all-confirmed copy.
- P2: Normalized accented demo organisation names before showing the non-publishable fixture warning.

The in-app browser screenshot transport applies device-pixel scaling to the right edge of wide captures. DOM geometry, scroll width, accessibility snapshots, and live interactions confirmed that the implementation itself keeps the 352 px right rail fully inside the viewport.

No unresolved P0, P1, or P2 findings remain.

final result: passed
