# Calais Info — Engineering Notes (patterns adopted from prior projects)

> `PRODUCT.md` is the canonical product requirements document. This file records proven engineering patterns extracted from two of the operator's existing monorepos — `EP-next` (echoparol) and `GFB/kawa-web` (zenkap) — examined 18 July 2026. These are **notes to build on, not code**: when Slice 0 starts, this is the blueprint.

Both repos independently converged on the same shape (pnpm + Turborepo, `apps/{web,mobile}`, shared packages, Drizzle). That shape is proven twice by the same operator — adopt it, don't reinvent it.

## 1. Monorepo blueprint — adopt

```text
apps/
  web/        Next.js (SSR public site + workspace + API)
  mobile/     Expo / React Native
packages/
  tokens/     design tokens (see §2)
  shared/     domain logic, i18n catalogs, constants (status/freshness rules)
  api-client/ typed client consumed by web and mobile
  validation/ zod schemas shared by API and clients
  config/     shared eslint/tsconfig presets
```

- Turborepo task graph with `build`/`lint`/`typecheck`/`test` and `dependsOn: ["^build"]`; dev tasks `persistent, cache:false` (EP-next `turbo.json`).
- Root scripts proxy into workspaces (`pnpm db:migrate`, `dev:web`, `dev:mobile`, `mobile:build:*`) so one command surface drives everything.
- `pnpm-workspace.yaml` security overrides **with a comment explaining each CVE and why the bump is safe** (EP-next) — adopt the habit, not just the mechanism.
- A `check:ci` aggregate script (kawa) and `check:local` (EP-next: i18n generate → lint → typecheck → i18n checks → build) — one command answers "is this repo healthy?"

## 2. Shared design tokens — adopt

EP-next `packages/design-tokens`: typed semantic themes (`light`/`dark` `SemanticTheme` objects, `designRadii`, border widths) consumed by **both** platforms — web through a CSS-variable injector component, mobile through a theme runtime (`apps/mobile/src/theme.ts`).

