# Calais Info — Operations and Sustainability

> `PRODUCT.md` is the canonical product requirements document. This document answers the questions the PRD defers: who operates the platform, what it costs, who is legally responsible at each stage, and what happens if the operator stops.

**Status:** Living document — last reviewed 17 July 2026

## 1. Operating model: one person plus AI

The delivery capacity is one operator using AI tools heavily. That multiplies generation (code, documents, translation drafts, consistency checks) but multiplies **nothing else**. The binding constraints are review time, field relationships, and legal accountability — all human.

| Responsibility | Human | AI tools |
| --- | --- | --- |
| Field relationships, org verification, trust | ✔ | — |
| Judgment on what is safe to publish | ✔ | — |
| Review of security-boundary code (auth, tenant isolation, publish gates) | ✔ line by line | drafts and tests |
| Application code, migrations, UI | review | ✔ generate |
| Documentation consistency | spot-check | ✔ maintain |
| Translation | recruit/verify reviewers | ✔ draft |
| Content entry and freshness checks | ✔ (Phase 1) | drafting assistance |
| Legal and financial accountability | ✔ | — |

### Weekly time budget

Sustainable target: **≤ 12 hours/week**. Exceeding it for more than three consecutive weeks is an R3 signal (`RISKS.md`).

| Activity | Target h/week |
| --- | --- |
| Development and review | 6 |
| Content entry, verification, freshness | 3 |
| Organisation relationships and distribution | 2 |
| Administration, costs, backups | 1 |

**Rule: scope to review capacity, not generation capacity.** A feature whose security review or ongoing operation does not fit this budget is deferred, no matter how quickly AI can generate it. Every committed feature names its operator.

**Rule: content beats code.** An hour spent on verified records usually beats an hour spent on features — the product's value is its data.

### AI delivery practices

- Repository under git with a commit per decision, and a short decision log.
- Each AI work session loads only the documents relevant to its slice (context packs); scoped generation drifts less.
- After any documentation edit, run an AI cross-document contradiction pass; before any release, an adversarial AI review of the diff, judged by the human.
- Test-first at the boundaries: tenant isolation, publish gates, and never-public invariants get failing tests before features; an isolation failure blocks deploy.
- `DATABASE-SCHEMA.md` is the target map, implemented as additive per-slice subsets; never build a table no slice reads.

## 2. Responsibility ladder

| Stage | Backing | Permitted scope | Personal-data exposure |
| --- | --- | --- | --- |
| **A — Personal project** (now) | Operator alone | Phase 0–1: public information; invited editor accounts only | Minimal: a handful of editor accounts |
| **B — Association-backed** | An existing association hosts the project (éditeur du site, funding channel) | Phase 2: org onboarding and publishing at pilot scale | Org representatives' professional contact data |
| **C — Dedicated structure or consortium** + steering group (see `PRODUCT.md` §21) | Legal entity is the responsible party; DPO/specialist advice obtained | Phase 3+: member PII, restricted participation documents | Volunteers' personal data, signed documents |

Hard gate (also R6 in `RISKS.md`): **Phase 3 does not start at Stage A or B.**

French practical notes for Stage A: a public website must publish *mentions légales* identifying its editor — at Stage A that is the operator personally, which is both a transparency asset (R8) and a personal-exposure consideration; moving to Stage B puts an association's name there instead. GDPR applies from the first editor account: keep a processing register from day 0 (it will be short — that is the point of the PRD's data minimisation).

## 3. Cost model

Design target: **≤ €60/month through Phase 1** (excluding operator time), roughly €75/month once app-store fees are included.

| Item | Example (EU) | €/month est. |
| --- | --- | --- |
| Domain | — | ~1.5 |
| Managed PostgreSQL | Scaleway / Clever Cloud / OVH | 15–25 |
| App hosting (SSR web + API) | same providers / Fly EU region | 5–20 |
| Object storage + delivery | Scaleway / OVH | 1–5 |
| Transactional email | low-volume tier | 0–10 |
| Maps | MapLibre + self-hosted or free OSM tiles — avoid per-load billing | 0 |
| Geocoding (French addresses) | **BAN — adresse.data.gouv.fr, free national API** | 0 |
| Analytics (cookieless, aggregate) | self-hosted Plausible/Matomo | 0–9 |
| AI translation API (Phase 1 volume) | approved provider (`NFR-020`) | 5–20 |
| Apple Developer Program | required for iOS | ~8 (99/yr) |
| Google Play | one-time $25 | ~0 |
| E-signature provider | **Phase 3 only** — per-envelope | deferred |

Review actual vs target monthly; exceeding €100/month is an R4 signal.

## 4. Funding options, in order of fit

1. **Self-funded baseline.** The architecture must survive on a hobby budget indefinitely — that is a design requirement, not a fallback.
2. **French public funds for associative projects** (requires Stage B): FDVA 1/2; Département du Pas-de-Calais social funds. **Ville de Calais is deliberately not pursued**: the municipality's posture toward migrant-aid activity makes it both unlikely and a trust liability (R8).
3. **Foundations:** Fondation de France, Fondation Abbé Pierre, corporate foundations with digital-inclusion programmes.
4. **Tech-for-good / in-kind:** Latitudes, Data For Good France, nonprofit infrastructure credits (cloud providers, GitHub).
5. **EU funds (AMIF)** only ever as a partner in a consortium — too heavy to carry solo.

**Funding rule:** refuse any funding conditioned on collecting beneficiary data, on tracking usage at the individual level, or on editorial control by a public authority. Each accepted funder is named on the public transparency page (R8).

## 5. Continuity and exit

- **Backups:** automated encrypted database backups off-provider; restore procedure tested quarterly (NFR-008 made concrete).
- **Dead-man banner:** if no editorial activity for 14 days, the public site automatically displays a "not currently updated" warning. The site degrades honestly, never silently. (Product backlog item; cheap — the freshness machinery already carries the dates.)
- **Quarterly static export:** HTML/PDF snapshot per language, archived; doubles as printable material for orgs (`DISTRIBUTION.md`).
- **Handover pack:** this documentation suite + a one-page runbook (deploy, backup/restore, DNS, providers) + credential escrow with one trusted person at the Stage B association.
- **Orderly shutdown, if it comes to that:** publish a final static snapshot with a permanent "no longer updated" banner; offer the structured data (CSV) to the pilot organisations, Solinum/Soliguide, and Watizat; keep the domain with the notice for 24 months.

## 6. Sustainability measures

| Measure | Target |
| --- | --- |
| Running cost | ≤ €60/month (Phase 1) |
| Operator time | ≤ 12 h/week sustained |
| Editorial cost | editor-minutes per record per month, tracked from Slice 1 |
| Honest capacity | published number of records maintainable at current budget |
| Continuity | restore test passes quarterly; dead-man banner tested |
| Correction SLA | < 24 h; < 1 h for safety-critical records |
| Verification cadence | monthly confirmation loop completed with each committed organisation |
