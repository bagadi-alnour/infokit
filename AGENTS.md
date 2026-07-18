# AI Project Instructions — Calais Info

Standing instructions for every AI session in this repository. `docs/PRODUCT.md` is the canonical product requirements document; nothing generated here may expand or contradict it.

## What this is

A multilingual public-information platform for people seeking help in Calais, and a coordination tool for the associations serving them. Users are under stress, on cheap phones, on expensive data, in FR/EN/AR (more later). Read `docs/PRODUCT.md` §2–§8 before product decisions; `docs/ENGINEERING-NOTES.md` is the engineering blueprint.

## Hard rules

1. **The schema is the single source of truth.** `src/server/db/schema/` implements `docs/DATABASE-SCHEMA.md` as additive per-slice subsets. Never edit an applied migration; corrections are new migrations. Never `db:push` against a persistent environment.
2. **Design is a contract, not inspiration.** `docs/DESIGN.md` (tokens, type scale, components, anti-patterns) and `docs/DESIGN-BRIEF.md` (screens, states) are mandatory. No color decisions in JSX/component CSS — semantic tokens only. When a choice feels like a default AI dashboard move, take the calmer option: public pages are calm under stress, not impressive.
3. **Every user-facing string goes through the i18n catalog** (fr, en, ar from day one; RTL is a designed state, not a retrofit). Public _content_ translations live in the database with review states — never in code catalogs.
4. **Never-public invariants:** unverified organisations, member personal data, coordination events, draft content, simulator answers (session-only, never persisted, never logged). Any query feeding a public surface goes through the public read model, not authoring tables.
5. **Demo data is labeled.** Fixtures are fictional and marked "Demo data — do not publish". Never seed real organisation claims without a verification record.
6. **Errors early.** `pnpm check:ci` must pass before any commit is proposed. Lint and typecheck findings are fixed, not suppressed; `eslint-disable` needs a comment explaining why.
7. **Commit per decision**, message says why. After editing anything in `docs/`, run a cross-document consistency check for contradictions (see `docs/SUSTAINABILITY.md` — AI delivery practices).

## Commands

- `pnpm check:ci` — format check + lint (cached) + typecheck; the health question.
- `pnpm db:generate --name <slug>` — new migration from schema changes.
- `pnpm dev` — Next.js dev server. `./start-database.sh` — local Postgres.

## Current slice

Slice 0 (`docs/PRODUCT.md` §8.1): private instrument — services, places, schedules, statuses/freshness, basic information, directory, share snippet, simulator engine, single-editor console; FR/EN/AR. Defer everything else to its gate; when in doubt, verified content beats new features.
