# Calais Info — Open Design Runbook

> `PRODUCT.md` is the canonical product requirements document. This runbook may elaborate design execution but cannot expand or override product scope.

This file is the starting point for generating the Calais Info design with [nexu-io/open-design](https://github.com/nexu-io/open-design).

Open Design's current workflow is `brief → direction → design system → artifact → handoff`. It ships with an Airtable design-system package, and its prototypes are real single-page HTML/CSS artifacts. This project provides the inputs needed to begin that loop:

- `PRODUCT.md` — product scope and requirements.
- `DESIGN-BRIEF.md` — audiences, journeys, screen inventory, states, and acceptance criteria.
- `DESIGN.md` — the nine-section visual contract adapting Airtable to Calais Info.
- `PHASE-1-PUBLIC-INFORMATION.md` — the current design scope.
- `PHASE-2-ASSOCIATION-ONBOARDING.md` — the later association-workspace scope.
- `PHASE-3-TEAM-MANAGEMENT.md` — the later team-management scope.

## 1. Set Up Open Design

Use the desktop app or install its MCP server into the coding agent you use. Follow the upstream [quick start](https://github.com/nexu-io/open-design#quick-start) because installation details may change.

On macOS, `/usr/bin/od` is already Apple's octal-dump utility. If the bare `od` command resolves there, use **Open Design → Settings → MCP server** and copy the Codex-specific configuration instead of replacing the system command.

In Open Design:

1. Create or open a project for **Calais Info**.
2. Choose **Prototype** as the artifact type.
3. Choose the bundled **airtable** design system.
4. Add this repository as project context. For the first design pass, attach the four core files plus `PHASE-1-PUBLIC-INFORMATION.md`.
5. Generate one P0 artifact at a time. Start with P-01, not the entire product.

The built-in Airtable package contains `DESIGN.md`, `tokens.css`, component fixtures, and a component manifest. Use those package tokens/components first. The local `DESIGN.md` adds product-specific accessibility, status, multilingual, and safety rules.

## 2. Context Prompt

Paste this once at the start of the design project:

```text
You are designing Calais Info, a multilingual public-information and association-coordination web app for Calais.

Read PRODUCT.md, DESIGN-BRIEF.md, DESIGN.md, and PHASE-1-PUBLIC-INFORMATION.md before generating anything. Treat PRODUCT.md as product scope, PHASE-1-PUBLIC-INFORMATION.md as the current release contract, DESIGN-BRIEF.md as the UX contract, and DESIGN.md as the visual and accessibility contract.

The product has four sequential phases: (1) public information, (2) full association onboarding and publishing, (3) team management with restricted participation-document signing, and (4) inventory management. Design Phase 1 only unless explicitly asked for a later phase. Phase 1 includes searchable map/service discovery, audience labels, provider logos/names, articles with accessible media and AI-translation provenance, the anonymous information simulator, fixed/basic information, and the association directory. It also includes invitation-only article publishing and approval-filtered joint-publication projections. There is no public organisation signup.

Use Open Design's bundled airtable design system as the base. Reuse its tokens and component patterns, then apply the Calais-specific overrides in DESIGN.md. Do not copy Airtable branding or proprietary assets.

The public experience is mobile-first, calm, low-bandwidth, anonymous, and less dense than Airtable. The Phase 1 publishing console is restricted to article publishing and proxy-publishing attribution. Never place full organisation administration, team management, assistance, or beneficiary-record features in a Phase 1 artifact.

Use fictional content labeled “Demo data — do not publish.” Do not invent real services, contacts, programme rules, or policy decisions. If a required policy is unresolved, mark it as an open question in the artifact.

Every artifact must include relevant loading, empty, error, offline, outdated, uncertain, and missing-translation states. Meet WCAG 2.2 AA, support a 320px viewport, and use logical layout properties suitable for Arabic RTL.
```

## 3. Generation Sequence

Generate in this order so later artifacts reuse validated patterns:

1. Shared public shell and P-01 service finder.
2. P-02 service detail and status/freshness variants.
3. P-03 basic-information home.
4. P-04 information simulator, then its Arabic RTL variant.
5. P-05 article index/detail.
6. P-06 association directory/profile with speciality icons and labels.
7. P-07 fixed-information index/detail.
8. E-01 invitation acceptance and E-02 minimal article editor.
9. Component and state sheet.

After each artifact, critique it against the checklist in section 6 before continuing.

## 4. Paste-ready Artifact Prompts

### Prompt A — P-01 public service finder

```text
Create artifact P-01, the Calais Info public service finder.

Build an interactive responsive prototype with a polished 390px mobile state and a 1440px desktop state. Use the bundled airtable design system and the local DESIGN.md overrides.

The mobile experience starts as a text list, not a map. Include a visible language selector, brief page purpose, urgent essentials shortcut, service-category filters, Open now filter, list/map switch, and fictional service cards. Order every card as status, service-offering name, audience label, next time, place/distance, a compact preview of icon-labelled included features, provider logo(s) with text name, last verified, then one primary action.

On desktop, use a 5/7 list-and-map split. The map may be a lightweight visual placeholder, but the list must remain complete and usable. Use the demo fixture from DESIGN-BRIEF.md and display “Demo data — do not publish.”

Include interactive examples for open, closed, cancelled, and uncertain services plus no location permission, no matches, offline cached content, and missing translation. Do not use real services or contacts.

Finish with a short artifact note listing any unresolved decisions. Output real HTML/CSS/JS suitable for handoff.
```

### Prompt B — P-02 service detail

```text
Create artifact P-02, a mobile-first public service detail for the selected demo food distribution.

At 390px, put status, name, next occurrence, directions, and freshness above the fold. Include schedule and exceptions, a complete one-column list of verified included features with icons and visible labels, responsible demo organisation, languages, safe contact area, related information, share, and print. Use one dominant primary action.

Make an in-artifact state switcher for Open, Closed, Cancelled, Information uncertain, and Outdated. The cancelled and uncertain variants must remain unmistakable without color. Show the exact dated freshness-warning pattern from DESIGN.md.

Include a list-friendly low-bandwidth treatment and a print state. Label all content as demo data. Follow WCAG 2.2 AA and ensure 320px compatibility.
```

### Prompt C — P-04 anonymous information simulator

```text
Create artifact P-04, the anonymous information simulator at 390px.

Include an intro with purpose, content owner/source/review metadata, and a plain privacy note that answers remain in the browser session and are not attached to identity. Show one question at a time with progress text, Yes, No, Prefer not to say, Skip this question, Back, and Start again.

Use the neutral example question from DESIGN-BRIEF.md ("Which information would you like to see first?") as fictional flow content. Do not include nationality, passport, health, administrative-status, or travel questions in any prototype; PRODUCT.md section 10.4 requires explicit purpose and privacy approval before such questions appear anywhere. Results assemble personalized reviewed information, relevant associations, and referrals, never an eligibility decision or legal advice. Include intro, question, skipped, personalized result, outdated-content, and restart states.

Create both French/English-style LTR and Arabic RTL layouts. Use logical properties and do not add positive letter spacing to Arabic. Essential information must remain reachable without answering.
```

### Prompt D — P-06 association directory and profile

```text
Create artifact P-06, the public association directory and association profile.

At 390px and 1440px, let visitors filter fictional associations by verified speciality, supported language, and service location. Association cards show name, purpose, one primary speciality, up to four secondary specialities, visible icon-and-text labels, supported languages/location, and last verification.

Use one consistent outline icon system. Demonstrate Medical care with Stethoscope, Medication with Pill, and Doctors with UserRoundPlus. Icons describe services and never replace text. Include an association profile with separate offering cards grouped by activity and place. Each offering owns its status, audience, schedule, description, contact, freshness metadata, and icon-labelled included features. Show one day-centre offering with several amenities and one nurse-led offering with health-only features. Never merge their feature lists.

Use only fictional association names and display “Demo data — do not publish.” Include no matches, outdated/unverified information, missing logo, missing translation, and Arabic RTL states.
```

### Prompt E — P-03 and P-07 basic/fixed information

```text
Create two related Phase 1 public artifacts: P-03 Basic information and P-07 Fixed information.

P-03 is the fastest route to emergency help, food/water, healthcare, shelter/day services, clothing/showers, charging, legal help, safety, and orientation. Use large icon-and-text tiles and direct links to matching map results. Essential information must not require the simulator, geolocation, or an account.

P-07 is a topic index and reading view for relatively stable reference information such as orientation, general rights, procedures, transport, and safety. Every page shows owner, source, last-reviewed date, review interval, and related services/articles.

Create 390px states for current, outdated, missing translation, offline, no verified topic content, Arabic RTL, print, and low-bandwidth mode. Use fictional content only.
```

### Prompt F — P-05 articles

```text
Create artifact P-05, the Phase 1 public article index and article detail.

Include search/filter, article cards, a focused reading layout, publisher, owner, source, last-updated date, review/freshness state, related services/associations/fixed information, print, and download when applicable.

Show current, dated freshness warning, outdated, missing-translation fallback, offline, low-bandwidth, and print states. Keep reading lines comfortable and label fixtures as demo data.
```

### Prompt G — E-01 invitation and E-02 article publishing

```text
Create two related Phase 1 publishing artifacts: E-01 Association publisher invitation/sign-in and E-02 Minimal article editor.

E-01 begins with a platform-issued, expiring invitation tied to one verified fictional association. Show the association identity, invited representative, narrow Author/Publisher permissions, publishing responsibilities, accept, expired, revoked, and already-accepted states. There is no public organisation signup or request-account action.

E-02 lets an invited association publisher create, translate, preview, and publish only articles owned by their association. Also demonstrate a platform editor proxy-publishing the same article type on behalf of an association. In proxy mode, show factual owner, submitting/approving representative, approval date, sources, platform publishing actor, translations, freshness/review dates, and revision history.

Keep this intentionally smaller than the Phase 2 workspace: no organisation settings, profile claiming, member administration, teams, schedules, missions, or access to another organisation. Include permission denied, unsaved draft, validation error, missing approval, expired content, publish confirmation, revoked access, and audit-history states. Use demo data only.
```

### Prompt H — component and state sheet

```text
Create a compact Calais Info component and state sheet based on the approved artifacts.

Include buttons, inputs, segmented controls, chips, banners, service cards, freshness warnings, language selector, information-simulator step, association card, speciality icons with text labels, basic-information tile, article card, fixed-information link, contact card, download row, invitation state, ownership/approval panel, publishing bar, and audit event.

For relevant components show default, hover, focus, active, disabled, loading, empty, error, offline, read-only, and RTL states. Document token names, spacing, radius, typography, interaction timing, accessibility annotations, and content rules. Use no raw hex values outside the token block.
```

## 5. Refinement Prompt

Use this after the first version of each artifact:

```text
Critique this artifact against DESIGN.md and DESIGN-BRIEF.md before editing it.

Check hierarchy under stress, mobile reachability, low-bandwidth fallback, status and freshness clarity, text expansion, Arabic RTL, keyboard focus, contrast, one-primary-action discipline, fictional-data labeling, privacy boundaries, and all required states.

List the five highest-impact issues, then revise the artifact to fix them. Do not broaden scope or invent policy. Preserve approved component patterns from earlier Calais Info artifacts.
```

## 6. Approval Checklist

Approve an artifact only when:

- Its screen ID and primary user goal are clear.
- It uses the Airtable base tokens and local Calais overrides consistently.
- Public pages feel calm and readable, not like a spreadsheet.
- The main task works at 320px and keyboard-only.
- Important status uses text, icon, and color.
- Association specialities use verified, controlled icon-and-text labels rather than icons alone.
- Freshness and translation states are visible.
- Offline/list fallback exists where a map or network feature appears.
- Arabic RTL and 50% text expansion do not break the layout.
- All content is fictional and marked as demo data.
- No sign-in is required for public information.
- No Phase 2 workspace or Phase 3 team feature has leaked into a Phase 1 artifact.
- No sensitive or assistance-record data appears.
- Open policy questions are recorded rather than guessed.
- The output is exportable real HTML/CSS with reusable tokens/components.

## 7. Handoff Notes

For each approved artifact, export or retain:

- The HTML/CSS/JS source.
- A 390px screenshot for public/mobile artifacts.
- A 1440px screenshot for desktop artifacts.
- The states demonstrated and states still missing.
- Accessibility and RTL notes.
- Unresolved product decisions.
- Any new component or token added beyond the base Airtable package.

Engineering should treat the HTML as design intent, not automatically production-ready application code. Product logic, permissions, localization infrastructure, map behavior, analytics, security, and data retention still require implementation review.

## References

- [Open Design repository](https://github.com/nexu-io/open-design)
- [Open Design design-system guide](https://github.com/nexu-io/open-design/blob/main/design-systems/README.md)
- [Bundled Airtable `DESIGN.md`](https://github.com/nexu-io/open-design/blob/main/design-systems/airtable/DESIGN.md)
- [Bundled Airtable package usage](https://github.com/nexu-io/open-design/blob/main/design-systems/airtable/USAGE.md)
