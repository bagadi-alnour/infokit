# InfoKit — Risk Register

> `PRODUCT.md` is the canonical product requirements document. This register records the risks that specification cannot fix and the responses the project commits to. It is reviewed at every slice/phase gate and whenever an early-warning signal fires.

**Status:** Living register — last reviewed 17 July 2026
**Owner:** Platform operator (single person until a backing entity exists; see `SUSTAINABILITY.md`)

## Conventions

- **Likelihood/Impact:** High / Medium / Low, judged for the current phase, re-judged at each gate.
- Every risk has a **mitigation** (what we do now), a **signal** (how we notice it firing), and a **response** (what we do if it fires).
- A risk is never closed by writing more documentation. It is closed by evidence.

## Register

| ID  | Risk                                                                                  | L    | I    | Mitigation in one line                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------- | ---- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Associations will not maintain their data — the freshness premise fails               | High | High | Verification loop ≤5 min/org/month; platform-editor fallback; explicit pivot criterion                                                                     |
| R2  | Nobody in Calais learns the product exists                                            | High | High | Aid-workers-first distribution (`DISTRIBUTION.md`); no public promotion before verified content                                                            |
| R3  | Solo-operator continuity: burnout, absence, abandonment                               | Med  | High | Time budget cap, dead-man banner, static-export fallback, handover pack (`SUSTAINABILITY.md`)                                                              |
| R4  | Running costs exceed a personal budget                                                | Low  | Med  | ≤€60/month architecture target; free-tier geocoding (BAN); cost reviewed monthly                                                                           |
| R5  | Hostile use of public data (police sweeps, far-right targeting of distributions)      | Med  | High | Per-place "should this be public?" with precision levels; org-controlled publication; no crowd data                                                        |
| R6  | Legal/data-protection exposure lands on one individual                                | Med  | High | Hard gate: no Phase 3 (member PII, signed documents) without a backing legal entity and specialist advice                                                  |
| R7  | Wrong or stale information causes real-world harm                                     | Med  | High | Freshness warnings, uncertainty states, correction SLA, no eligibility/legal advice                                                                        |
| R8  | Trust failure: perceived as a state/surveillance tool                                 | Med  | High | No accounts, no tracking, association-owned attribution, published independence statement                                                                  |
| R9  | Ecosystem duplication and partner friction (Soliguide, Watizat, Channel Info Project) | Med  | Med  | Partner-first doctrine (`LANDSCAPE.md`); interoperate before duplicating                                                                                   |
| R10 | Publishing-integrity attack: a compromised editor account publishes false information | Low  | High | Strong auth/2FA for all editors, audit + revision rollback, out-of-band check for critical changes                                                         |
| R11 | Platform dependencies: app-store latency, stale native binaries, map/geocoder outages | Med  | Med  | Web stays always-current while Expo OTA updates keep mobile builds fresh; direct install bridges store delays; list-first fallback already required by PRD |
| R12 | AI-assisted drift: generated docs/code quietly contradict each other                  | High | Med  | Git from day 0, cross-doc consistency pass after every edit, review-budget rules                                                                           |
| R13 | A pilot organisation drops out and the pilot loses its evidence base                  | Med  | Med  | Recruit 3–5 orgs for the verification loop so two survivors remain                                                                                         |

## Detail

### R1 — Associations will not maintain their data

The product's entire premise is that information stays current because its owners maintain it. That labor is why this gap exists (see `LANDSCAPE.md`: Watizat runs monthly guides in four other territories but not Calais).
**Signals:** two consecutive monthly verification requests ignored by the same org; platform-editor hours climbing while org contributions stay at zero.
**Mitigations:** make verification nearly free for orgs (a monthly WhatsApp/email "still correct? yes/no" loop, not a login requirement); platform editor maintains records as the default in Phase 1 so orgs experience value before being asked for effort.
**Response if fired:** pivot per `LANDSCAPE.md` §4 — become a contributor to an existing platform, or run in honest platform-editor-only mode with a smaller record count and visible staleness.

### R2 — Nobody learns it exists

