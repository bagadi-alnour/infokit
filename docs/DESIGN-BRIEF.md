# InfoKit — Product Design Brief

> `PRODUCT.md` is the canonical product requirements document. This brief elaborates design behavior and cannot expand or override product scope.

**Status:** Ready for initial design exploration  
**Design system:** Open Design bundled `airtable`, adapted by `DESIGN.md`  
**Initial release:** Phase 1 public information only  
**Primary surfaces:** Responsive web application built with React; Android and iOS applications built with React Native and Expo  
**Reference documents:** `PRODUCT.md`, `DESIGN.md`, and the four `PHASE-*.md` files

## 1. Design Challenge

People in Calais need to find essential services in unfamiliar conditions, languages, and places. Information changes quickly and is currently fragmented across messages, spreadsheets, websites, and paper. Text-only experiences also exclude people who cannot read confidently or who will not read a long page to find one urgent answer.

Design Phase 1 as an anonymous public experience that makes current services, articles, personalized information guidance, fixed/basic information, and association specialities easy to find without creating a central registry of people seeking help.

The public experience should borrow Airtable's structured, friendly clarity with much lower density, stronger hierarchy, and more obvious status and freshness information. Association workspaces are designed in Phase 2, and team-management screens in Phase 3.

## 2. North-star Outcome

A person using a basic phone can find a relevant service or reviewed information path, understand which association provides it, and know how recently the information was verified in under two minutes.

## 3. Phase 1 Goals and Boundaries

### In scope

- Public multilingual service finder with list and map views.
- Places, service categories, schedules, exceptions, and current status.
- Visible last-updated, last-verified, and outdated/uncertain information.
- Public articles and downloadable files.
- Short actionable summaries plus reviewed audio for priority information and optional accessible video where it improves comprehension.
- Anonymous information simulator using optional, session-only answers to provide personalized reviewed information.
- Fixed information for stable reference content and basic information for urgent/frequently needed help.
- Association directory with verified specialities and consistent icon-and-text labels.
- Minimum restricted platform-editor workflows and audit history needed to publish on behalf of associations.
- Invitation acceptance, sign-in, and a minimal organisation-scoped article editor for designated association authors/publishers.
- Public-interface support for the configured 11-language catalogue: complete catalogues in French, English, and Arabic, and the English base plus per-language chrome overlays for the other eight.
- Equivalent core public journeys on responsive web, Android, and iOS, with platform-appropriate navigation and accessibility.

### Out of scope for these designs

- Assistance or beneficiary records.
- Asylum-seeker registration or shared personal identifiers.
- Persistent answers from the public information simulator.
- Public organisation signup, self-initiated account requests, full organisation settings, member administration, and the complete association workspace until Phase 2.
- Members, teams, availability, shifts, missions, operational notifications, and restricted participation-document signing until Phase 3.
- General HR files, payroll, performance management, and general-purpose contract drafting.
- Procurement accounting, named distribution histories, and assistance records beyond Phase 4 inventory scope.
- Advanced analytics dashboards.

Later-phase workspace designs remain visually and technically separated from the Phase 1 public experience.

## 4. Audiences

### A. Public visitor

May be newly arrived, under time pressure, unfamiliar with Calais, and using a low-cost phone with limited data. May read Arabic RTL, French, English, Pashto, Dari, or another configured language, may have limited literacy, or may prefer listening/watching to reading. Needs clear, current, non-judgmental information without signing in.

**Core need:** “Show me where I can get the help I need and whether it is available now.”

### B. Field worker or mediator

Uses the public product repeatedly to orient people and share reliable links. Needs fast language switching, printable information, and obvious freshness indicators.

**Core need:** “Help me give someone information I can trust and explain.”

### C. Platform editor or invited association publisher — Phase 1

The platform editor maintains public records and can publish on behalf of an association with recorded approval. An invited association publisher creates and publishes articles owned by their organisation. Both need safe defaults, previews, reminders, clear ownership, and clear publish state.

**Core need:** “Let me correct public information quickly without missing a required detail.”

### D. Association editor/administrator — Phase 2

Manages one verified association's public profile and publishing responsibilities. Must not accidentally see or change another organisation's workspace.

**Core need:** “Make access and responsibility obvious and auditable.”

### E. Coordinator, staff member, volunteer, intern, or document administrator — Phase 3

Coordinates or participates in teams, availability, shifts, and missions inside one organisation.

