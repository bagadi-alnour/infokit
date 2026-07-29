# InfoKit — Engineering Notes (patterns adopted from prior projects)

> `PRODUCT.md` is the canonical product requirements document. This file records proven engineering patterns extracted from two of the operator's existing monorepos — `EP-next` (echoparol) and `GFB/kawa-web` (zenkap) — examined 18 July 2026. These are **notes to build on, not code**: when Slice 0 starts, this is the blueprint.

Both repos independently converged on the same shape (pnpm + Turborepo, `apps/{web,mobile}`, shared packages, Drizzle). That shape is proven twice by the same operator — adopt it, don't reinvent it.

## 1. Monorepo blueprint — adopt

```text
apps/
  web/        Next.js (SSR public site + workspace + API)
  mobile/     Expo / React Native
packages/
  tokens/     design tokens (see §2)
  ui/         React Native Reusables + NativeWind components (apps/mobile only)
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

EP-next `packages/design-tokens`: typed semantic themes (`light`/`dark` `SemanticTheme` objects, `designRadii`, border widths) consumed by **both** platforms.

For InfoKit: `packages/tokens` is the single encoding of `DESIGN.md` §2. There is no universal component layer — a component is written once per platform, and what crosses the boundary is tokens, data contracts, and copy. `packages/ui` maps the tokens into a NativeWind preset plus React Native Reusables components for `apps/mobile` and is never imported by Next.js; the public web site uses Tailwind primitives in `apps/web/src/components/public`, and the authenticated web workspace uses shadcn open-code primitives in `apps/web/src/components/ui`, because its tables, planners, review queues, imports, audit views, document queues, and inventory ledgers are deliberately web-native. Every layer adapts the same semantic tokens under the same utility names; none of them introduces a second palette. See `UI-ARCHITECTURE.md` for the import boundary and reuse rules. Hard rule from kawa's AGENTS.md, adopted verbatim: **no color decisions in JSX/component CSS — token package only, consumed semantically.**

## 3. i18n pipeline — adopt, with one InfoKit-specific split

EP-next mechanism (`scripts/generate-shared-i18n-resources.mjs`):

- `packages/shared/src/locales.json` is the locale registry; `messages/{locale}.json` are the catalogs.
- A generator compiles them into a typed TS module consumed by web **and** mobile — one source of truth, two runtimes.
- The generator **fails the build if a registered locale is missing its catalog**; `check:i18n` and `check-locale-branches` validate drift; `scaffold-locale` bootstraps a new language.

InfoKit split to respect: this pipeline is for **UI strings only**. Public _content_ translations (activities, reusable services, articles) live in the database with immutable source-version links, per-language quality states, separate locale publication, and fallback rules (`DATABASE-SCHEMA.md` §2). Code catalogs never hold public content. The registry maps to `core.languages`; the fail-on-missing-catalog behavior implements §17's "a language is an operational commitment."

Cautionary tale from the same repo: `fix-missing-translations.mjs`, `fix-tour-search-translations.mjs` — one-off repair scripts accumulating means catalog debt crept in. Prevention: the check scripts run in CI from day one, and RTL (Arabic) is in the catalog from the first commit, not retrofitted.

## 4. Database migration discipline — adopt (this is the best find)

kawa `drizzle/README.md` workflow:

- `0000_baseline_schema.sql` + named, numbered SQL migrations; `meta/_journal.json` validated by a migration wrapper.
- **Custom SQL migrations for DB-level enforcement** — kawa's `0001_invoice_immutability_triggers.sql` enforces French e-invoicing immutability _in the database_. InfoKit has the identical need three times over: append-only inventory ledger, immutable publication revisions, audit events. Triggers, not application promises.
- `db:migrate:verify` runs the full migration chain against a **disposable database** in CI/pre-release. _Done by hand for the baseline_ — the chain was applied to a second, empty database in the same cluster and its `pg_dump --schema-only` diffed against the real one; wiring that into CI is still open (`SCHEMA-DELIVERY-PLAN.md` §0.3).
- **Never `db:push` against persistent environments.** _Landed 29 July 2026, by a different mechanism than the flag first sketched here._ `apps/web/scripts/db-push-guard.ts` fronts `pnpm db:push` and refuses twice: when the target host is not this machine, and when the target already has migrations applied. It reads that state from the database instead of trusting an `ALLOW_*` variable, because a variable that permits the dangerous thing is one `export` away from being permanently set — and there are no journal rows to back up when the only pushable database is one that has none.
- **A CLI script that connects without TLS is a script that only works locally.** _Found 29 July 2026, applying the chain to RDS for the first time._ Three of the four entry points that share `src/server/db/ssl.ts` never passed `sslFor()` to their own postgres client, so the first remote migrate and seed both failed. `rds.force_ssl` makes this fail late and confusingly: the cleartext handshake completes and the server rejects the _first statement_ with `no pg_hba.conf entry … no encryption`, which reads like a firewall or a role problem rather than a missing option. Two were real bugs (`seed.ts`, `scripts/schema-drift.ts`, both documented as production-facing) and two were correct — `db-push-guard.ts` and `seed-demo-content.ts` refuse a non-local host _before_ connecting, so cleartext is right there and the comment says so. The lesson is to check the guard order before "fixing" the ssl option.
- **drizzle-kit silently discards `dbCredentials.ssl` when `url` is set.** In 0.31.10 the client is built as `postgres(credentials.url, { max: 1 })` when a `url` key exists and `postgres({ ...credentials, max: 1 })` otherwise, so every other key — `ssl` included — is dropped by the URL form. The failure is then swallowed by its progress spinner and surfaces as a bare exit 1 with no message. `drizzle.config.ts` therefore passes `host`/`port`/`user`/`password`/`database` as separate fields; the config comment says why, because collapsing it back to a one-line `url` is exactly the tidy-up someone would make. Related: its validator accepts `ssl` only as a string or an object, so `false` fails the schema — the local case has to omit the key rather than set it, which is why the config spreads `...(ssl ? { ssl } : {})`.
- **`ENV_FILE=` only redirects the scripts that map it.** `dotenv/config` reads `DOTENV_CONFIG_PATH`, and only the `:remote` scripts set it. `ENV_FILE=.env.prod.local pnpm db:seed` therefore loaded plain `.env` and would have seeded **local Docker while reporting success** — a silent wrong-target, which is worse than an error. Fixed by adding `db:seed:remote` and `db:drift:remote` alongside the existing `db:migrate:remote`, at both the workspace and repo root, so the three production commands are spelled consistently and the un-suffixed ones cannot be aimed remotely by accident.
- `drizzle/seed/` folder for seed data — InfoKit's taxonomy catalogs (categories, specialities, audiences, cities, languages) are seeds. Slice 0 may also seed a curated, idempotent set of real organisation identity/profile drafts from official public sources when every record is unpublished, source-dated, and paired with pending verification; it must not seed public service claims. A platform editor may later create an unpublished provisional activity linked to one of those known organisation rows through the audited authoring/import workflow, but that is application data with creator/provider acceptance state—not catalogue seed data.

## 5. Testing and quality gates — adopt

- Split runners (EP-next `scripts/run-{unit,integration,api,e2e}-tests.mjs`; Playwright for e2e; Vitest workspaces).
- **Coverage gate** (kawa): `test:coverage:gate` with a strict env flag and a summary script with `--enforce` — coverage is a CI gate, not a report. For InfoKit, the strict set starts with the boundaries: tenant isolation, publish gates, never-public invariants (`SUSTAINABILITY.md` AI practices).
- `dependency-cruiser` with a config enforcing package boundaries (EP-next `deps:check`) — mechanical enforcement of "domain never imports app code, api-client never imports server code". This is the tool that makes the monorepo layout _stay_ the layout.
- Env validation exists in EP-next (`SKIP_ENV_VALIDATION` flag implies a validated env schema) — adopt validated env (t3-env style); avoid normalizing the skip flag.

## 6. AGENTS.md — adopt, merged and improved

Both repos keep standing AI instructions at the repo root; kawa's points to a **mandatory** `docs/UI_DESIGN_REFERENCE.md`, EP-next's is a full design contract ("build in the spirit of Linear/Stripe; when a choice feels like a generic AI UI move, pick the harder, cleaner option"; component defaults; accent policy; token paths).

InfoKit's AGENTS.md (written at repo bootstrap) should contain:

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

> **Status 25 July 2026:** the monorepo includes `packages/{tokens,shared,ui,validation}` and `apps/{web,mobile}`. Tamagui was removed: the web app renders with Tailwind v4 (public primitives + shadcn workspace adapters), and `packages/ui` is now React Native Reusables + NativeWind for the Expo app. `apps/mobile` is scaffolded as a reading surface — public content plus the admin visualisation of calendars, inter-organisation coordination, and events; authoring stays on the web. `packages/api-client` now exists because a real consumer arrived: it reads the anonymous `/api/public/*` endpoints for `apps/mobile` (26 July 2026). Still pending: shared config packages, created only when real consumers exist — never as empty shells.

1. `git init`, initial commit of this suite + prototype.
2. Scaffold the monorepo (§1) with `packages/tokens` from `DESIGN.md` + prototype CSS variables, and the i18n registry (fr, en, ar) with the fail-on-missing generator (§3).
3. `drizzle/` with `0000_baseline` for the Slice 0 subset (~25–30 tables), immutability/audit triggers as custom SQL (§4), taxonomy seeds.
4. `AGENTS.md` (§6), `check:ci`, dependency-cruiser config, coverage gate skeleton (§5).
5. Web + mobile apps consuming `shared`/`tokens`/`ui`/`api-client`; EAS profiles (§8).