Building it creates zero awareness. Distribution is a plan with owners and dates, not a hope — see `DISTRIBUTION.md`.
**Signals:** eight weeks after soft launch, under ~100 sessions/week or near-zero non-French sessions.
**Response if fired:** stop feature work entirely; spend the budget on intermediary partnerships and materials until the numbers move.

### R3 — Solo-operator continuity

One person is the bus factor for a service people may rely on.
**Mitigations:** weekly time budget with a hard cap (`SUSTAINABILITY.md`); automatic **dead-man banner** — if no editorial activity for 14 days, the public site displays "This information is not currently being updated — verify by phone before relying on it"; quarterly static export per language as an archival fallback; documented handover pack and credential escrow.
**Response if fired:** the banner fires automatically (that is the point — the site degrades honestly, never silently).

### R5 — Hostile use of public data

In Calais, precise distribution times and places can attract police pressure and hostile attention. Confidentiality of personal data is already strong in the PRD; **integrity and precision of public data is the residual risk**.
**Mitigations (decided 16–17 July 2026):** every place records **"should this be public?" with a precision level** — exact point / area only / contact to learn; the same consideration applies to exact schedule times; the choice belongs to the providing organisation; a standing Phase 0 interview question: "what must never be published, and at what precision?"; no attendance/crowd-size data anywhere; rapid unpublish path. Inter-organisation coordination events (the shared agenda, including meeting locations) are authenticated-only and never public.
**Signals:** an org reports enforcement activity correlated with a listing; a takedown request.
**Response if fired:** unpublish within the correction SLA, contact the org, record the incident, review precision defaults for that category.

### R6 — Legal exposure lands on one person

Phases 1–2 (public info, org publishing) keep personal-data exposure minimal: editor accounts only. Phase 3 makes the platform hold volunteers' PII, restricted accommodation data, and legally signed documents.
**Hard gate:** Phase 3 does not begin until a legal entity (association or equivalent — Stage C in `SUSTAINABILITY.md`) is the platform's responsible party and a data-protection specialist has reviewed the design. This gate is written into `PRODUCT.md` Section 8.1 and cannot be waived by schedule pressure.

### R7 — Information harm

A wrong "open" status costs someone a meal or a legal deadline.
**Mitigations:** the PRD's freshness machinery is the mitigation — visible last-verified dates, uncertainty states, unreliable-from warnings, sources, no eligibility or legal advice.
**Commitments:** correction SLA under 24 hours, under 1 hour for safety-critical records; every record shows its verification date so readers can judge for themselves.

### R8 — Trust failure

The audience includes undocumented people with well-founded reasons to distrust official tools. One incident — or one plausible rumor — ends adoption.
**Mitigations:** no accounts or identity for public use (already PRD law); cookieless aggregate analytics only; a public page stating who runs the platform, who funds it, and its independence; association names on every record; poster/branding language that never singles out migrants (see `DISTRIBUTION.md`); weigh any state or municipal funding against this risk before accepting it (`SUSTAINABILITY.md` §5).

### R10 — Publishing-integrity attack

In Phase 1 the data is public, so the attack that matters is not theft — it is **false publication** (imagine a fake "distribution cancelled" the morning of a distribution).
**Mitigations:** an SMS second factor, mandatory and not disableable for every role that reaches other people's accounts or content — enrolled on first connect, before any private read; publication audit + immutable revisions enable one-click rollback; out-of-band confirmation (phone/WhatsApp) before publishing third-party-reported cancellations of safety-critical services.

### R12 — AI-assisted drift

Evidence, not theory: three cross-document contradictions were found in this suite on 17 July 2026 (a prompt instructing designers to use a passport question the PRD gates behind privacy review; a card spec missing two P0 elements; an incomplete artifact registry). Two are fixed as of today; the class of defect remains.
**Mitigations:** repository under git with per-decision commits; after any doc edit, an AI cross-document contradiction pass; before any release, an adversarial review pass on the diff; security-boundary code is always human-reviewed line by line.

## Review triggers

- Every slice gate (`PRODUCT.md` §8.1).
- Any signal above firing.
- Any incident involving R5, R7, R8, or R10 — recorded here with date, response, and what changed.