**Core need:** “Show me the operational information I need without exposing unrelated or sensitive data.”

## 5. Operating Conditions

Design for:

- A 320–430px phone screen in portrait orientation.
- Slow, intermittent, or expensive mobile data.
- Bright outdoor light and one-handed use.
- Stress, low digital literacy, and interrupted attention.
- Limited literacy and unwillingness to read long passages for one essential answer.
- Long translated strings and right-to-left layouts.
- Public information that may become stale within hours.
- Editors working on laptop and mobile during field operations.

The useful fallback is a text list, not an unloaded map, blank skeleton, or QR code.

## 6. Experience Principles

1. **Current before comprehensive.** Show whether information is reliable before extra detail.
2. **A path without an account.** Essential information is always reachable anonymously.
3. **List first, map second.** Location context helps, but it cannot be a dependency.
4. **One decision at a time.** Especially in the information simulator and mobile publishing.
5. **Explain uncertainty.** Never silently hide or present stale information as current.
6. **Separate audiences and data.** Public, workspace, and future sensitive modules are distinct.
7. **Localization is layout.** RTL, text expansion, language fallback, and verification are designed states.
8. **Fast correction wins.** Publishing workflows optimize for safe, quick operational updates.

## 7. Information Architecture

### Public navigation

- **Map & services** — list/map, filters, status, service details.
- **Articles** — dated, reviewed editorial information.
- **Simulator** — anonymous branching questions and personalized reviewed results.
- **Fixed information** — stable orientation, rights, procedures, transport, and safety reference pages.
- **Basic information** — urgent and frequently needed information.
- **Associations** — verified directory with speciality icon-and-text labels.
- **Downloads** — approved PDFs and files with translated metadata.
- **Language** — persistent session-level selector, always easy to reach.

On mobile, keep no more than four primary navigation destinations visible. Prioritize Map, Basic information, Simulator, and Language; place secondary destinations under **More**. Do not use an account/profile affordance on the anonymous public home.

### Phase 2 organisation workspace navigation

- Today’s runbook
- Activities — place, recurring hours, audience, and reusable services are managed inside each activity record
- Events & schedules
- Shared agenda (inter-organisation coordination events)
- Articles
- Simulator content
- Contacts
- Downloads & flyers
- Audit log
- Organisation settings

The current organisation name and user role remain visible in the workspace shell.

### Phase 3 additions

- Members
- City teams and their per-activity team subsets, always labelled distinctly
- Availability
- Planning
- Missions
- Meetings
- Notifications
- Documents

## 8. Priority Journeys

### Journey 1 — Find food available today

1. Visitor opens the public home in a detected or previously selected language.
2. Visitor chooses **Food** from essentials or service filters.
3. Results default to a list sorted by open/soon, confidence/freshness, and distance when location permission is granted.
4. Each result shows current status, next service time, place, and last verification.
5. Visitor opens a service detail and chooses directions, a safe contact method, or schedule.
6. If information is uncertain or outdated, the reason and next action are explicit.

### Journey 2 — Change language and use RTL

1. Visitor opens the language selector from any public screen.
2. Languages are shown using their own names and scripts, not flags.
3. Selecting Arabic immediately mirrors relevant layout and preserves the current page and filters.
4. Missing content falls back visibly to the configured fallback language.
5. Machine-translated content is labeled and never appears human-verified.

### Journey 3 — Use the anonymous information simulator

1. Visitor chooses a topic and sees the purpose, source, review date, and privacy note.
2. The flow asks one short question at a time.
3. Each question offers **Skip** or **Prefer not to say** when appropriate.
4. The personalized result explains relevant reviewed information and referral options, not eligibility or legal advice.
5. Visitor can start again; answers disappear when the browser session ends.

### Journey 4 — Find an association by speciality

1. Visitor opens the Associations directory.
2. Visitor filters by a need such as Medical care, Medication, Food, or Legal assistance.
3. Results show association name, purpose, speciality icons with text labels, supported languages, location, and last verification.
4. Visitor opens a profile to see verified services, schedules, safe contacts, and related information.
5. The design never relies on icons alone and never infers an unverified speciality from an association's name.

### Journey 5 — Create an activity and publish an exceptional change — Phase 2