For Calais Info: `packages/tokens` is the single encoding of `DESIGN.md` §2 (both palettes already exist — the prototype's light/dark CSS variables port directly). Hard rule from kawa's AGENTS.md, adopted verbatim: **no color decisions in JSX/component CSS — token package only, consumed semantically.**

## 3. i18n pipeline — adopt, with one Calais-specific split

EP-next mechanism (`scripts/generate-shared-i18n-resources.mjs`):

- `packages/shared/src/locales.json` is the locale registry; `messages/{locale}.json` are the catalogs.
- A generator compiles them into a typed TS module consumed by web **and** mobile — one source of truth, two runtimes.
- The generator **fails the build if a registered locale is missing its catalog**; `check:i18n` and `check-locale-branches` validate drift; `scaffold-locale` bootstraps a new language.

Calais Info split to respect: this pipeline is for **UI strings only**. Public _content_ translations (services, articles) live in the database with per-language review states and fallback rules (`DATABASE-SCHEMA.md` §2) — never in code catalogs. The registry maps to `core.languages`; the fail-on-missing-catalog behavior implements §17's "a language is an operational commitment."

Cautionary tale from the same repo: `fix-missing-translations.mjs`, `fix-tour-search-translations.mjs` — one-off repair scripts accumulating means catalog debt crept in. Prevention: the check scripts run in CI from day one, and RTL (Arabic) is in the catalog from the first commit, not retrofitted.

## 4. Database migration discipline — adopt (this is the best find)

kawa `drizzle/README.md` workflow:

- `0000_baseline_schema.sql` + named, numbered SQL migrations; `meta/_journal.json` validated by a migration wrapper.
- **Custom SQL migrations for DB-level enforcement** — kawa's `0001_invoice_immutability_triggers.sql` enforces French e-invoicing immutability _in the database_. Calais Info has the identical need three times over: append-only inventory ledger, immutable publication revisions, audit events. Triggers, not application promises.
- `db:migrate:verify` runs the full migration chain against a **disposable database** in CI/pre-release.
- **Never `db:push` against persistent environments**; guarded one-time baseline/rebase via explicit env flags (`ALLOW_MIGRATION_BASELINE=true`) with automatic backup of prior journal rows.
- `drizzle/seed/` folder for seed data — Calais Info's taxonomy catalogs (categories, specialities, audiences, cities, languages) are seeds.

## 5. Testing and quality gates — adopt

- Split runners (EP-next `scripts/run-{unit,integration,api,e2e}-tests.mjs`; Playwright for e2e; Vitest workspaces).
- **Coverage gate** (kawa): `test:coverage:gate` with a strict env flag and a summary script with `--enforce` — coverage is a CI gate, not a report. For Calais Info, the strict set starts with the boundaries: tenant isolation, publish gates, never-public invariants (`SUSTAINABILITY.md` AI practices).
- `dependency-cruiser` with a config enforcing package boundaries (EP-next `deps:check`) — mechanical enforcement of "domain never imports app code, api-client never imports server code". This is the tool that makes the monorepo layout _stay_ the layout.
- Env validation exists in EP-next (`SKIP_ENV_VALIDATION` flag implies a validated env schema) — adopt validated env (t3-env style); avoid normalizing the skip flag.

## 6. AGENTS.md — adopt, merged and improved

Both repos keep standing AI instructions at the repo root; kawa's points to a **mandatory** `docs/UI_DESIGN_REFERENCE.md`, EP-next's is a full design contract ("build in the spirit of Linear/Stripe; when a choice feels like a generic AI UI move, pick the harder, cleaner option"; component defaults; accent policy; token paths).

Calais Info's AGENTS.md (written at repo bootstrap) should contain:

- `DESIGN.md` and `DESIGN-BRIEF.md` are mandatory, not inspiration; tokens only via `packages/tokens`; reuse before inventing.
- The suite's own rules AI sessions must carry: demo-data labeling, never-public invariants, the cross-doc consistency pass after doc edits, context packs per slice (`SUSTAINABILITY.md`).
- The anti-generic rule, adapted: when a choice feels like a default AI dashboard, take the calmer option from `DESIGN.md` — public pages are calm under stress, not impressive.

## 7. Operational docs — adopt the runbook habit

kawa `docs/` contains the documents SUSTAINABILITY.md §5 promises: `deployment-and-rollback.md`, `release-runbook.md`, `security-production-hardening-plan.md`, `production-readiness-roadmap.md`, `TEST_COVERAGE_CHECKLIST.md`, plus a regulatory gap analysis (their French e-invoicing law doc) — the same genre as our CNIL/GDPR obligations. Write these as the systems they describe are built, not after.

## 8. Mobile / EAS — adopt

EP-next's scripted EAS pipeline: named build profiles (`development-device`, `preview`, `play-internal`, `production`) driven from root scripts, including scripted store submission (`mobile:submit:*`), pinned `eas-cli` version. Supports §8.1's G1 path: direct-install/internal-track builds for the pilot while store review clears; Expo OTA keeps binaries fresh (RISKS R11).

## 9. Warts observed — avoid deliberately

- **Duplicate migration numbers** (kawa has two `0035_*.sql`): add a CI check that migration numbers are unique and sequential.
- **"TODAY" docs** (`README_CHANGES_TODAY.md`, `SCHEMA_CHANGES_TODAY.md`): symptoms of working without committing; git history + a decision log replace them.
- **One-off data-fix scripts** accumulating in `scripts/` (EP-next i18n fixes): fix at the source, delete the script after use.
- **Empty `docs/` folder** (EP-next): a docs folder that exists but holds nothing teaches agents to ignore it.
- **Wide `globalEnv` surface** in turbo config: keep secrets few, named, and validated.

## 10. Slice 0 bootstrap order (when coding starts)

> **Status 18 July 2026:** coding started from a create-t3-app scaffold (Next 15, Drizzle, NextAuth v5, Tailwind 4) and was converted to the §1 monorepo the same day: `apps/web` + `packages/tokens` (DESIGN.md encoded) under pnpm workspaces + Turborepo, with lint-staged configs per package. Steps 1–4 done; still pending: `apps/mobile` (Expo) scaffold, and `packages/{shared,api-client,validation,config}` created as they gain real content — never as empty shells.

1. `git init`, initial commit of this suite + prototype.
2. Scaffold the monorepo (§1) with `packages/tokens` from `DESIGN.md` + prototype CSS variables, and the i18n registry (fr, en, ar) with the fail-on-missing generator (§3).
3. `drizzle/` with `0000_baseline` for the Slice 0 subset (~25–30 tables), immutability/audit triggers as custom SQL (§4), taxonomy seeds.
4. `AGENTS.md` (§6), `check:ci`, dependency-cruiser config, coverage gate skeleton (§5).
5. Web + mobile apps consuming `shared`/`tokens`/`api-client`; EAS profiles (§8).
