# AI Project Instructions — InfoKit

Standing instructions for every AI session in this repository. `docs/PRODUCT.md` is the canonical product requirements document; nothing generated here may expand or contradict it.

## What this is

A multilingual public-information platform for people seeking practical help, and a coordination tool for the associations serving them. The platform is city-agnostic by design; Calais is the first city to launch, not the product's identity. Users are under stress, on cheap phones, on expensive data, reading in one of eleven configured languages. Read `docs/PRODUCT.md` §2–§8 before product decisions; `docs/ENGINEERING-NOTES.md` is the engineering blueprint.

## Hard rules

1. **The schema is the single source of truth.** `apps/web/src/server/db/schema/` implements `docs/DATABASE-SCHEMA.md` as additive per-slice subsets. First iteration is **push-mode**: `pnpm db:push` syncs the schema to the local Docker database (port 5433) while tables are empty — no migration files exist by design. Before the first persistent environment, generate a clean baseline with `db:generate`; from then on: never edit an applied migration, corrections are new migrations, and never `db:push` against a persistent environment.
2. **Design is a contract, not inspiration.** `docs/DESIGN.md` (tokens, type scale, components, anti-patterns) and `docs/DESIGN-BRIEF.md` (screens, states) are mandatory. No color decisions in JSX/component CSS — semantic tokens only. When a choice feels like a default AI dashboard move, take the calmer option: public pages are calm under stress, not impressive.
3. **Every user-facing string goes through the i18n catalog.** Complete catalogues in fr, en, ar from day one; the other eight configured languages read the English base with per-language chrome overlays (`packages/shared/src/i18n/catalogs.ts`). RTL is a designed state, not a retrofit — ar, fa, prs, ps, ckb. Public _content_ translations live in the database with review states — never in code catalogs.
4. **Never-public invariants:** unverified organisations, member personal data, draft content, simulator answers (session-only, never persisted, never logged). Coordination events are private by default — only the `public` tier a host chooses per event reaches visitors. Any query feeding a public surface goes through the public read model, not authoring tables.
5. **Demo data is labeled.** Fixtures are fictional and marked "Demo data — do not publish". Never seed real organisation claims without a verification record.
6. **Errors early.** `pnpm check:ci` must pass before any commit is proposed. Lint and typecheck findings are fixed, not suppressed; `eslint-disable` needs a comment explaining why.
7. **Commit per decision**, message says why. After editing anything in `docs/`, run a cross-document consistency check for contradictions (see `docs/SUSTAINABILITY.md` — AI delivery practices).
8. **Reuse the platform UI layer before inventing a primitive.** Public web pages use the Tailwind primitives in `apps/web/src/components/public`; authenticated web-workspace controls use the shadcn source in `apps/web/src/components/ui`; native screens use the React Native Reusables + NativeWind components in `packages/ui` (never imported by the web app). All of them consume `packages/tokens`. Do not hand-roll a button, input, select, dialog, table, card, badge, tooltip, or similar control when the owning layer has an accessible equivalent. This includes date and time entry: use `~/components/ui/date-picker` (Popover + Calendar) and the `TimePicker` block, never `<input type="date">` or `type="time"`. Semantic HTML structure and hidden form fields remain native. See `docs/UI-ARCHITECTURE.md`.

## Commands

- `pnpm check:ci` — format check + lint (cached) + typecheck; the health question.
- `pnpm db:generate --name <slug>` — new migration from schema changes.
- `pnpm dev:web` — Next.js dev server. `apps/web/start-database.sh` — local Postgres.

## Current slice

Slice 0 (`docs/PRODUCT.md` §8.1): private instrument — activities, reusable services, places, schedules, occurrence status/freshness, basic information, directory, share snippet, simulator engine, single-editor console, and the single-occurrence coordination agenda pulled forward from Phase 2. Interface strings in FR/EN/AR; public content in the eleven-language catalogue (`PRODUCT.md` §17). Defer everything else to its gate; when in doubt, verified content beats new features.

The remaining G0 work is the mobile build: `apps/mobile` renders fixtures, so the public read model needs a client before the gate ("faster than existing channels, on web **and** on the mobile build") can be answered.