1. Editor opens a dedicated activity page and chooses the authoritative source language, coordinating organisation, creator/provider organisations, category, audience, tags, services, and safe public contacts.
2. Editor writes the source title and description; optional target-language drafts stay visibly separate from the source and require review before locale publication.
3. Editor reuses a place, creates one through address autocomplete, or marks the activity mobile. A new place explicitly chooses exact, area-only, or contact-to-learn publication precision; contact-to-learn requires a safe contact.
4. Editor chooses a one-off dated occurrence or recurring weekly hours with optional effective dates, then adds split ranges later without overlap.
5. Editor may add a full- or partial-day closure, cancellation, exceptional opening, or uncertainty while creating the draft or from the activity record later.
6. A preview shows the exact public message in available languages. Missing translations use the visible source-language fallback rather than hiding urgent changes.
7. Editor publishes and receives confirmation; audit and immutable occurrence/verification evidence record the responsible actors and timestamps.

### Journey 6 — Publish an article that can become outdated — Phase 1

1. A platform editor acting on behalf of an association, or an invited association publisher, creates or edits an article.
2. The form asks: **Could any information in this article become outdated?**
3. If yes, the editor must set a date from which it may no longer be reliable; owner/review date are optional but encouraged.
4. Editor previews language, missing-translation, and freshness states.
5. Published article shows last updated and the dated warning when the threshold is reached.

### Journey 7 — Invite an association publisher — Phase 1

1. Platform operator verifies or selects the association record.
2. Operator enters the designated representative and article author/publisher permissions.
3. The screen summarizes the narrow Phase 1 access before sending an expiring invitation.
4. Operator can resend or revoke the invitation.
5. The invited representative accepts credentials and can access only their association's article editor.
6. Revoked access leaves the required audit history.

### Journey 8 — Plan a team — Phase 3

1. Coordinator opens a weekly staffing board with members as rows and days as columns.
2. Coordinator filters by team, team lead, member, role, skill, language, or state and reviews labelled availability, absence, assignment, conflict, and coverage states.
3. Coordinator creates shifts or missions and assigns available members without leaving the board.
4. Members accept, decline, or request a change from their personal mobile agenda.
5. A last-minute operational change prompts an authorised editor to review affected public information.

### Journey 9 — Sign a member document — Phase 3

1. Authorised document administrator selects a member and an organisation-approved, versioned template.
2. The system fills permitted fields and shows missing data, signers, signing order, expiry, and retention before sending.
3. Member reviews the exact document, signs or declines, and can retrieve the completed copy.
4. Additional signers complete the workflow in order when required for an internship or other multi-party document.
5. Document administrators see signature state and reminders; ordinary coordinators cannot open the file unless separately authorised.
6. The final file, evidence, version, timestamps, access, and signature events remain auditable.

### Journey 10 — Publish shared information with several organisations

1. Editor selects the proposed organisations and prepares the exact public revision, translations, media, sources, dates, and attribution.
2. Each organisation receives a secure, expiring approval link at a verified representative email address.
3. Representatives review the exact revision, leave notes/request changes, and approve or decline for their organisation.
4. Editor sees requested, viewed, changes requested, approved, declined, expired, and invalidated states per organisation and can reply.
5. After one approval, the public projection shows only approved organisations and their structured blocks.
6. Each later approval adds that organisation's logo, attribution, and bound content automatically without a new authored revision.
7. Free-text claims about a pending organisation block publication until structured or removed; a material authoring change creates a new revision and approval cycle.

### Journey 11 — Receive and transfer inventory — Phase 4

1. Stock operator scans/selects an item and receiving location, then enters quantity/unit and required lot/expiry data.
2. Preview shows the ledger movement and projected balance before posting.
3. Inventory admin offers stock to another organisation with quantities and logistics.
4. Destination admin accepts or declines and can add a note.
5. Dispatch/receipt creates tenant-local ledger movements and shows discrepancies without exposing either organisation's unrelated inventory.

## 9. Screen Inventory

Build every Phase 1 P0 screen before designing later phases. Open Design produces single-page artifacts, so treat each row as one focused artifact or one tightly related interactive state set.

