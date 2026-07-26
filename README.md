# InfoKit

A multilingual public-information platform for people seeking practical help, and a coordination tool for the associations serving them. City-agnostic by design — **Calais is the first city to launch**, not the product's identity.

Domain: [infokit.org](https://infokit.org)

## Workspace

| Path                  | Package               | What it is                                              |
| --------------------- | --------------------- | ------------------------------------------------------- |
| `apps/web`            | `@infokit/web`        | Next.js App Router — public pages + editor console      |
| `apps/mobile`         | `@infokit/mobile`     | Expo app — reads public content, shows admin calendars  |
| `packages/shared`     | `@infokit/shared`     | i18n catalogs, locales, public read models              |
| `packages/tokens`     | `@infokit/tokens`     | Semantic design tokens (single source for web + native) |
| `packages/ui`         | `@infokit/ui`         | React Native Reusables + NativeWind components          |
| `packages/validation` | `@infokit/validation` | Shared schemas                                          |

## Getting started

```bash
pnpm install
cp apps/web/.env.example apps/web/.env
apps/web/start-database.sh   # local Postgres on port 5433
pnpm db:push                 # push-mode while tables are empty
pnpm dev:web
```

## Commands

- `pnpm dev:web` — Next.js dev server
- `pnpm check:ci` — format check + lint + typecheck; the health question
- `pnpm db:push` / `pnpm db:generate --name <slug>` / `pnpm db:studio`
- `pnpm test:unit` — web unit tests

## Docs

`AGENTS.md` holds the standing rules for every session in this repo. `docs/PRODUCT.md` is the canonical product requirements document; `docs/ENGINEERING-NOTES.md` is the engineering blueprint; `docs/DESIGN.md` and `docs/DESIGN-BRIEF.md` are the design contract; `docs/UI-ARCHITECTURE.md` explains which UI layer owns which surface.
