# Calais Info — UI Architecture

> `PRODUCT.md` remains canonical for product scope. `DESIGN.md` remains canonical for visual and interaction behavior. This document defines how those contracts are implemented across web and native surfaces.

**Status:** Adopted 19 July 2026  
**Decision:** Tamagui for universal UI; shadcn for the authenticated web workspace.

## 1. Decision

Calais Info has one design system and two rendering layers:

| Layer               | Scope                                                                                                                                             | Technology                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Product foundations | Semantic tokens, UI-message catalogs, status/freshness rules, validation, permissions                                                             | `packages/{tokens,shared,validation}`                       |
| Universal UI        | Public journeys, authentication, invitation acceptance, member/mobile agenda, mobile field actions, signing actions, inventory scan/search        | Tamagui in `packages/ui`                                    |
| Web workspace UI    | Platform editor and organisation workspace tables, forms, review queues, calendars, planners, imports, documents, audit, inventory administration | shadcn open-code components in `apps/web/src/components/ui` |
| Feature composition | Product-specific public, member, editor, coordination, document, and inventory components                                                         | The owning app; share domain behavior before JSX            |

The boundary follows the interaction, not the person's title. An organisation coordinator may use a shadcn staffing planner on desktop and a Tamagui personal agenda on mobile. Those views share domain rules and data contracts, not necessarily component trees.

## 2. Package and import boundaries

```text
packages/
  tokens/       canonical semantic themes and dimensions
  shared/       i18n, domain states, freshness/status behavior
  validation/   shared input contracts
  ui/           Tamagui configuration and universal components

apps/web/src/
  components/ui/       shadcn-generated web primitives
  components/admin/    Calais workspace patterns composed from shadcn
  app/.../dashboard/   authenticated web screens
```

- `packages/ui` must not import shadcn, Base UI, DOM-only helpers, or Tailwind-only components.
- `apps/web/src/components/ui` must not be imported by Expo or another universal package.
- Authentication and another genuinely cross-platform flow may continue using Tamagui on web.
- A dashboard route uses shadcn for controls and interactive primitives. Do not mix a Tamagui and shadcn button, input, dialog, select, or tooltip inside the same workspace flow.
- Server Components own data loading and authorization. Client components begin at the smallest interactive shadcn boundary.

## 3. Reuse rule

Before creating a UI primitive:

1. On a public/mobile/universal surface, use or adapt the Tamagui equivalent.
2. In the authenticated web workspace, use or adapt the installed shadcn equivalent.
3. Create a Calais feature component by composing those primitives.
4. Hand-roll a primitive only when neither library has a suitable accessible equivalent; record the reason in the component comment.

Semantic structure is not a primitive-library concern. Continue to use the correct HTML landmarks, headings, lists, forms, links, hidden form fields, and table semantics. The rule prevents duplicate buttons, inputs, dialogs, menus, tables, cards, badges, and similar controls; it does not replace meaningful HTML with generic wrappers.

shadcn code is owned source, not an unmodified visual authority. Generated components may be adapted for accessibility, localization, density, and Calais behavior. Re-running the CLI with `--overwrite` requires reviewing and reapplying local changes.

## 4. Token contract

`packages/tokens` is the only source of color, spacing, radius, and state meaning.

- Tamagui maps the typed token objects in `packages/ui/src/config.ts`.
- Web injects the same values as `--calais-*` CSS variables.
- Tailwind and shadcn aliases resolve to those variables in `apps/web/src/styles/globals.css`.
- shadcn-generated OKLCH palettes are removed. Components never introduce an independent `primary`, `destructive`, `card`, or sidebar palette.
- Status color is always paired with text and, when useful, an icon.

## 5. Installed web primitives

The initial set covers the Slice 0 console and the next committed publishing workflows:

- actions and feedback: button, badge, alert, alert dialog, tooltip, skeleton, empty state;
- forms: field, label, input, input group, textarea, native select, composed select, checkbox;
- overlays and choice: dialog, sheet, popover, dropdown menu, command, autocomplete combobox with single and multiple selection;
- structure: sidebar, card, table, tabs, separator;
- schedule support: calendar;
- localization infrastructure: direction provider.

Add later components only when a committed slice consumes them. A staffing board, rich-text editor, calendar/list agenda, data table, or inventory ledger is a Calais feature pattern, not a generic shadcn block copied wholesale.

Activity authoring composes the shadcn form and combobox primitives with InkPilot as the rich-text editing engine. InkPilot does not become a second workspace component system: Calais owns its semantic-token theme, locale strings, accessible labelling, and media policy. Activity titles remain standard localized fields; each language has a separate rich description. Images are disabled, and the server sanitizes the submitted HTML and derives plain text before storage.

## 6. RTL, accessibility, and density

- `components.json` keeps `rtl: true`; use logical `start`/`end`, `ps`/`pe`, and locale direction for portals.
- French, English, and Arabic states are tested even when a phase exit criterion names only French and English for pilot operators.
- Workspace controls target at least 36×36 CSS pixels; public and mobile controls target at least 44×44.
- Focus must remain visible. Dialogs, sheets, menus, and popovers must restore focus and be usable by keyboard.
- Dense tables are permitted only in the authenticated workspace. At narrow widths, they scroll, reduce columns, or become a task-focused alternative rather than compressing unreadably.

## 7. Proactive freshness interaction

The workspace does not wait for editors to discover stale information. It produces a small, ranked action queue based on public impact, occurrence time, uncertainty, translation completeness, and review due date.

The reusable pattern is **confirm, correct, cancel, or mark uncertain**:

- A recurring activity scheduled today can be explicitly confirmed for that occurrence after the editor checks that it is operating as published. Reusable services attached to the activity do not receive their own schedule or freshness timestamp.
- A due place or safe contact can be confirmed unchanged, corrected, or marked uncertain.
- A due article or fixed-information record can be reviewed as still accurate or opened for revision.
- A translation reviewer can confirm that a translation still matches the current source revision; viewing it alone never verifies it.
- A coordination occurrence, inventory alert, or document task uses its own private acknowledgement/resolution state and never changes public freshness implicitly.

Rules:

1. Opening, viewing, signing in, or dismissing a prompt never refreshes data.
2. Every confirmation names its exact scope and records actor and time.
3. One-tap confirmation is allowed only for an unchanged record the actor is authorized and able to verify.
4. Batch confirmation shows every included record and never crosses organisations silently.
5. Change, cancellation, uncertainty, and missing-information paths remain adjacent to confirmation.
6. Operational changes may create a public review task but never publish or disclose private operational data automatically.
7. Dashboard counts support action; vanity charts and passive metrics are excluded.
8. The wide-screen runbook keeps a full month calendar visible; status dots summarize scheduled, confirmed, attention, and cancelled dates, while the selected date controls the central occurrence list.
   Its calendar/create/attention rail can collapse to a narrow restore control, and the preference persists on that device. Narrow screens keep the information in normal document flow instead of hiding it.
9. At the Phase 3 gate, activity members are assigned by organisation email and linked to the same stable membership when they authenticate later. Public attribution is a separately authored projection; the workspace never sends member rows or emails to a public query. Before that gate, this workflow is exercised only with labelled fictional local data.

## 8. Adoption and verification

- Migrate existing hand-built dashboard primitives incrementally, preserving server actions and form behavior.
- Verify `pnpm check:ci` after component generation or customization.
- Visually check representative desktop, 320–390 px, dark theme, long French/English labels, and Arabic RTL states.
- Before adding or updating a shadcn primitive, review its copied source, dependency impact, focus behavior, and RTL behavior.