| ID   | Phase | Phase priority | Screen/artifact                          | Required content and states                                                                                                                                                                                                                                                                        |
| ---- | ----- | -------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-01 | 1     | P0             | Public service finder                    | Multilingual grouped autocomplete for location/association/need, audience/category filters, list/map switch, provider logos/names, low-bandwidth list default                                                                                                                                      |
| P-02 | 1     | P0             | Service detail                           | Status, audience eligibility detail, freshness, schedule, exceptions, address/directions, all verified provider logos/names, safe contact, share/print, uncertainty state                                                                                                                          |
| P-03 | 1     | P0             | Basic information                        | Large task-oriented tiles, urgent short summaries, listen controls for priority content, matching map links, last-reviewed metadata, language behavior                                                                                                                                             |
| P-04 | 1     | P0             | Information simulator                    | Intro/privacy note, one question, optional choices, skip, progress, personalized result/referral, restart                                                                                                                                                                                          |
| P-05 | 1     | P0             | Articles                                 | Article index/detail, short actionable summary, images/video/audio, accessible media states, AI translation notice, publisher, source, freshness, print/download                                                                                                                                   |
| P-06 | 1     | P0             | Association directory/profile            | Speciality filters, icon-and-text labels, purpose, languages, services, safe contact, verification date                                                                                                                                                                                            |
| P-07 | 1     | P0             | Fixed information                        | Topic index/detail, owner/source, review interval, related services/articles, print/low-bandwidth                                                                                                                                                                                                  |
| P-08 | 1     | P1             | Downloads                                | Search/filter, file metadata, language/freshness, preview/download states                                                                                                                                                                                                                          |
| E-01 | 1     | P0             | Association publisher invitation/sign-in | Platform-issued invitation, association identity, narrow permission summary, accept/expired/revoked states                                                                                                                                                                                         |
| E-02 | 1     | P0             | Minimal article editor                   | Images/video, AI provenance, per-organisation approval notes/state, approval-filtered projection, draft, preview, immediate or scheduled publish, unpublish, revision history                                                                                                                      |
| W-01 | 2     | P0             | Workspace overview                       | Current organisation, items needing review, today's schedules, recent changes, quick publishing actions                                                                                                                                                                                            |
| W-02 | 2     | P0             | Activity runbook and records             | Date-driven occurrence list, full month calendar in a collapsible information rail on wide screens, same-day confirm/correct/cancel/uncertain actions, multilingual title/rich description, public target, icon-labelled reusable-service CRUD and multi-assignment, and a mobile list alternative |
| W-03 | 2     | P0             | Schedule/closure editor                  | Recurrence, holiday default, exception dates, public preview, publish confirmation                                                                                                                                                                                                                 |
| W-04 | 2     | P0             | Article editor                           | Draft/published state, media, AI provenance, translation tabs, proposed organisations, approval notes/projection, custody transfer/history, preview, revision history                                                                                                                              |
| W-05 | 2     | P0             | Organisation profile editor              | Verified identity, purpose, effective/pending speciality changes, primary/order, languages, contacts, freshness, public preview                                                                                                                                                                    |
| W-06 | 2     | P1             | Simulator-content editor                 | Question tree, result content, source/owner/review dates, anonymous-public preview                                                                                                                                                                                                                 |
| W-07 | 2     | P1             | Roles, invitations, and audit            | Phase 2 publishing roles, invite/account state, permission summary, audit events                                                                                                                                                                                                                   |
| W-08 | 2     | P0             | Shared inter-organisation agenda         | Calendar/list of coordination events across organisations for the active city, visibility badges (organisation/inter-organisation), recurring occurrences, participation states (attending/interested/declined), cancellation with visible reason, event editor; never public                      |
| T-01 | 3     | P0             | Members and teams                        | Staff/volunteer/intern state, team assignment, skills/languages, permissions, offboarding                                                                                                                                                                                                          |
| T-02 | 3     | P0             | Availability and weekly planning         | Member-row/day-column board, team/member filters, availability, absence, assignments, coverage, conflicts, skill/language gaps, shift assignment                                                                                                                                                   |
| T-03 | 3     | P0             | Mission and mobile agenda                | Mission detail, required/preferred language/permit/training/skills, match/gap explanation, accept/decline, notifications                                                                                                                                                                           |
| T-04 | 3     | P0             | Restricted documents                     | Template/version, member, signers/order, review, signature states, reminders, final copy/evidence, access and audit                                                                                                                                                                                |
| T-05 | 3     | P0             | Member qualifications and training       | Purpose/visibility/retention notices, spoken languages, permit categories, course catalogue/completion, verification/expiry                                                                                                                                                                        |
| T-06 | 3     | P0             | Agenda import                            | ICS/CSV upload, timezone/mapping, duplicate/error preview, commit results, undo batch                                                                                                                                                                                                              |
| I-01 | 4     | P0             | Inventory overview/catalogue             | Location/item search, balances, lots/expiry, alerts, recent movements, role-safe cost visibility                                                                                                                                                                                                   |
| I-02 | 4     | P0             | Stock movement                           | Receive/adjust/damage/expire/distribute, scan/manual input, preview, reason, resulting balance                                                                                                                                                                                                     |
| I-03 | 4     | P0             | Transfers/reservations/kits              | Internal and cross-org acceptance, dispatch/receipt/discrepancy, event/mission reservations, versioned kit components                                                                                                                                                                              |
| I-04 | 4     | P1             | Inventory import                         | CSV mapping/unit validation, duplicate/error preview, idempotent results, compensating reversal                                                                                                                                                                                                    |

