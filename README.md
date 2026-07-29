# InfoKit

A multilingual public-information platform for people seeking practical help, and a coordination tool for the associations serving them. City-agnostic by design — **Calais is the first city to launch**, not the product's identity.

Domain: [infokit.org](https://infokit.org)

## Workspace

| Path                  | Package               | What it is                                              |
| --------------------- | --------------------- | ------------------------------------------------------- |
| `apps/web`            | `@infokit/web`        | Next.js App Router — public pages + editor console      |
| `apps/mobile`         | `@infokit/mobile`     | Expo app — reads public content, shows admin calendars  |
| `packages/api-client` | `@infokit/api-client` | Typed reader of the public `/api/public/*` endpoints    |
| `packages/shared`     | `@infokit/shared`     | i18n catalogs, locales, public read models              |
| `packages/tokens`     | `@infokit/tokens`     | Semantic design tokens (single source for web + native) |
| `packages/ui`         | `@infokit/ui`         | React Native Reusables + NativeWind components          |
| `packages/validation` | `@infokit/validation` | Shared schemas                                          |

## Getting started

```bash
pnpm install
cp apps/web/.env.example apps/web/.env
apps/web/start-database.sh   # postgres:18 in Docker on port 5433, named volume
pnpm db:migrate              # applies apps/web/drizzle/ — creates the schema and the app role
```

One manual step, once per machine: `0002_roles.sql` creates the `infokit_app`
role without a password, because a password in a migration file is a password in
git. Give it the one your `.env` already names:

```bash
docker exec infokit-postgres psql -U postgres -d infokit -c "ALTER ROLE infokit_app PASSWORD 'localdev'"
```

```bash
pnpm db:seed                 # the bootstrap superadmin from .env
pnpm dev                     # web (API + site) and the mobile QR code together
```

Local uses **two** connection identities on purpose, both in `.env`:
`DATABASE_URL` is the application (`infokit_app`, owns nothing) and
`DATABASE_URL_MIGRATOR` is the owner (`postgres`). A table's owner bypasses
row-level security, so an app connecting as the owner locally would make every
policy a no-op on the machine where policies get written.

`pnpm db:push` still exists but is guarded: it refuses any target that is not
this machine and any database that already has migrations applied. Use
`db:generate` + `db:migrate`; push is for a throwaway scratch database.

## Commands

- `pnpm dev` — everything at once: the Next.js app on port 3030 (API and site) in the background, and the Expo dev server in the foreground, where it prints the QR code that opens the app in Expo Go and keeps its own keyboard shortcuts (`i`, `a`, `r`). It is deliberately not `turbo run dev`: sharing the terminal with other tasks, Expo drops both. Scanning needs the phone on the same network as this machine; the app finds this machine's address through the dev server it loaded from, because `localhost` on a phone is the phone. Use `pnpm dev:mobile:tunnel` for the mobile half when the two are on different networks.
- `pnpm dev:web` — the Next.js app on its own
- `pnpm dev:mobile` — the Expo dev server on its own; it reads the web app's public endpoints (`EXPO_PUBLIC_INFOKIT_API_URL`, see `apps/mobile/.env.example`), so `dev:web` has to be running too. It takes the first free port from 8081 up, so a second one never stops to ask, and prints the QR code itself when its output is piped somewhere Expo will not draw one.
- `pnpm ios` / `pnpm android` — the same dev server, opened straight onto a simulator or emulator
- `pnpm check:ci` — format check + lint + typecheck; the health question
- `pnpm db:generate --name <slug>` → `pnpm db:migrate` → `pnpm db:drift` — the schema loop: write a migration, apply it, confirm the database agrees. Never edit an applied migration; a correction is a new one
- `pnpm db:seed` — the bootstrap superadmin. `pnpm db:studio`, `pnpm db:names` (identifier budget), `pnpm db:push` (guarded, scratch databases only)
- `ENV_FILE=.env.prod.local pnpm db:migrate:remote` — apply the chain to a remote database over verified TLS. Refuses to run without an explicit env file
- `pnpm test:unit` — web unit tests

## Docs

`AGENTS.md` holds the standing rules for every session in this repo. `docs/PRODUCT.md` is the canonical product requirements document; `docs/ENGINEERING-NOTES.md` is the engineering blueprint; `docs/DESIGN.md` and `docs/DESIGN-BRIEF.md` are the design contract; `docs/UI-ARCHITECTURE.md` explains which UI layer owns which surface.