## 10. P0 Screen Requirements

### P-01 — Public service finder

**Primary action:** Open a relevant activity record.
**Top information:** Current language, page purpose, search/autocomplete, audience, service need, “Open now” filter.  
**Service-card order:** Status → offering name → audience → next time → place/distance → compact included-feature preview → provider logos/names → last verified → primary action.
**Desktop:** list/map split view.  
**Mobile:** list view first, map opened on request.  
**Required states:** autocomplete loading/grouped/no suggestions/error, no location permission, location unavailable, no matches, offline cached results, uncertain results, missing translation, RTL.

### P-02 — Service detail

**Primary action:** Get directions or use the safest available contact method.  
**Above fold:** Status, service name, next occurrence, address/directions, freshness.  
**Below:** Audience/eligibility detail, full schedule, exceptions, complete icon-and-text included-feature list, accessibility details when verified, languages, all provider logos/names, contact, related information.
**Required states:** open, closed, cancelled, uncertain, outdated, holiday exception, no contact method, print view.

### P-03 — Basic information

**Primary action:** Open urgent information or matching service results.  
**Layout:** Large icon-and-text tiles for emergency help, food/water, healthcare, shelter/day services, clothing/showers, charging, legal help, and orientation.  
**Safety:** Essential information never requires simulator answers, location permission, or an account.  
**Required states:** current, outdated, missing translation, offline, no verified information for a topic, RTL.

### P-04 — Information simulator

**Primary action:** Answer the current question or continue to information.  
**Layout:** One question per screen with a short explanation and progress text; a city question appears first when several cities are active (cities are catalogue data), followed by need, current-location (city area), timing, and who-is-it-for questions.
**Privacy:** State that answers remain in the browser session and are not attached to identity; the result PDF is generated on the device and never uploaded.
**Result:** Open with a summary of the given answers, then assemble personalized reviewed information and ranked recommendations in a dedicated card format with visible reasons — distinct from service-list cards — plus next steps, without making an eligibility decision; offer a PDF download.
**Required states:** intro, question, optional/prefer-not-to-say answer, skipped answer, multi-city city question, answers summary, personalized ranked result, no-match, content outdated, PDF download, restart confirmation, RTL.

### P-05 — Articles

**Primary action:** Act on the short answer, listen, print, or follow a related reviewed resource.  
**Layout:** Article index plus a focused detail view ordered as short plain-language summary → key facts/action → listen control → optional sections. Owner, publisher, source, update date, review/freshness state, and related services remain visible. Do not require reading a 400-word body to reach the answer.  
**Required states:** current, review warning, outdated, missing translation/fallback, AI-translated notice, image alt/decorative state, audio/video available/unavailable/loading/error, captions/transcript, low-bandwidth, print.

### P-06 — Association directory and profile

**Primary action:** Find an association by verified speciality or open its service information.  
**Card order:** Name → purpose → primary speciality → secondary speciality icons with text → languages/location → last verified.  
**Icon rule:** Use a controlled taxonomy and always pair icons with visible labels. A medical example may use `Stethoscope`, `Pill`, and `UserRoundPlus`; never infer services from a logo or organisation name.  
**Profile narrative:** After current services and contact information, the full profile may show an organisation-confirmed founding year, goals, and values with its official source and check date. These fields are optional, translated content and remain non-public while the profile is a discovery draft.
**Profile activity structure:** Group visitor-facing activities by place. Each activity card shows its own status, audience, next opening, description, safe contact, freshness, and icon-labelled reusable services. Do not merge services from separate activities.
**Required states:** filter by speciality, multiple specialities, organisation with several distinct offerings, one place with several offerings, no matches, unverified/outdated profile, missing logo, missing translation, RTL.

### P-07 — Fixed information

**Primary action:** Read stable reference information or open a related service/article.  
**Layout:** Topic index and reading view with owner, source, last-reviewed date, review interval, related services, and print.  
**Required states:** current, outdated, corrected, missing translation/fallback, low-bandwidth, print.

### Phase 2 workspace examples

### W-01 — Workspace overview

**Primary action:** Resolve items that affect public accuracy.  
**Order:** Items needing attention → today's public services → recent changes → secondary administration.  
**Avoid:** Vanity charts, global organisation comparisons, assistance/person counts.  
**Required states:** no issues, several urgent cancellations, missing translations, expired content, empty new organisation.

### W-03 — Schedule/closure editor

**Primary action:** Publish schedule change.  
**Form order:** Current schedule → change type → date/time → reason → affected occurrences → translation/public preview → publish.  
**Safety:** Explain French public-holiday exclusion default and show exactly which occurrences will change.  
**Required states:** single closure, exceptional opening, recurring schedule edit, date conflict, incomplete translation, published confirmation.

### W-04 — Article editor

**Primary action:** Save draft (default), publish now, or schedule publication.
**Form order:** Title/body → translations → can become outdated? → validity/review → owner/source → preview → publication choice.
**Safety:** Public preview must show fallback and warning behavior.  
**Required states:** clean draft, autosave in progress, missing required validity date, missing translation, revision comparison, unpublished, archived.

## 11. State and Status Matrix

### Service status

| Status    | User-facing meaning                                             | Presentation                                                                                                                                          |
| --------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open      | Service is operating now based on its confirmed schedule/status | Green pulsing presence dot + `Open now` + next closing time; the pulse is decorative, never the sole signal, and stops under `prefers-reduced-motion` |
| Closed    | Not operating now; a later confirmed occurrence exists          | Neutral clock + `Closed` + next opening                                                                                                               |
| Cancelled | A scheduled occurrence will not happen                          | Red x + `Cancelled` + affected date/reason when safe                                                                                                  |
| Uncertain | Information is expired, conflicting, or unconfirmed             | Amber warning + `Information uncertain` + verification action                                                                                         |

### Freshness

| State          | Presentation                                                                         |
| -------------- | ------------------------------------------------------------------------------------ |
| Current        | Quiet `Last verified…` metadata                                                      |
| Review soon    | Amber review chip in workspace; public view remains current                          |
| Outdated       | Prominent dated public warning and uncertain status where availability depends on it |
| No review data | Treat as uncertain; never imply that it is current                                   |

### Translation

| State                            | Presentation                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| Human verified                   | Language available without qualification                                              |
| Draft                            | Workspace-only draft label                                                            |
| Machine translated               | Visible `Translated from [source] to [target] using AI` plus `Not yet human verified` |
| AI translated and human reviewed | Visible AI provenance notice plus separate `Human verified` state                     |
| Missing                          | Explicit fallback-language notice; essential actions remain usable                    |

### System

Every artifact must include or document loading, empty, error, offline, permission-denied, and success states. Skeletons must resemble the final layout and must not hide an offline or error condition.

## 12. Prototype Content

Use realistic structure but fictional records. Prefix fixtures with **Demo** and show **Demo data — do not publish** in every artifact.

### Example service

- Category: Food
- Name: Demo evening food distribution
- Organisation: Association Démo A
- Status: Open now
- Schedule: Today, 18:00–20:00
- Address: Demo location, Calais
- Last verified: 16 July 2026 at 14:20
- Languages: Français, English, العربية
- Exception example: Cancelled Monday 20 July; demo operational reason

### Example freshness warning

> This information may be outdated from 20 July 2026. Check with the listed contact before relying on it.

### Example simulator question

> Which information would you like to see first?

Choices: **Food**, **Healthcare**, **Legal information**, **Something else**. Include **Skip this question** and explain that the answer is not saved after the session. Questions involving nationality, passport possession, health, administrative status, or travel intentions require the explicit purpose and privacy approval defined in `PRODUCT.md` before they appear in a prototype.

### Example association profile

- Name: Demo Medical Association
- Purpose: Demo clinical and health support
- Primary speciality: Medical care — `Stethoscope`
- Secondary specialities: Medication — `Pill`; Doctors — `UserRoundPlus`
- Languages: Français, English, العربية
- Last verified: 16 July 2026

Use fictional organisation names in prototypes. A real organisation such as MSF may only receive these labels after it verifies the services offered at the relevant Calais location.

### Example organisation with separate activities

Use this structure with a fictional provider in prototypes. The MFS name and programme claims require provider verification before public use.

1. **Accueil de jour**
   - Category: Day services
   - Included features: clothes cleaning, shower, phone charging, social assistance, mental-health support, food, drinking water, and welcome kit
2. **Nurse-led health activity**
   - Category: Healthcare
   - Included features: nursing care, dressing changes, basic pain-relief support, and treatment of minor health issues

The interface renders two activity cards. It does not place all day-centre services on the nurse-led activity. Each activity displays its own place, schedule, audience, status, description, contact, and verification date; reusable services appear only where explicitly assigned.

Do not use real association names, real contact details, or claims about current programmes in prototypes unless a responsible editor has verified and approved them.

## 13. Accessibility, Localization & Safety Acceptance

A design is not ready for handoff until it demonstrates:

- Keyboard operation and a visible 2px focus indicator.
- WCAG 2.2 AA text and component contrast.
- 44×44px minimum public touch targets.
- 200% zoom without loss of content or function.
- A working 320px mobile layout without horizontal scrolling.
- An Arabic RTL version of at least P-01, P-02, and P-04.
- At least 50% text expansion in labels and cards.
- Icon + text + color for important statuses.
- A list-based fallback when maps, geolocation, or scripts fail.
- Visible translation, freshness, offline, and uncertainty states.
- No personal, sensitive, or assistance-record data in fixtures.
- No forced sign-in for public information.
- Priority information can be understood through short summary plus reviewed audio without reading the long-form body.
- Audio/video has accessible controls, no autoplay, captions/transcripts, duration/file-size metadata, and a low-bandwidth fallback.
- No dark patterns, countdown pressure, or implied eligibility decisions.

## 14. Design Deliverables

The initial design pass should produce:

1. P-01 public service finder at 390px and 1440px.
2. P-02 service detail at 390px, including cancelled and uncertain variants.
3. P-03 basic information at 390px.
4. P-04 information simulator at 390px in LTR and RTL.
5. P-05 article index/detail with freshness variants.
6. P-06 association directory/profile with speciality icon-and-text filters.
7. P-07 fixed-information index/detail with print/low-bandwidth treatment.
8. E-01 association-publisher invitation/sign-in states.
9. E-02 minimal association article editor plus platform proxy-publishing mode.
10. A compact Phase 1 public/publishing component-state sheet.

Complete and validate these Phase 1 artifacts before starting Phase 2 workspace or Phase 3 team-management designs. Export each approved web artifact as real HTML/CSS suitable for engineering handoff and provide the corresponding React Native/Expo component, navigation, safe-area, permission, and platform-state specification for Android/iOS. Record unresolved product questions next to the relevant artifact rather than inventing policy.

## 15. Open Questions to Resolve During Design

- Which of the eleven configured languages earn a complete interface catalogue after French, English, and Arabic, and in what order?
- Which four public destinations belong in mobile primary navigation?
- Which fixed-information topics and basic-information topics are approved for launch?
- Which translated eligibility details distinguish children-only from under-18-only services, and how should exact age bounds appear?
- Which address/geocoder source and need synonyms power autocomplete in each launch language?
- Which speciality taxonomy and icon set are approved, and who verifies an association's labels?
- Can the product request geolocation by default, or only after a user action?
- What makes a service “uncertain,” and when does it override “open” from the schedule?
- Who may confirm freshness, and how often must each content type be reviewed?
- Which safe contact methods may be displayed publicly?
- What content must work in printable/low-bandwidth mode?
- Which priority content/languages require reviewed audio or video at launch, who records/approves it, and how short must the initial actionable summary be?
- Which Phase 1 associations receive author-only access versus direct publishing permission?
- What approval evidence must a platform editor record when publishing on behalf of an association?
- Which verified organisation roles may approve joint content, how long approval links remain valid, when reminders are sent, and which edits force reapproval?
- Which member qualification fields are required for each pilot role, who verifies them, and how should override reasons appear?
- Which Phase 4 movement types, units, scan codes, cost fields, transfer states, and physical-count workflows belong in the pilot?
- What offline verification process must the platform complete before sending a Phase 1 or Phase 2 organisation invitation?
- Which urgent publication changes may use fallback language immediately?
- Which simulator flows/questions are approved for launch, and has each sensitive contextual question passed the product/privacy review required by `PRODUCT.md`?
