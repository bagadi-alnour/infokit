# Calais Info — Canonical Product Requirements Document

## Document control

| Field | Value |
| --- | --- |
| Status | Canonical product requirements; stakeholder decisions marked `TBD` remain open |
| Last updated | 18 July 2026 |
| Initial release | Phase 1 — Public information |
| Primary surfaces | Responsive web application built with React; Android and iOS applications built with React Native and Expo |
| Primary location | Calais, France |
| Product owner | `TBD` |
| Intended readers | Product, design, engineering, operations, association partners, governance, and data-protection reviewers |

## 1. Authority and document precedence

This file is the authoritative description of what Calais Info is, who it serves, what is included in each committed phase, which requirements must be met, and how completion is judged.

A reader should be able to understand the product and delivery boundaries without opening another file. Supporting documents contain deeper implementation or design detail, but they must not expand or contradict this PRD without a corresponding update here.



## 2. Executive summary

Calais Info is a multilingual public-information and association-coordination platform for Calais. It addresses information and operational work fragmented across messages, spreadsheets, websites, email, and paper.

The long-term ambition is global: the platform is designed so it can later be deployed for other territories. Calais is the first and only committed deployment; territory-specific facts (places, languages, holiday calendars, emergency numbers, taxonomies) are configuration and content, never hardcoded, and no multi-territory feature is committed in Phases 1–4.

The product begins with a public service that helps anyone answer five questions quickly:

1. What help or reviewed information is available?
2. Where is it?
3. Is it available now or on the selected day?
4. Which verified association is responsible?
5. When was the information last verified, and can it still be relied on?

Later committed phases allow verified associations to manage public information, coordinate staff and volunteers, and manage inventory inside isolated workspaces.

The product is not an asylum-seeker registry, eligibility engine, case-management system, payroll product, or general HR platform. Phase 4 adds organisation inventory. Person-level assistance records remain outside committed scope.

## 3. Problem and product opportunity

### Current problem

- People seeking help may not know which services exist, where they are, or whether a published schedule is still current.
- Information changes quickly and can conflict across websites, messages, spreadsheets, and paper.
- Language, limited connectivity, unfamiliarity with Calais, stress, and low-cost phones make ordinary directory experiences insufficient.
- People who cannot read confidently, have limited literacy in every available language, or prefer listening are excluded when essential information exists only as long text. A 400-word page must never be the only route to an essential answer or action.
- Associations spend time duplicating public updates and coordinating people through unrelated tools.
- Existing tools can blur public information, operational membership data, and highly sensitive assistance information.

### Product opportunity

Create one trustworthy public information layer and isolated association workspaces while maintaining strict boundaries between:

1. Anonymous public information.
2. Association-owned publishing and operational data.
3. Restricted participation documents.
4. Any future assistance records, which require separate governance and stronger protection.

### North-star outcome

A person using a basic phone can find a relevant service or reviewed information path, identify the responsible association, and understand the information's freshness in under two minutes without creating an account.

## 4. Product principles

1. **Current before comprehensive.** Reliability, status, and verification are more important than maximum content volume.
2. **Essential information without an account.** Public services, basic information, fixed information, articles, associations, and the simulator remain anonymously accessible.
3. **List first, map second.** The map is useful but never the only way to find a service.
4. **One decision at a time.** Public and mobile workflows minimize cognitive load.
5. **Explain uncertainty.** Stale, conflicting, missing, or unverified information is identified rather than silently presented as current.
6. **Separate audiences and data.** Public, organisation, restricted-document, and possible future assistance areas are distinct authorization boundaries.
7. **Localization is a product behavior.** RTL layout, long strings, fallback, and translation verification are designed states.
8. **Fast, accountable correction.** Public information can be corrected quickly while preserving ownership, approval, revision, and audit history.
9. **Collect the minimum.** Information is collected only for a documented operational purpose.
10. **No unsupported decisions.** The simulator provides reviewed information and referrals, not eligibility decisions or legal advice.
11. **Short and multimodal first.** Lead with the answer and next action, then offer listening, visual guidance, and optional detail instead of requiring a long read.

## 5. Users and jobs to be done

| User | Phase | Primary need |
| --- | --- | --- |
| Public visitor | 1 | Find, listen to, or view relevant current information without signing in, including when reading long text is difficult or undesirable |
| Field worker, interpreter, or mediator | 1 | Find, explain, print, or share information whose owner and freshness are clear |
| Platform operator/editor | 1–4 | Verify organisations, maintain shared taxonomies, publish safely, moderate conflicts, and investigate audit events |
| Invited association author/publisher | 1 | Create, translate, preview, and publish articles owned by their association within narrow permissions |
| Organisation administrator | 2–4 | Manage one verified workspace, its users, permissions, profile, publishing responsibilities, inventory access, and audit history |
| Organisation editor | 2–4 | Maintain public places, services, schedules, events, articles, contacts, downloads, and permitted simulator content |
| Translator/reviewer | 2–4 | Review assigned content and languages without broader administrative access |
| Coordinator/team lead | 3 | See coverage, organize teams, plan shifts/missions, and respond to operational changes |
| Staff member, volunteer, or intern | 3 | Maintain permitted profile/availability data and see assigned teams, schedules, missions, and document tasks |
| Document administrator/authorised signatory | 3 | Prepare approved participation documents, manage signers, and audit completed workflows |
| Viewer/auditor | 3–4 | Read explicitly permitted reports or history without editing |
| Inventory manager | 4 | Manage stock locations, items, movements, reservations, kits, transfers, and alerts without access to assistance records |

People may use more than one role, but permissions remain explicit and organisation-scoped.

## 6. Terminology

| Term | Meaning |
| --- | --- |
| Organisation/association | A verified participating entity with a stable identity and, from Phase 2, an isolated workspace |
| Public visitor | Any anonymous user of the public product |
| Place | A physical location used by one or more public services or events |
| Service offering/service | One visitor-facing activity or programme offered by an organisation at a place, for an audience, and according to its own schedule and status. An organisation may publish several distinct service offerings |
| Included service feature | A controlled icon-and-text amenity or intervention available within one service offering, such as a shower, laundry, phone charging, drinking water, social assistance, or nursing care |
| Public event | A dated or recurring public activity such as a temporary distribution |
| Coordination event | An organisation- or platform-hosted meeting/event for organisation members, city-scoped, either organisation-scoped or inter-organisation (informally "global": visible to authenticated members of all verified organisations); never public |
| Occurrence | One concrete date/time instance of a recurring service, public event, meeting, shift, or mission |
| Article | Dated editorial information that may change and has revision/freshness metadata |
| Fixed information | Relatively stable reference content that still has an owner and review interval |
| Basic information | The shortest route to urgent or frequently needed information and matching services |
| Information simulator | An anonymous branching information-navigation flow using optional session-only answers |
| Priority information | Launch content whose absence or misunderstanding could materially prevent access to an essential service; the approved list and required audio languages are set during Phase 0 |
| Speciality | A verified controlled classification of what an organisation does; an organisation may have many and at most one marked primary |
| Tag | A flexible global or organisation-scoped label with color and display order; it supplements but does not replace verified taxonomies or permissions |
| Member | A staff member, volunteer, or intern represented inside one organisation |
| Engagement | A dated period in which a member participates as staff, volunteer, intern, or a future configured member type |
| Mission | A private operational assignment with time, place, instructions, team, and requirements |
| Participation document | An approved volunteer, internship, charter, confidentiality, or acknowledgement document routed through restricted signing |
| Factual owner | The organisation responsible for the accuracy of public information, including when the platform publishes on its behalf |
| Joint publication | One exact public content revision attributed to two or more organisations after each displayed organisation has approved that revision |
| Audience category | A controlled public label describing who a service or event accepts, with provider-supplied eligibility details |
| Administrative custodian | The organisation or platform team allowed to maintain an article; custody does not rewrite historical factual ownership |
| Training/course | An organisation or platform catalogue entry that a mission may require or prefer and a member may declare as completed |
| Stock movement | An append-only inventory entry that increases, decreases, reserves, releases, assembles, transfers, distributes, damages, or expires stock |

## 7. Product and security boundaries

### 7.1 Public information area

- Accessible without an account.
- Contains published places, services, events, articles, fixed/basic information, association profiles, downloads, safe contacts, and simulator flows.
- Never exposes organisation members, team availability, private instructions, draft content, document records, or future assistance records.

### 7.2 Organisation workspace

- Isolated per organisation.
- Contains publishing and, from Phase 3, operational coordination tools.
- The current organisation and active role remain visible to reduce cross-organisation mistakes.
- A user can belong to several organisations concurrently or sequentially; access in one organisation grants nothing in another.
- From Phase 2, a shared inter-organisation agenda of coordination events is visible to authenticated members of verified organisations. It is a deliberate, narrow cross-organisation surface (like transfers and joint publication) and is never public.

### 7.3 Restricted document area

- Separate from ordinary member profiles and planning.
- Requires explicit document permissions.
- Stores approved templates, generated files, signer state, final signed copies, provider evidence, retention, and access audit.
- A coordinator or organisation administrator does not automatically receive document-reading permission.

### 7.4 Inventory area

- Available from Phase 4 inside each organisation workspace.
- Uses inventory-specific permissions, locations, item catalogues, stock movements, transfers, reservations, kits, and audit history.
- Keeps financial fields behind a separate permission and does not expose recipient identities or assistance records.

### 7.5 Possible future assistance-record area

- Not included in Phases 1–4.
- Must not share ordinary content, membership, inventory, or document access rules.
- Requires a demonstrated purpose, governance agreement, lawful basis, retention, subject-access/correction process, impact assessment, and appropriate specialist review before implementation.

## 8. Delivery sequence and scope boundaries

| Phase | Committed outcome | Dependency |
| --- | --- | --- |
| 0. Discovery | Validate field workflows, pilot partners, governance, and measures | None |
| 1. Public information | Anyone can find current multilingual information; platform editors and narrow invited association publishers can maintain articles | Discovery decisions sufficient for launch content |
| 2. Association onboarding and publishing | Verified associations manage their public profile and content in isolated workspaces | Stable Phase 1 public journeys and content rules |
| 3. Team management | Onboarded associations coordinate members, teams, availability, missions, notifications, and restricted participation-document signatures | Verified Phase 2 workspaces and permissions |
| 4. Inventory management | Onboarded associations manage locations, items, stock movements, transfers, reservations, kits, distributions, and alerts | Stable Phase 3 roles, audit, and operational workflows |

The phases are sequential. Every phase ends with a controlled pilot and iteration checkpoint. Assistance records require a separate approval and PRD update after Phase 4.

### 8.1 Delivery method — slices and gates

The four phases are the product map. Delivery is cut into smaller slices, each ending at a gate with explicit criteria, because the delivery capacity is one operator working with AI tools (see `SUSTAINABILITY.md`). Three rules govern the cut: scope follows review capacity, not generation capacity; every feature names its operator before it ships; verified content beats new features when time is short.

Discovery runs through the product itself ("show, don't survey"): Slice 0 produces a **private** instrument seeded with real services from organisations' own public channels, each record marked unverified with its source and check date. The verification conversations that follow are simultaneously the Phase 0 interviews and the Phase 2 adoption funnel.

| Slice | Delivers | Gate |
| --- | --- | --- |
| 0 — Instrument (~4–6 weeks) | Private build of both first-class public surfaces from one shared codebase — server-rendered web (installable PWA) and the React Native + Expo mobile app — FR/EN/AR, ~25–30 tables: services, places, schedules, statuses/freshness, basic information, directory, share snippet, simulator engine with draft flows, single-editor console | G0: the operator answers real "where can someone get X today?" questions faster with it than with existing channels, on web and on the mobile build |
| 1 — Verification loop (weeks 5–12) | Corrections workflow, verified-by metadata, print cards; simulator launch flows reviewed with organisations and mediators; conversations with 3–5 organisations | G1 (public soft launch): ≥15–20 services across ≥5 organisations verified within 30 days, and ≥2 organisations committed to a monthly confirmation loop; web goes public immediately and the mobile builds follow as store review clears (direct install for the pilot in the meantime) |
| 2 — Phase 1 completion (months 3–6) | Articles, fixed information, downloads, priority audio (uploaded files), Pashto/Dari with named reviewers, flyers, store-release hardening on both mobile platforms | G2: Phase 1 exit criteria (Section 10.7), with joint publication deferred to its trigger below |
| 3 — Phase 2 lite (months 6–9) | Pilot organisations upgraded in place to real workspaces; cancellation publishable in under one minute | G3: two active workspaces and Stage B backing (`SUSTAINABILITY.md` §2) |
| 4+ — Evidence-gated | Remaining Phase 2, then Phases 3–4 | Feature triggers below, plus the Phase 3 hard gate: a legal entity as responsible party (`RISKS.md` R6) |

Deferred features return on evidence, not on schedule:

| Deferred | Returns when |
| --- | --- |
| Autocomplete search | Pilot users demonstrably fail with browse + filter |
| Joint-publication engine (sealed revisions, projections) | Two organisations request one co-published record |
| Media processing pipeline | Audio/video volume exceeds manual file handling |
| Languages beyond the launch set | A named person owns that language's review (Section 17) |
| Organisation self-publishing invitations | An organisation asks to publish its own articles |

Kill/pivot criterion, written down in advance: if by week 12 no organisation will verify its records monthly, the maintenance premise has failed — pivot per `LANDSCAPE.md` §4 rather than adding features. Dates are planning aids; gates are real. The product improves through use: every gate includes a review of what field interaction has taught, and this PRD is updated before scope expands.

## 9. Phase 0 — Discovery requirements

Before Phase 1 implementation is considered production-ready:

- Interview three to five associations, public visitors or representative participants, coordinators, and mediators/interpreters.
- Select two pilot organisations: ideally one material-assistance organisation and one information/mediation/referral organisation.
- Map current service-update, schedule-change, publishing, translation, and public-information workflows.
- Establish who operates the platform and who owns each public content type.
- Confirm launch content, configured languages, safe contacts, review intervals, and pilot measurements.
- Document why users return to WhatsApp, spreadsheets, email, websites, or paper.
- Resolve or explicitly accept every launch-blocking item in Section 24.
- Run discovery through the Slice 0 instrument (Section 8.1): real records seeded from public sources on a private URL, marked unverified, corrected live in conversation with each organisation.
- Ask every organisation the publication-safety question: what must never be published, and at what precision (`RISKS.md` R5)?

## 10. Phase 1 — Public information

### 10.1 Objective

Launch a useful anonymous public service before asking associations to adopt complete workspaces.

Phase 1 must allow a visitor to determine what help exists, where and when it is available, who provides it, how recently it was checked, and which reviewed information applies to optional answers.

### 10.2 Public navigation

1. **Map & services** — list/map, filters, status, schedules, and service details.
2. **Articles** — dated, reviewed editorial information.
3. **Simulator** — anonymous branching questions and reviewed results.
4. **Fixed information** — orientation, rights, procedures, transport, and safety references.
5. **Basic information** — urgent and frequently needed information.
6. **Associations** — verified directory and speciality filters.
7. **Downloads** — approved files with translated metadata.
8. **Language** — persistent session-level selector.

On small screens, Map, Basic information, Simulator, and Language are immediately reachable. Lower-priority destinations may appear under **More**. The anonymous home does not display an account/profile prompt.

### 10.3 Functional requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-P1-001 | Public information is accessible without an account or identity collection | P0 |
| FR-P1-002 | Service discovery starts with a low-bandwidth list and offers an optional map | P0 |
| FR-P1-003 | Visitors can filter services by category, audience, day, open-now state, language, and verified accessibility information | P0 |
| FR-P1-004 | A service shows place/directions, schedule, current status (including the next opening time when closed), each providing association's approved logo and name, safe contact, language/accessibility data, and last verification | P0 |
| FR-P1-005 | Service status supports open, closed, cancelled, and information uncertain with icon, text, and color | P0 |
| FR-P1-006 | Recurring service hours support exceptional openings/closures and configurable French public-holiday behavior | P0 |
| FR-P1-007 | Public events support recurrence, concrete occurrences, cancellation, uncertainty, audience category, related services, and one or more providing associations | P0 |
| FR-P1-008 | Articles support title, summary, structured body, cover/inline images, video, one or more factual owners/publishers, sources, translations, revision history, review dates, and related records | P0 |
| FR-P1-009 | Creating/editing an article asks whether it can become outdated and requires an unreliable-from date when the answer is yes | P0 |
| FR-P1-010 | From the unreliable-from date, the public article displays a dated warning without automatically disappearing | P0 |
| FR-P1-011 | Fixed information and basic information remain directly reachable without using the simulator | P0 |
| FR-P1-012 | The association directory shows verified purpose, specialities, icon-and-text labels, languages, locations, schedules, safe contacts, and last verification | P0 |
| FR-P1-013 | An organisation may store many verified specialities, with at most one optional primary; the initial card displays the primary plus up to four secondary specialities, or up to five co-equal specialities when no primary is marked | P0 |
| FR-P1-014 | Downloads show title, description, language, type, size, factual owner(s)/publisher(s), update date, and freshness state | P1 |
| FR-P1-015 | Important pages offer printable and low-bandwidth representations | P0 |
| FR-P1-016 | Priority public information provides a reviewed per-language audio version and may include video; media includes accessible controls, duration/file-size metadata, captions/transcripts, no autoplay, and a low-bandwidth alternative | P0 |
| FR-P1-017 | The simulator asks one short optional question at a time and provides Skip, Back, Prefer not to say where appropriate, and Start again | P0 |
| FR-P1-018 | Simulator results are assembled from reviewed content, services, associations, contacts, and next steps, and never claim eligibility or legal advice | P0 |
| FR-P1-019 | Simulator rules/results have at least one factual owner, source, last-reviewed date, and review/expiry date | P0 |
| FR-P1-020 | Simulator answers remain only in browser session memory/storage and are not attached to identity, analytics, association accounts, or assistance records | P0 |
| FR-P1-021 | A platform editor can publish public content on behalf of an association only with recorded factual ownership and approval evidence | P0 |
| FR-P1-022 | A platform operator can invite a designated association author/publisher with expiring, resendable, and revocable access limited to owned articles | P0 |
| FR-P1-023 | Invited association authors/publishers can create, translate, preview, publish, unpublish, and archive owned articles without accessing Phase 2/3/4 tools or another organisation | P0 |
| FR-P1-024 | Public and editorial changes retain attributable audit/revision history | P0 |
| FR-P1-025 | The Phase 1 public experience is delivered on responsive web, Android, and iOS; the mobile apps use React Native and Expo and expose the same public content, privacy, freshness, translation, and accessibility behavior | P0 |
| FR-P1-026 | Every public detail page leads with a short plain-language summary, essential facts, primary action, and a visible listen option before optional long-form detail; no essential outcome requires reading the full article/page | P0 |
| FR-P1-027 | Editors can upload or record localized audio/video, manage rights/ownership, attach captions/transcripts, review each language, and apply the same freshness/publication workflow as text | P0 |
| FR-P1-028 | A public record may display multiple publishing/factual-owner organisations only after every displayed organisation approves the exact revision through a secure request sent to a verified representative email | P0 |
| FR-P1-029 | Public attribution, logos, and structured organisation-specific blocks are derived from approval state: the public view hides each unapproved organisation and activates its approved content automatically when that organisation approves the sealed revision | P0 |
| FR-P1-030 | Approval state supports requested, viewed, changes requested, approved, declined, expired, cancelled, and invalidated; representatives and requesters can exchange revision-linked notes, and a material content change creates a new revision and invalidates earlier approvals | P0 |
| FR-P1-031 | Service/map search provides multilingual, typo-tolerant autocomplete across locations, addresses/landmarks, association names, service categories, specialities, and needs such as clothes, shoes, tents, water, SIM cards, calling family, and device charging | P0 |
| FR-P1-032 | Every service and public event has one controlled audience category: all public, women only, children only, under 18 only, families only, or adult men only; the provider supplies translated eligibility details and exact age limits where needed | P0 |
| FR-P1-033 | Every published service and public event has at least one verified providing association whose approved logo and text name remain visible on cards, details, and map results | P0 |
| FR-P1-034 | Article images and video include rights evidence, alt text or equivalent description, captions/transcripts where applicable, poster/thumbnail, processing state, and low-bandwidth fallback | P0 |
| FR-P1-035 | AI-assisted translations store their source and target languages and display a localized notice that AI translated the text, including after human review; verification state remains separate | P0 |
| FR-P1-036 | If a Phase 1 publisher leaves or changes organisation, ending the old membership revokes old-organisation access without changing article custody, factual ownership, public attribution, URLs, revisions, or audit history; the new organisation grants access through a separate membership | P0 |
| FR-P1-037 | Cities/territories are catalogue data referenced by places, services, and simulator flows; activating an additional city automatically surfaces it in public city filters and as a simulator city question, without code changes | P1 |
| FR-P1-038 | The simulator asks where the person is (city area), when they need help, and who the information is for; results open with a summary of the given answers, then reviewed guidance and ranked recommendations in a dedicated card format with visible reasons, distinct from service-list cards, and can be downloaded as a PDF generated on the device; answers and the PDF never leave the device (extends FR-P1-020) | P0 |
| FR-P1-039 | An authorised editor can generate print-ready flyers (card and poster formats) from a service, organisation profile, or basic-information page — with QR code, short URL, selected languages, and the record's verification date — and each flyer is simultaneously published as a public downloadable PDF, so physical and digital versions stay identical | P1 |
| FR-P1-040 | An organisation can publish several service offerings with separate names, descriptions, places, audiences, schedules, statuses, contacts, and freshness dates. Each offering lists its own verified included features with an icon and visible label. The product never copies the organisation's combined feature list onto each offering | P0 |

### 10.4 Simulator privacy rule

Questions involving nationality, country of origin, passport possession, health, administrative status, travel intentions, or similarly sensitive context are not automatically approved launch content. Each question requires a documented purpose, content owner, source, optional/skip behavior, privacy review, and evidence that the same essential information remains accessible without answering. No such answer is persisted in Phase 1.

### 10.5 Primary journeys

#### Journey P1-A — Find a service available today

1. Visitor opens the product in a selected/detected language.
2. Visitor searches a location, association, or need and may choose a grouped autocomplete suggestion.
3. Visitor selects the relevant audience label when needed.
4. Results prioritize current/reliable occurrences and distance when location permission is granted.
5. Each result shows status, next time, place, audience, provider logos/names, and last verification.
6. Visitor opens details and chooses directions, a safe contact method, or schedule.
7. Any outdated, cancelled, or uncertain condition explains why and what to do next.

#### Journey P1-B — Use the information simulator

1. Visitor sees the flow purpose, source, review date, privacy explanation, and disclaimer.
2. The product asks one optional question at a time.
3. Visitor may answer, skip, go back, or restart.
4. The result presents reviewed information and referrals, not a decision.
5. Answers disappear when the session ends or the visitor restarts.

#### Journey P1-C — Find an association by speciality

1. Visitor filters the directory by a verified need/speciality.
2. Results show name, purpose, primary and selected secondary specialities, languages, location, and last verification.
3. The profile groups verified service offerings by activity and place. Each offering shows its own schedule, audience, status, safe contact, and icon-labelled included features.
4. No speciality is inferred from an organisation's name, reputation, or logo.

#### Journey P1-D — Publish an association-owned article

1. Platform operator verifies/selects the organisation and sends a narrow invitation.
2. Representative accepts credentials, privacy notice, and publishing responsibilities.
3. Representative creates/translates an owned article and completes source/freshness fields.
4. Representative previews translation, fallback, and outdated states.
5. Authorised publisher publishes; the revision and audit event record responsibility.

### 10.6 Required screens

| ID | Screen | Priority |
| --- | --- | --- |
| P1-01 | Public home and basic information | P0 |
| P1-02 | Service finder search/autocomplete, audience filters, list, and map | P0 |
| P1-03 | Service detail | P0 |
| P1-04 | Article list and article detail | P0 |
| P1-05 | Simulator intro, question, and result | P0 |
| P1-06 | Fixed-information index and page | P0 |
| P1-07 | Association directory | P0 |
| P1-08 | Association profile | P0 |
| P1-09 | Language selector and fallback states | P0 |
| P1-10 | Printable/low-bandwidth view | P0 |
| P1-11 | Association publisher invitation, acceptance, and sign-in | P0 |
| P1-12 | Minimal article editor, media, AI-translation provenance, joint-approval notes/state, preview, and publication history | P0 |
| P1-13 | Downloads index/detail | P1 |

### 10.7 Phase 1 exit criteria

- Public map/list, articles, simulator, fixed/basic information, association directory, and downloads are usable on mobile without an account.
- The core Phase 1 public journeys are available and tested on responsive web, a supported Android build, and a supported iOS build.
- A visitor can reach relevant service or reviewed information within two minutes in pilot testing.
- Search autocomplete returns grouped location, association, and need suggestions in the selected language and works without location permission.
- Every published service/event has one audience category and at least one verified provider with approved logo and visible text name.
- An organisation profile can show several service offerings, and each offering exposes only its own verified icon-labelled features in search, detail, and profile views.
- Every public record has factual ownership, source/review metadata, freshness state, and translation state where applicable.
- Loading, empty, error, offline, no-geolocation, no-results, permission-denied, cancelled, uncertain, outdated, and missing-translation states are tested.
- Simulator results are traceable to reviewed rules/sources without persistent answers.
- An invited publisher can publish an owned article without accessing another organisation or Phase 2/3/4 features.
- A platform editor can proxy-publish with recorded association approval and factual ownership.
- A joint-publication pilot proves that the public projection hides pending parties and their structured content, records notes, and activates a party only after its valid approval of the sealed revision.
- At least one complete Latin LTR journey and one Arabic RTL journey pass accessibility review.
- Representative priority information is successfully understood and acted on in pilot testing by people with limited literacy without requiring them to read the long-form body.
- Reviewed audio is available for the priority launch content/languages approved in Phase 0, and audio/video controls, captions/transcripts, bandwidth fallback, and no-autoplay behavior pass testing.
- Article images/video pass rights, alt-text, caption/transcript, poster, processing, and low-bandwidth checks; AI-assisted text displays its source/target-language notice.
- Every prototype/fixture is fictional and visibly labelled **Demo data — do not publish**.

### 10.8 Not in Phase 1

- Public organisation signup or self-initiated organisation requests.
- Complete organisation settings, profile claiming, broad member administration, or custom-role builders.
- Ordinary member invitations, teams, availability, shifts, missions, or notifications.
- Persistent simulator answers or public-user profiles.
- Inventory, payroll, general HR, assistance records, or beneficiary registration.

## 11. Phase 2 — Association onboarding and publishing

### 11.1 Objective

Allow verified organisations to manage their public profiles and content in isolated workspaces while retaining Phase 1 identities, URLs, articles, translations, ownership, and revision history.

### 11.2 Functional requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-P2-001 | Organisation onboarding is platform-initiated after identity and duplicate/impersonation checks; no public signup exists | P0 |
| FR-P2-002 | A Phase 1 publishing organisation is upgraded in place without new organisation/user identities or content re-import | P0 |
| FR-P2-003 | The first organisation administrator accepts an expiring invitation, credentials, terms, publishing responsibilities, and privacy notice | P0 |
| FR-P2-004 | Every private record is scoped to one organisation unless explicitly platform-owned | P0 |
| FR-P2-005 | The workspace always identifies the current organisation and active role | P0 |
| FR-P2-006 | An authorised administrator can maintain public purpose, verified locations, safe contacts, service languages, accessibility information, website, logo rights, freshness, and speciality-change requests | P0 |
| FR-P2-007 | An organisation can store multiple verified specialities, order them, and mark at most one primary; changes retain verification state and effective history | P0 |
| FR-P2-008 | Editors can maintain places, services, schedules, exceptions, events, articles, contacts, downloads, and permitted simulator content | P0 |
| FR-P2-009 | Editors can preview the exact public language, fallback, freshness, status, and ownership state before publishing | P0 |
| FR-P2-010 | Urgent cancellation publishing supports an approved visible translation fallback policy | P0 |
| FR-P2-011 | Organisation administrators manage Phase 2 users, invitations, roles, and permission review without granting Phase 3 access implicitly | P0 |
| FR-P2-012 | Translators/reviewers can access only assigned languages/content and verification actions | P0 |
| FR-P2-013 | The platform can moderate duplicate/conflicting content, suspend publishing, and preserve audit history | P0 |
| FR-P2-014 | Organisation departure supports custody handover, unpublishing/archive, access revocation, and configured retention without rewriting historical ownership or audit records | P0 |
| FR-P2-015 | Authorised users may manage public/workspace tags with translated labels, color, display order, visibility, and active state | P1 |
| FR-P2-016 | Tags supplement and never replace verified specialities, service categories, lifecycle states, or permissions | P1 |
| FR-P2-017 | Organisations may propose joint/shared public records; the sealed-revision approval, approval-driven public projection, notes, and reapproval rules from Phase 1 apply to every supported content type | P0 |
| FR-P2-018 | An organisation administrator may propose additions, removals, reordering, or a new primary speciality; additions and changed claims require platform reverification, while removal can take effect at once with audit history | P0 |
| FR-P2-019 | Only an authorised organisation or platform administrator may initiate article-custody transfer; an organisation destination must accept before transfer, and platform custody requires platform acceptance | P0 |
| FR-P2-020 | Article-custody transfer preserves the URL, revisions, approvals, factual-owner history, and audit trail; it changes administrative control only, and any new factual-owner attribution follows the publication-approval workflow | P0 |
| FR-P2-021 | The publishing workspace, administration dashboard, approval workflow, and system email templates are available in French and English with a saved user preference | P0 |
| FR-P2-022 | Organisation editors can generate the same print-ready flyers for their own services, events, and profile from the workspace; the platform stores each generated flyer as a public downloadable PDF so the physical and digital versions never diverge | P1 |
| FR-P2-023 | The workspace includes a shared agenda of coordination events; each event is hosted by one organisation (or the platform), carries a city, and is either organisation-scoped or inter-organisation — visible to authenticated members of all verified organisations; coordination events are never public | P0 |
| FR-P2-024 | Coordination events support one-off and recurring schedules (such as a daily inter-association briefing), concrete occurrences, safe location and contact details, and cancellation or changes with a visible reason | P0 |
| FR-P2-025 | Authorised members create and edit coordination events under an explicit coordination permission; organisations can indicate participation (attending, interested, declined) visible to the other participants | P1 |

### 11.3 Primary journeys

#### Journey P2-A — Onboard an organisation

1. Platform operator verifies the organisation and checks duplicates/impersonation.
2. Operator creates or upgrades the organisation record.
3. Operator invites the first administrator.
4. Administrator accepts terms/responsibilities and reviews/claims the public profile.
5. Existing Phase 1 content and users remain intact.
6. Administrator invites permitted editors/reviewers and publishes the first full-workspace update.

#### Journey P2-B — Publish an exceptional closure

1. Editor opens the service/event and its next occurrences.
2. Editor adds affected occurrences, effective dates, public reason, and translation/fallback state.
3. Editor previews the exact public result.
4. Authorised editor publishes.
5. Public list/map updates and an audit/revision event is created.

#### Journey P2-C — Transfer article custody

1. A source-organisation admin or platform admin selects the article and destination.
2. The admin reviews current custody, factual owners, public attribution, active approvals, and the effect of transfer.
3. The destination organisation admin receives an expiring request and accepts or declines; a platform destination requires a platform admin to accept.
4. Acceptance starts the new custodianship without changing historical revisions, ownership, attribution, or audit events.
5. The previous custodian loses edit control after the transfer unless another role grants access.

### 11.4 Required screens

| ID | Screen | Priority |
| --- | --- | --- |
| P2-01 | Platform verification and organisation invitation | P0 |
| P2-02 | Duplicate/impersonation approval review | P0 |
| P2-03 | Workspace overview and review queue | P0 |
| P2-04 | Public profile, speciality, and tag editor | P0 |
| P2-05 | Places/services table and record inspector | P0 |
| P2-06 | Schedule and exception editor | P0 |
| P2-07 | Article editor, translation review, and joint-publication approval | P0 |
| P2-08 | Simulator-content editor/review | P1 |
| P2-09 | Files/downloads manager | P1 |
| P2-10 | Roles and invitations | P0 |
| P2-11 | Audit log and revision history | P0 |
| P2-12 | Article-custody transfer requests and history | P0 |
| P2-13 | Shared inter-organisation agenda (calendar/list) and coordination-event editor | P0 |

### 11.5 Phase 2 exit criteria

- At least two verified pilot organisations manage their public profiles and listings.
- Every workspace originates from a platform-issued invitation and recorded verification/duplicate review.
- Tenant isolation and role permissions pass security testing.
- An authorised editor can publish a cancellation in under one minute in usability testing.
- Every public change is attributable and reversible.
- Speciality and service taxonomies remain controlled and verified; tags cannot override them.
- Speciality changes preserve prior verified history and keep unverified additions out of the public profile.
- Review reminders and workspace queues reduce outdated pilot listings against the Phase 1 baseline.
- Moderation handles conflicts, suspension, duplicate organisations, and organisation departure.
- Joint/shared publication hides an organisation, logo, attribution, and linked structured claim until that organisation approves the active sealed bundle; approval activates them without an author revision change.
- Custody transfer requires destination acceptance, preserves history, and does not turn the destination or platform into a factual owner.
- Pilot administrators complete publishing and organisation-management tasks in both French and English.
- Pilot organisations host and find at least one recurring inter-organisation event (for example a daily coordination briefing) in the shared agenda, with participation states and a tested cancellation-with-reason.

### 11.6 Not in Phase 2

- Operational teams, member availability, shifts, missions, or internal team-meeting scheduling; the shared inter-organisation agenda above is in scope, while member-level scheduling arrives in Phase 3.
- Participation-document signing, payroll, contracts administration, performance management, or general HR.
- Inventory and kit distribution.
- Assistance records or cross-organisation person matching.

## 12. Phase 3 — Team management

### 12.1 Objective

Allow verified organisations to coordinate staff, volunteers, and interns and complete approved participation-document workflows without exposing operational or document data publicly.

### 12.2 Functional requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-P3-001 | Coordinators/admins can invite, resend, revoke, activate, deactivate, and offboard staff, volunteers, and interns | P0 |
| FR-P3-002 | One global user may belong to multiple organisations concurrently or sequentially; permissions and offboarding remain organisation-specific | P0 |
| FR-P3-003 | Membership history supports multiple engagement periods/types without overwriting previous volunteer/staff/intern history | P0 |
| FR-P3-004 | Members maintain only permitted profile, spoken-language, skill, driving-permit, completed-training, qualification, and availability fields after the interface explains the purpose, visibility, requirement status, and retention of each field | P0 |
| FR-P3-005 | Accommodation, emergency contact, absence reason, and document information remain outside ordinary member lists and planning boards | P0 |
| FR-P3-006 | Authorised users can create teams, assign members/leads, apply workspace tags, and preserve membership history | P0 |
| FR-P3-007 | Members submit recurring and one-off available, preferred, unavailable, or uncertain time | P0 |
| FR-P3-008 | Staff can submit absence requests; volunteer/intern unavailability uses participation-appropriate wording and workflow | P0 |
| FR-P3-009 | Coordinators use a day/week staffing board with member rows and filters for team, lead, member, role, skill, language, tag, and state | P0 |
| FR-P3-010 | Planning distinguishes availability, absence, assignment, conflict, limited access, missing coverage, and qualification requirements with text/icon/color | P0 |
| FR-P3-011 | Coordinators create recurring shifts, meetings, missions, and training and assign members whose declared/verified qualifications match required criteria | P0 |
| FR-P3-012 | Members accept, decline, or request assignment changes and see a mobile personal agenda | P0 |
| FR-P3-013 | Missions show time, place, team, coordinator, instructions, permitted contacts, and required/preferred skills, spoken languages, driving-permit categories, and completed training/courses | P0 |
| FR-P3-014 | Notifications support invitations, reminders, changes, and cancellations without sensitive information in previews | P0 |
| FR-P3-015 | Operational changes linked to a public service/event prompt an authorised editor to review public status; they do not silently publish member/availability data | P0 |
| FR-P3-016 | Document administrators maintain organisation-approved, versioned participation-document templates | P0 |
| FR-P3-017 | A document is prepared from a locked template version and reviewed before sending | P0 |
| FR-P3-018 | Signing supports internal/external signers, explicit order, review, decline, expiry, reminders, and mobile/desktop completion | P0 |
| FR-P3-019 | Document state supports draft, ready for review, awaiting signature, partially signed, signed, declined, expired, and cancelled | P0 |
| FR-P3-020 | Final signed copy, template version, timestamps, provider evidence, integrity data, retention, access, and signature history are auditable | P0 |
| FR-P3-021 | Team membership, coordination, organisation administration, and publishing do not automatically grant restricted-document access | P0 |
| FR-P3-022 | Members can retrieve documents sent to them and completed copies they are permitted to receive | P0 |
| FR-P3-023 | Organisations maintain a training/course catalogue with title, provider, link, description, validity period, active state, and optional verification requirement | P0 |
| FR-P3-024 | Members select spoken languages and proficiency, driving-permit categories/status, and completed training/courses; each declaration records whether it is self-declared, awaiting verification, verified, rejected, or expired | P0 |
| FR-P3-025 | The product does not request a driving-permit number or scan by default; an organisation needs a documented purpose, restricted access, and retention rule before collecting evidence | P0 |
| FR-P3-026 | Mission requirements distinguish required from preferred criteria, include minimum language proficiency and permit category where relevant, and explain each match or gap to coordinators and members | P0 |
| FR-P3-027 | A missing preferred criterion does not block assignment; a coordinator must record an authorised override reason before assigning someone who lacks a required verified criterion | P0 |
| FR-P3-028 | Coordinators can import `.ics` and approved `.csv` agenda files through preview, timezone selection, field mapping, duplicate detection, row-level errors, idempotent commit, and batch undo | P0 |
| FR-P3-029 | Members' personal agendas and coordinator boards show the coordination events (Phase 2 shared agenda) their organisation participates in, alongside internal shifts, missions, and meetings, without exposing internal operational data to other organisations | P1 |

### 12.3 Primary journeys

#### Journey P3-A — Invite and onboard a member

1. Coordinator selects the organisation, member type, role, and optional team.
2. Person receives an expiring invitation and accepts credentials/privacy notice.
3. Person sees why each operational field is requested, who can see it, whether it is required, and how long the organisation keeps it.
4. Person selects spoken languages, driving-permit status/categories, completed courses, skills, and availability they choose or need for their role.
5. Coordinator verifies qualifications when required.
6. Document administrator sends any required approved participation documents.
7. Person sees their teams, agenda, missions, notifications, and document tasks.

#### Journey P3-B — Plan a week

1. Coordinator opens a weekly member-row/day-column board.
2. Coordinator filters the board and reviews availability, absences, requirements, assignments, conflicts, and gaps.
3. Coordinator creates/adjusts shifts or missions and proposes assignments.
4. Members accept, decline, or request change.
5. Coordinator resolves remaining gaps.
6. Linked public events/services are reviewed if operational delivery changes.

#### Journey P3-C — Import an agenda

1. Coordinator uploads an `.ics` or approved `.csv` file.
2. The import preview shows timezone, mapped fields, duplicates, unsupported recurrence, and row errors without creating events.
3. Coordinator fixes mappings, selects the records to import, and confirms.
4. The product creates one idempotent import batch and reports created, skipped, and failed rows.
5. An authorised coordinator can undo the batch without deleting unrelated or later-edited events.

#### Journey P3-D — Handle a last-minute cancellation

1. Member declines or coordinator cancels an assignment/occurrence.
2. Coverage warning identifies the affected operational and public records.
3. Coordinator reassigns or cancels the private activity.
4. An authorised editor reviews and explicitly publishes any public status change.
5. Safe notifications and audit events are recorded.

#### Journey P3-E — Sign a participation document

1. Authorised document administrator selects the member and approved template version.
2. System fills permitted fields and identifies missing information.
3. Administrator reviews the generated document, signer list/order, expiry, and retention rule.
4. Signers securely review the exact version and sign or decline.
5. Ordinary coordinators see only permitted task/status information, not the document body.
6. Permitted parties retrieve the final copy; evidence, hashes, timestamps, access, and actions remain auditable.

### 12.4 Required screens

| ID | Screen | Priority |
| --- | --- | --- |
| P3-01 | Team-management overview | P0 |
| P3-02 | Members and invitation states | P0 |
| P3-03 | Member operational profile | P0 |
| P3-04 | Team list and team detail | P0 |
| P3-05 | Availability calendar/form | P0 |
| P3-06 | Weekly coverage planner | P0 |
| P3-07 | Shift/event editor | P0 |
| P3-08 | Mission detail and assignment | P0 |
| P3-09 | Member schedule/mobile agenda | P0 |
| P3-10 | Notifications and preferences | P0 |
| P3-11 | Roles, permissions, and permission review | P0 |
| P3-12 | Team audit history | P0 |
| P3-13 | Restricted document centre and signature queue | P0 |
| P3-14 | Template-based preparation, review, and signing | P0 |
| P3-15 | Training/course catalogue and member qualifications | P0 |
| P3-16 | Agenda import preview, results, and undo | P0 |

### 12.5 Phase 3 exit criteria

- Pilot organisations safely onboard/offboard members and preserve organisation-specific access/history.
- Coordinators plan coverage and assignments without a separate spreadsheet for the agreed pilot workflow.
- Members update availability and see/respond to assignments on mobile.
- Members understand why languages, training, skills, and driving-permit status are requested and can review their declarations and verification state.
- Mission assignment enforces required criteria, preserves preferred criteria as guidance, and audits overrides.
- Pilot coordinators import representative `.ics` and `.csv` agendas without duplicate events and can undo an import batch.
- Coordinators distinguish availability, absence, assignment, conflict, and coverage states without opening every profile.
- Pilot organisations complete and audit at least one approved volunteer-agreement and one internship-document workflow.
- Document access, authentication, integrity evidence, reminders, cancellation, retention, offboarding, and audit behavior pass security/policy review.
- Publishing, coordination, restricted documents, inventory, and possible future assistance permissions remain separated.
- Last-minute changes reliably trigger public-information review when necessary.

### 12.6 Not in Phase 3

- Payroll, payslips, time-clock/payroll calculations, recruitment, performance reviews, or general HR management.
- General-purpose contract drafting or legal approval of templates.
- Inventory or financial administration.
- Assistance records, beneficiary registration, or cross-organisation person identifiers.
- Public team membership, availability, private instructions, or document information.

## 13. Phase 4 — Inventory management

### 13.1 Objective

Allow verified organisations to track physical resources across storage locations, events, missions, kits, and transfers without creating recipient profiles or exposing restricted financial data.

### 13.2 Functional requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-P4-001 | Inventory administrators create organisation-scoped storage locations with status, address/internal directions, responsible team, and access notes | P0 |
| FR-P4-002 | Organisations maintain item categories, items, variants, units of measure, barcodes/QR identifiers, active state, and translated labels where needed | P0 |
| FR-P4-003 | Items may use lot/batch, expiry, condition, and serial tracking according to a configured tracking policy rather than one rule for every item | P0 |
| FR-P4-004 | Posted stock uses an append-only movement ledger; the product calculates balances by organisation, location, item/variant, lot, condition, and reservation state | P0 |
| FR-P4-005 | Movement types include receipt, donation, purchase, positive/negative adjustment, damage, expiry, internal transfer, cross-organisation transfer, reservation, release, kit assembly/disassembly, and distribution | P0 |
| FR-P4-006 | Receipts may record donor/supplier reference, quantity, unit, lot/expiry, source document, and restricted cost/replacement-value fields | P0 |
| FR-P4-007 | Internal transfers record dispatch and receipt between locations and report in-transit, partially received, completed, cancelled, and discrepancy states | P0 |
| FR-P4-008 | A cross-organisation transfer exposes only the offered items and transfer logistics to the destination; a destination inventory admin must accept before receiving stock | P0 |
| FR-P4-009 | Authorised users reserve stock for a public event, private mission, or kit batch and release unused quantities without changing the source event or mission | P0 |
| FR-P4-010 | Versioned kit definitions specify component item/variant, quantity, unit, substitutions, and effective dates; assembly and disassembly create linked stock movements | P0 |
| FR-P4-011 | Distribution records default to anonymous aggregate quantity by item/kit, date, location, and optional linked event; recipient identity is neither required nor stored | P0 |
| FR-P4-012 | Per-location/item thresholds and expiry windows create low-stock, out-of-stock, expiry-soon, and expired alerts with acknowledgement state | P0 |
| FR-P4-013 | Users correct posted mistakes with compensating movements and a reason; they cannot overwrite or delete ledger history | P0 |
| FR-P4-014 | Inventory manager, stock operator, inventory viewer, transfer approver, and financial viewer permissions remain separate from publishing, member, document, and assistance permissions | P0 |
| FR-P4-015 | Audit history records movement actor, reason, source/target, item, quantity/unit, linked batch, import/transfer reference, and timestamps without exposing restricted cost to ordinary inventory viewers | P0 |
| FR-P4-016 | Mobile inventory supports item/location search and camera barcode/QR scanning with a manual entry fallback | P1 |
| FR-P4-017 | Inventory admins can import approved `.csv` item/balance data through field mapping, unit validation, duplicate detection, preview, idempotent commit, row errors, and compensating batch reversal | P1 |
| FR-P4-018 | Inventory changes linked to a public service/event or private mission may create an operational/public review task but never publish stock counts or change service status automatically | P0 |
| FR-P4-019 | Organisation departure exports or transfers inventory records under an approved policy while preserving ledger/audit history and revoking access | P0 |
| FR-P4-020 | Inventory dashboards and workflows use the authenticated French/English interface and the user's saved language preference | P0 |

### 13.3 Primary journeys

#### Journey P4-A — Receive and distribute stock

1. A stock operator selects the receiving location and scans or searches for an item.
2. The operator records quantity/unit, source, condition, and lot/expiry when the item policy requires them.
3. The product previews the resulting movements and new calculated balance before posting.
4. A later anonymous distribution records item/kit quantities and an optional event without recipient identity.
5. The ledger retains both movements and updates thresholds/expiry alerts.

#### Journey P4-B — Transfer stock to another organisation

1. A source inventory admin creates an offer with items, quantities, source location, destination organisation, logistics, and expiry.
2. A destination inventory admin accepts, declines, or adds a transfer note.
3. Acceptance reserves the offered stock; dispatch moves it into transit.
4. The destination records received quantities and discrepancies.
5. Both organisations see the shared transfer record and their own ledger entries without gaining access to the other workspace.

### 13.4 Required screens

| ID | Screen | Priority |
| --- | --- | --- |
| P4-01 | Inventory overview, alerts, and recent movements | P0 |
| P4-02 | Storage locations | P0 |
| P4-03 | Item/category/variant catalogue | P0 |
| P4-04 | Item balance, lots, expiry, and movement history | P0 |
| P4-05 | Receive, adjust, damage, expire, and distribute stock | P0 |
| P4-06 | Internal transfer dispatch/receipt | P0 |
| P4-07 | Cross-organisation transfer offers and acceptance | P0 |
| P4-08 | Reservations linked to events/missions | P0 |
| P4-09 | Kit definitions and assembly/disassembly | P0 |
| P4-10 | Low-stock and expiry alerts | P0 |
| P4-11 | Barcode/QR scan and manual fallback | P1 |
| P4-12 | Inventory CSV import preview/results/reversal | P1 |

### 13.5 Phase 4 exit criteria

- Pilot organisations reconcile calculated balances against a physical count for the agreed locations/items.
- Stock operators receive, transfer, reserve, release, assemble, distribute, damage, expire, and correct stock without editing posted history.
- A cross-organisation transfer requires destination acceptance and preserves isolation between workspaces.
- Anonymous distribution works without recipient identity, account, or assistance record.
- Low-stock and expiry alerts identify pilot shortages and expiring lots within the configured windows.
- Restricted cost fields, inventory permissions, exports, import reversal, and ledger audit pass security and operational review.
- Pilot administrators complete inventory workflows in French and English.

### 13.6 Not in Phase 4

- Beneficiary profiles, named distribution histories, household records, or eligibility decisions.
- Full procurement, invoicing, accounts payable, general ledger, budgeting, or donor CRM.
- Payroll, HR, vehicle fleet, or warehouse robotics management.
- Public display of stock quantities unless a later approved public-information requirement defines a safe use.

## 14. Shared content, status, and governance requirements

### 14.1 Ownership and freshness

- Every public record has at least one factual owner and a responsible publishing actor.
- Time-sensitive content has last-reviewed/verified metadata and a review/expiry or unreliable-from rule.
- A platform proxy publisher records the submitting/approving representative, approval date, sources, and factual owner.
- Unpublishing/archive does not erase required revision/audit history.
- Public information never becomes platform-owned merely because a platform editor entered it.

### 14.2 Required public states

| Domain | Required states |
| --- | --- |
| Service/event | Open, closed, cancelled, information uncertain |
| Freshness | Current, review soon, outdated, no review data/uncertain |
| Translation | Human verified, draft, machine generated/needs review, missing with explicit fallback |
| Media | Processing, ready, unavailable, loading, playing, paused, completed, error/retry; transcript/caption review is visible to editors |
| Organisation approval | Requested, viewed, changes requested, approved, declined, expired, cancelled, invalidated by revision change |
| Publication | Draft, in review, published, unpublished, archived |
| Invitation | Pending, accepted, expired, revoked |
| Member | Invited, active, inactive, offboarded |
| Assignment | Proposed, accepted, declined, change requested, cancelled |
| Coordination event | Scheduled, changed, cancelled (with visible reason); participation: attending, interested, declined |
| Document | Draft, ready for review, awaiting signature, partially signed, signed, declined, expired, cancelled |
| System | Loading, empty, success, error, offline, permission denied |

Status meaning always uses visible text and an icon/state treatment; color is never the sole signal.

### 14.3 Specialities and tags

- Specialities are controlled, verified public classifications.
- An organisation may have any number of verified specialities and at most one marked primary. Marking a primary is optional: many organisations provide several services with equal weight (water and food, shower and laundry, mental and physical care, shoes and clothes, charging and social games), and they mark none.
- The initial public card displays the primary and up to four selected secondary specialities, or up to five co-equal specialities when no primary is marked; this is a presentation rule, not a storage limit.
- An organisation admin may request additions, reordering, removal, or a new primary speciality. The public profile shows only effective verified assignments.
- New or changed claims require platform reverification. Removal can take effect at once, while history records the previous assignment, actor, reason, and effective dates.
- Tags are flexible labels with namespace, translated label, color, display order, visibility, and active state.
- Global/platform tags and organisation-scoped tags are distinct.
- Tags may label organisations, services, events, editorial content, files, members, teams, or private calendar events when permitted.
- Member/workspace tags require a documented operational purpose and must not encode sensitive characteristics, secret notes, or access rights.
- Tags cannot grant access, replace a verified speciality/service category, or encode a lifecycle status.

### 14.4 Joint and shared publication

- A record may have one or several factual-owner/publisher organisations.
- Every organisation displayed as a joint publisher/co-owner must approve the exact immutable revision through a secure link sent to a verified representative email address.
- The approval screen shows the complete revision, translations/media covered, public attribution, sources, freshness dates, and every proposed organisation before approval.
- Email is the notification and identity-verification channel; the approval is recorded inside the product rather than inferred from an ordinary email reply.
- Approval records include organisation, representative/member, verified email, revision/hash, decision, timestamp, and audit event.
- Each request has a revision-linked discussion. The representative and requester can add notes; email and in-app notifications direct recipients to the secure thread without copying unpublished content into a preview.
- A material edit to text, translation, media, sources, dates, claims, or public attribution creates a new revision and invalidates prior approval for the changed revision.
- The sealed revision marks each organisation logo, attribution row, and organisation-specific content block with that organisation's ID.
- The public projection includes only organisations with a valid approval. Pending, changes-requested, declined, expired, cancelled, and unanswered parties and their marked blocks stay hidden.
- A later approval creates and activates a new immutable public projection that adds that organisation's logo, attribution, and marked blocks without creating a new authored revision.
- Free text that names or makes a claim about an unapproved organisation blocks incremental publication until the editor converts it to an organisation-bound block or removes it from the sealed revision.
- A joint record may go public after at least one proposed organisation approves, provided the projected public content contains no unapproved organisation or claim.
- Platform proxy publication does not replace any concerned organisation's required approval.

Joint-publication workflow:

1. Editor selects the proposed organisations and prepares a complete revision.
2. System sends each organisation's verified representative a secure, expiring email approval link.
3. Each representative reviews the exact revision, exchanges notes or requests changes, and approves or declines.
4. Editor sees per-organisation state and may reply or send reminders.
5. After the first valid approval, the system may publish the approval-filtered projection.
6. Each later approval regenerates the immutable public projection and adds that organisation's linked content automatically.
7. A material authoring change creates a new sealed revision and starts the required approval cycle again.

### 14.5 Article custody, publisher departure, and transfer

- An article has one active administrative custodian: an organisation or the platform. Factual ownership and public publisher attribution remain revision-specific and separate.
- A person's authorship does not grant permanent access. When a Phase 1 publisher leaves or changes organisation, offboarding ends the old membership and permissions while preserving authored revisions and audit identity.
- The new organisation must invite or activate the person under a separate membership. The move does not transfer any article.
- A source-organisation admin or platform admin may initiate custody transfer to another organisation or the platform. Individual editors cannot initiate or accept it.
- A destination organisation admin must accept an expiring transfer request before custody changes. A platform admin accepts a transfer to platform custody.
- Transfer preserves the article ID, URL, revisions, sources, approvals, public history, and audit events. The previous custodian loses edit control after completion unless another permission grants access.
- Platform custody provides administrative continuity when an owner leaves the platform. It does not make the platform a factual owner or approve claims on another organisation's behalf.
- Adding the destination as a factual owner or public publisher changes attribution and follows the joint-publication approval rules.

## 15. Roles and access control

| Role | Default capability boundary |
| --- | --- |
| Platform operator | Organisation verification, shared taxonomy/moderation, suspension, platform audit |
| Platform editor | Platform public content and recorded proxy publication |
| Association author | Owned article draft/translation only unless additional permission is granted |
| Association reviewer/publisher | Approved owned article review/publication and revision-specific approval of joint content for their organisation |
| Organisation administrator | Organisation configuration, permitted users/roles, public profile, audit; no automatic document reading |
| Editor | Explicitly permitted public content types and languages |
| Translator/reviewer | Assigned content/languages and verification only |
| Coordinator | Teams, availability, shifts, missions, meetings, and operational overview |
| Document administrator/signatory | Approved templates, document workflow, permitted signed files/evidence, and document audit |
| Inventory manager/operator | Permitted locations, catalogues, movements, reservations, kits, transfers, alerts, and inventory audit; restricted cost requires a separate permission |
| Transfer approver | Accept or decline custody/stock transfers for the destination organisation without broader edit access |
| Staff/volunteer/intern | Own permitted profile/availability, teams, assignments, guidance, and documents sent to them |
| Viewer/auditor | Read-only access to explicitly selected records/reports |

Access-control rules:

- Permissions are organisation-scoped and explicit; job titles alone are insufficient.
- One global account may hold different memberships/roles in several organisations.
- Revoking one membership does not affect another organisation.
- Team membership does not grant publishing, inventory, document, or future assistance access.
- Inter-organisation coordination events are visible to every active member of a verified organisation; creating or editing them requires an explicit coordination permission; they are never public.
- Inventory access must never imply assistance access.
- Sensitive permissions are reviewed regularly and revoked promptly during offboarding.
- Article-custody transfer requires admin initiation and destination-admin acceptance.
- Sensitive administrative actions, document access, and posted inventory movements are logged.

## 16. Experience, accessibility, and localization requirements

### Operating conditions

Design for:

- 320–430px portrait phones, tablet, and desktop.
- Responsive web browsers plus Android and iOS devices supported by the approved Expo release baseline.
- Slow, intermittent, or expensive mobile data.
- Bright outdoor light and one-handed use.
- Stress, interrupted attention, and varying digital literacy.
- People who are unable or unwilling to read long passages and need short, spoken, or visual guidance.
- Long translated strings and right-to-left layout.
- Public information that may become stale within hours.
- Editors, coordinators, and stock operators working on laptop and mobile in field conditions.

The reliable fallback is a usable text list/page, not an unloaded map, blank skeleton, or QR code.

### Required acceptance

- WCAG 2.2 AA text and component contrast.
- Keyboard operation and visible focus.
- Minimum 44×44px public touch targets.
- 200% zoom without loss of content/function.
- No horizontal page scrolling at 320px for public journeys.
- At least 50% text expansion in labels/cards without losing essential information.
- Arabic RTL behavior for at least the service finder, service detail, and simulator before Phase 1 launch.
- Logical layout properties and mirrored directional navigation where appropriate.
- Language names use their own names/scripts, never flags.
- Missing translations produce an explicit fallback notice.
- Machine-generated translations are never presented as human verified.
- AI-assisted translations show a localized source-language, target-language, and AI-use notice near the translated content.
- Priority pages expose an obvious listen control before long-form text; audio/video never autoplays.
- Audio has a transcript; video has captions and, where meaningful visual information is not spoken, an equivalent description.
- Media controls are keyboard/screen-reader accessible and show duration and expected download/streaming size where relevant.
- Critical status/freshness information is not delayed by animation.
- `prefers-reduced-motion` is respected.

### Voice

- Direct, respectful, concrete, and non-judgmental.
- State what is known, what is uncertain, and what the person can do next.
- Do not promise availability, eligibility, safety, legal outcomes, or document validity beyond verified evidence.

## 17. Localization requirements

- The public interface and content model support a configured catalogue of 15 languages.
- Authenticated publishing, approval, administration, team, and inventory interfaces support French and English at launch and store each user's preference.
- French, English, Arabic, Pashto, and Dari are expected candidates; the authoritative 15-language list and fallback order remain `TBD` until approved.
- Navigation, categories, statuses, simulator flows, fixed/basic information, association metadata, contacts, and download metadata use the same configurable catalogue.
- Language selection persists for the browser session without requiring an account.
- Publication rules define which content/languages block publication and which urgent updates may use an explicit fallback.
- A configured language goes public only when a named person owns its review; the catalogue may hold 15 languages, but each activated language is an operational commitment, not a configuration flag.
- Translation records keep source language, target language, method (`human`, `ai`, or `ai_then_human_review`), provider job reference, and verification state. Public AI-use notices remain visible after human review.
- Public schedules use Europe/Paris as the local timezone and localized, unambiguous date/time formatting.

## 18. Privacy, safety, and data requirements

### Data minimisation

- Do not require identity, account, country, passport, or simulator answers to access essential public information.
- Do not collect sex, country, emergency contacts, accommodation needs, health, administrative status, or travel intentions without a documented specific purpose and appropriate review.
- Selecting a public service audience filter does not ask the visitor to declare sex or age, create a profile, or persist the selection beyond the public search session.
- Avoid unrestricted free-text fields for sensitive contexts.
- People should be able to receive ordinary public information and assistance without registration whenever identification is unnecessary.

### Identity and organisation membership

- Use random UUIDs internally and non-semantic human references when needed.
- Never construct an identifier from birth date, initials, sex, country, or registration date.
- Login identity is global; organisation membership and engagement periods are separate.
- A user may keep personal and organisation email addresses under the same account.
- Email uniqueness protects login identity; it does not limit multi-organisation membership.
- Offboarding one membership revokes that organisation's permissions without moving content custody or changing the person's other memberships.

### Member operational qualifications

- Before collecting a spoken language, skill, training/course, or driving-permit status, the interface states the purpose, who can see it, whether the organisation requires it, and the retention rule.
- Members can correct their declarations and see verification/expiry state. A coordinator sees only fields permitted for planning and mission matching.
- The default driving-permit record stores status and category, not the licence number or a scan.

### Inventory

- Distribution records use anonymous quantities unless a future approved assistance-record scope establishes a separate justified identity need.
- Financial values use a separate permission and do not affect access to public services or assistance.
- Inventory notes cannot contain beneficiary case details or unrestricted personal data.

### Simulator

- No persistent answer, identity linkage, analytics profile, or assistance record is created.
- URLs, logs, error reporting, and notifications must not contain answers.
- Any future answer persistence is a new scope requiring this PRD, lawful-basis, retention, access, and privacy-review updates.

### Restricted documents

- Signed files/evidence are stored separately from public downloads and ordinary member profiles.
- Notifications never attach documents or reveal sensitive contents/titles in previews.
- Electronic-signature level, identity checks, wording, retention, and evidential requirements are approved for each document type.
- The interface does not claim that every electronic-signature workflow has identical legal effect.

### Possible assistance records

Before any implementation, participating organisations must agree in writing on ownership, lawful basis, access, sharing, retention/deletion, correction/export, authority requests, incident response, and organisation departure. Complete an AIPD/DPIA and specialist review before high-risk processing.

## 19. Security and non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-001 | Host production data in the European Union unless an approved governance decision states otherwise |
| NFR-002 | Encrypt traffic in transit and production data/backups at rest |
| NFR-003 | Use strong authentication, secure account recovery, session revocation, and expiring single-use invitation/recovery tokens |
| NFR-004 | Enforce organisation isolation in application authorization and database controls; test cross-tenant access |
| NFR-005 | Use separate public and authenticated API/read surfaces |
| NFR-006 | Log administrative actions, publication changes, permission changes, and restricted-document access without logging sensitive contents |
| NFR-007 | Define retention/deletion rules for every personal/restricted data category before production collection |
| NFR-008 | Maintain encrypted backups and a tested restore procedure; recovery objectives remain `TBD` |
| NFR-009 | Maintain an incident-response/data-breach procedure and responsible owner before pilot launch |
| NFR-010 | Do not place sensitive information or simulator answers in analytics, URLs, notifications, application logs, or error reports |
| NFR-011 | Preserve public low-bandwidth/list access when maps, geolocation, or nonessential scripts fail |
| NFR-012 | Validate and sanitize uploaded files and structured editorial content; scan uploads before public availability |
| NFR-013 | Make notification delivery and signature-provider webhooks idempotent and auditable |
| NFR-014 | Establish measurable performance budgets for responsive web, Android, and iOS before engineering sign-off; target values remain `TBD` |
| NFR-015 | Test permission, offline, localization, accessibility, long-text, empty, error, and destructive-action states before each phase exits |
| NFR-016 | Build Android and iOS clients with React Native and Expo; share validated domain/API logic with the React web client where practical while preserving platform-native navigation, accessibility, safe areas, and permission behavior |
| NFR-017 | Optimize public audio/video for constrained mobile data, support cancellation/retry and an explicit low-bandwidth mode, and never make media loading block the text/icon route to essential information |
| NFR-018 | Joint-publication approval links are expiring and single-use, store only hashed tokens, expose the sealed revision only to an authorised verified representative, and never include unpublished content in the email body or analytics |
| NFR-019 | French and English authenticated UI strings, validation, notifications, email templates, dates, numbers, and units pass localization testing; public content keeps its separate 15-language rules |
| NFR-020 | AI translation jobs send only approved public/editorial text to an approved provider, store provenance and source revision/hash, and keep provider secrets and private member/document/inventory data out of prompts |
| NFR-021 | Search autocomplete returns grouped suggestions within the approved performance budget, protects raw queries from analytics profiling, and preserves a local/list fallback when a geocoder or map provider fails |
| NFR-022 | Approval-state changes regenerate public projections idempotently and retain each immutable projection, approved-party set, actor, and timestamp for rollback/audit |
| NFR-023 | Inventory posting, import, transfer, kit, reservation, and reversal operations are transactional, idempotent where retried, unit-safe, and covered by balance-invariant tests |

The proposed implementation foundation is React for responsive web, React Native with Expo for Android/iOS, PostgreSQL with Drizzle ORM, translation-aware normalized content, organisation-scoped authorization, immutable publication revisions/projections, an append-only inventory ledger, private object storage for files, and a transactional outbox for notifications. Hosting provider, authentication provider, translation provider, signature provider, performance budgets, supported OS/device baselines, backup recovery objectives, and exact retention periods remain implementation decisions requiring approval.

## 20. Success measures and pilot evaluation

| Outcome | Measure | Target/state |
| --- | --- | --- |
| Discoverability | Time for a pilot visitor to reach a relevant service or reviewed information path | Under two minutes |
| Search coverage | Location, association, and launch-need queries returning a relevant grouped autocomplete suggestion | Target `TBD` before Phase 1 pilot |
| Client coverage | Core Phase 1 journeys pass acceptance on responsive web, supported Android, and supported iOS | Required for Phase 1 exit |
| Accessibility | Complete public journeys passing keyboard, zoom, mobile, contrast, LTR, and RTL review | Required for Phase 1 exit |
| Low-literacy access | People with limited literacy can understand priority information and reach the next action using summary, icons, audio, or video without reading the long-form body | Required for Phase 1 exit; quantitative pilot target `TBD` |
| Freshness | Percentage of active public records within their review interval | Baseline in Phase 0; target `TBD` before pilot |
| Correction speed | Time for an authorised editor to publish an exceptional cancellation | Under one minute by Phase 2 exit |
| Association adoption | Verified pilot organisations managing their public profiles/listings | At least two by Phase 2 exit |
| Simulator safety | Stored/linked answer records | Zero in Phase 1 |
| Translation quality | Public records with required verified translations or explicit fallback | Target `TBD` by content type before launch |
| Spreadsheet reduction | Pilot coordination workflow performed without a separate planning spreadsheet | Required by Phase 3 exit |
| Member usability | Members updating availability and responding to assignments on mobile | Required by Phase 3 exit |
| Document workflow | Approved volunteer and internship workflows completed and audited | At least one of each by Phase 3 exit |
| Operational fit | Reasons users return to WhatsApp, spreadsheets, email, websites, or paper | Measured every pilot; used to prioritize iteration |
| Data minimisation | Unjustified personal fields or persisted simulator answers | Zero |
| Joint attribution integrity | Public records displaying an organisation without its valid revision-specific approval | Zero |
| Provider integrity | Published service/events without a verified provider logo and text name | Zero |
| Agenda import | Duplicate events caused by retrying the same import batch | Zero in Phase 3 pilot |
| Qualification transparency | Members who can explain why mission-matching fields are requested and who can see them | Target `TBD` before Phase 3 pilot |
| Inventory reconciliation | Difference between calculated and agreed physical-count balances after investigated discrepancies | Target `TBD` before Phase 4 pilot |
| Awareness | Aggregate, cookieless channel measures: sessions by channel code and share of non-French sessions | Targets set at the G1 soft launch (see `DISTRIBUTION.md`) |
| Editorial cost | Editor-minutes per public record per month | Baseline from Slice 1; target `TBD` |

Run every phase as a controlled pilot, measure outcomes and failure reasons, resolve governance/usability issues, and update this PRD before expanding scope.

## 21. Later extension — not committed scope

### Assistance records

Assistance records may be proposed only after governance approval. Any initial record should be minimal, organisation-owned, purpose-limited, randomly identified, and separately protected. Cross-organisation linking is a governance decision, not a default feature.

Before any implementation, a steering group must exist: representatives of participating associations, a field worker or mediator, a data-protection specialist, and ideally a representative of the people who use the services. It approves what is collected and why, each organisation's legal responsibility, access rules, sharing between organisations, retention and deletion, subject access/correction/export procedures, responses to requests from authorities, incident and breach procedures, and organisation entry and exit.

If ever approved, the minimum initial record is: a random non-semantic person reference; assistance requested; assistance provided; date and responsible organisation; referral and follow-up status. Not collected initially: travel intentions, detailed administrative status, health information (unless strictly required and separately protected), unrestricted free-text notes, or anything without a defined operational purpose. Refusing registration must never prevent someone from receiving ordinary assistance or public information when identification is unnecessary.

## 22. Explicit exclusions across all committed phases

- Public organisation signup.
- Asylum-seeker registration or a shared person registry.
- Persistent public-visitor or simulator-answer profiles.
- Eligibility scoring or automated legal decisions.
- Payroll, payslips, time-clock calculation, recruitment, performance management, or general HR.
- General-purpose contract drafting or legal approval of templates.
- Procurement accounting, invoicing, general ledger, budgeting, or donor CRM beyond Phase 4 inventory scope.
- Assistance/case records before governance and a new approved phase.
- Public exposure of members, availability, missions, internal instructions, documents, or sensitive contacts.
- Advanced analytics dashboards without a defined operational decision.

## 23. Confirmed product decisions

- Delivery is sequential: public information, association workspaces, team management, then inventory management.
- The initial product includes responsive web built with React and Android/iOS applications built with React Native and Expo.
- Public essential information requires no account.
- The public finder is list-first with an optional map.
- Public search autocompletes locations, organisation names, and needs; service/event filters include the six confirmed audience-category codes (all public, women only, children only, under 18 only, families only, adult men only).
- Launch service types are field-confirmed (17–18 July 2026): there are separate services for breakfast, lunch, tea/coffee, drinking water, shower, shoes, tents, asylum information, games, outdoors, artistic activity, SIM cards, and contacting your family (free calls/messages home). Distinct distributions stay distinct service records; categories and need concepts group them without merging them.
- Some organisations provide several of these services with equal weight — water and food; shower and washing your clothes; mental and physical care; shoes and clothes; charging and social games. Marking a primary speciality is therefore optional, and a profile with no primary presents its verified specialities as co-equal.
- A closed service or occurrence always shows its next opening time.
- The platform is designed for later reuse in other territories ("global, but starting with Calais"); Calais remains the only committed deployment through Phase 4, and territory-specific facts stay configuration/content rather than code.
- Cities are catalogue data: places, services, and simulator flows reference a city record, and activating a new city surfaces it automatically in public filters and as a simulator city question.
- The simulator result is a personalised, session-only experience: current-location, timing, and audience questions; a summary of the given answers; ranked recommendation cards (with visible reasons) distinct from service-list cards; and a downloadable PDF generated on the device.
- Open services show a live "open now" indicator with a subtle pulse; the pulse is decorative, never the sole signal, and stops under reduced-motion preferences.
- Responsive web (installable as a PWA) and the React Native + Expo Android/iOS applications are co-equal first-class public surfaces, built together from the first slice out of one shared codebase; neither waits for the other. The simulator is likewise first-class Phase 1 scope: its engine is built in Slice 0 and its launch flows are reviewed with organisations before public launch.
- Editors can turn public records into print-ready flyers (card and poster formats) with QR code, short URL, and verification date; every flyer is simultaneously published as a downloadable PDF, so each physical material has an identical digital version.
- Organisations share an authenticated, city-scoped inter-organisation agenda from Phase 2: coordination events (such as a daily inter-association briefing) are hosted by one organisation, marked organisation-scoped or inter-organisation, support recurrence and participation states, and are never public.
- Every published service/event names at least one verified provider and shows each provider's approved logo with its text name.
- There is no public organisation signup; all organisation access begins with platform verification/invitation.
- Association ownership/users/content upgrade across phases without re-creation.
- Public content requires owner, source/review, freshness, translation, revision, and audit behavior.
- Joint/shared content publishes an approval-filtered projection; pending organisations and their structured content stay hidden and appear automatically after revision-specific approval through the verified email workflow.
- Approval requests include a secure revision-linked note thread between representatives and the requester.
- Articles support accessible images/video and display AI source/target-language provenance whenever AI contributed to a translation.
- Essential information is short and multimodal: priority content provides an actionable summary and reviewed audio, with optional video and accessible text alternatives.
- Simulator answers are optional and session-only and do not create eligibility decisions.
- An organisation may have many specialities, at most one primary, and a configurable subset shown on summary cards.
- Organisation admins can change speciality assignments through a verified, effective-dated workflow.
- Tags support flexible organisation/global labelling but never replace taxonomies, statuses, or permissions.
- One global user may have several emails and organisation memberships; each membership has isolated roles and engagement history.
- Changing organisation revokes old membership access but does not move articles. Admin-only custody transfer requires destination acceptance and preserves historical factual ownership.
- Public events and private operational events remain separate even when linked.
- Authenticated publishing, administration, team, and inventory surfaces launch in French and English.
- Restricted participation documents are in Phase 3; payroll/general HR are not.
- Phase 3 supports member-declared spoken languages, training/course completion, driving-permit categories, mission requirements, and `.ics`/approved `.csv` agenda import with purpose explanations.
- Phase 4 commits movement-ledger inventory with anonymous distribution by default and restricted financial fields.
- Assistance records are not part of Phases 1–4.

## 24. Open decisions and launch blockers

### Phase 1 product/content decisions

- `TBD` — Authoritative 15 languages and fallback order.
- `TBD` — Final grouping, translations, and synonyms for the field-confirmed launch service types (Section 23), plus fixed-information and basic-information topics.
- `TBD` — Provider-approved definitions and translated explanations that distinguish `children only` from `under 18 only`, the eligibility wording for `families only`, plus age-boundary rules for every restricted audience label.
- `TBD` — Search synonym catalogue, geocoding/address provider, autocomplete performance budget, and handling of locations outside the maintained place catalogue.
- `TBD` — Approved speciality taxonomy/icon set and verification owner.
- `TBD` — Safe public contact methods and publication rules.
- `TBD` — Definition of “information uncertain” and precedence over schedule-derived open/closed state.
- `TBD` — Review intervals and roles allowed to confirm freshness for each content type.
- `TBD` — Geolocation request policy: only after user action or another approved behavior.
- `TBD` — Content required in print/low-bandwidth mode.
- `TBD` — Priority content and languages that require human-reviewed audio/video at launch, who records/approves it, and the maximum summary/reading length before progressive disclosure.
- `TBD` — Association author-only versus direct-publisher policy.
- `TBD` — Approval evidence required for proxy publication.
- `TBD` — Which roles may approve joint content, approval-link expiry/reminders, note retention, projection activation timing, and which changes require a new sealed revision.
- `TBD` — AI translation provider, approved content types, source/target notice wording in each public language, human-review rules, and provider-data retention.
- `TBD` — Translation requirements that block publication and urgent fallback policy.
- `TBD` — Approved simulator launch flows/questions; sensitive contextual examples are not approved by default.

### Governance and operations decisions

- `TBD` — Platform operator and legal responsibility by data category.
- `TBD` — Organisation verification process and evidence retention.
- `TBD` — Data retention/deletion schedule and organisation departure process.
- `TBD` — Data-subject access/correction/export/deletion procedure.
- `TBD` — Procedure for requests from police, immigration authorities, or courts.
- `TBD` — Incident-response owner and breach-notification workflow.
- `TBD` — Permission-review frequency.
- `TBD` — Coordination-agenda policy: which roles may host inter-organisation events, notification rules, moderation of the shared agenda, and retention of past events.
- `TBD` — Article custody-transfer expiry, destination acceptance evidence, platform-custody operating policy, and handling when the source organisation has no active admin.
- `TBD` — Phase 3 driving-permit categories, language proficiency scale, training verification/evidence policy, and permitted override roles.
- `TBD` — Phase 4 units, item tracking policies, cost access, physical-count/reconciliation procedure, cross-organisation transfer terms, and inventory retention/export rules.

### Technical/service-provider decisions

- `TBD` — PostgreSQL hosting provider and infrastructure ownership.
- `TBD` — Authentication and email/SMS providers.
- `TBD` — Object storage, media processing, and malware-scanning providers.
- `TBD` — AI translation provider and contractual/no-training/data-retention terms.
- `TBD` — Signature provider, document types, signature levels, identity verification, and retention.
- `TBD` — Backup recovery point/recovery time objectives.
- `TBD` — Public performance budgets and uptime/support expectations.
- `TBD` — Minimum supported Android/iOS versions, device baseline, Expo release/update policy, and app-store ownership.

An open decision blocks launch only when it affects the relevant phase's safety, correctness, legal responsibility, accessibility, or acceptance criteria. The product owner records the decision here and updates derived specifications.

## 25. Supporting artifacts

| File | Purpose |
| --- | --- |
| `PHASE-1-PUBLIC-INFORMATION.md` | Phase 1 elaboration |
| `PHASE-2-ASSOCIATION-ONBOARDING.md` | Phase 2 elaboration |
| `PHASE-3-TEAM-MANAGEMENT.md` | Phase 3 elaboration |
| `PHASE-4-INVENTORY-MANAGEMENT.md` | Phase 4 elaboration |
| `DESIGN-BRIEF.md` | Priority journeys, screen requirements, prototype and state guidance |
| `DESIGN.md` | Visual system, components, responsive behavior, accessibility, and voice |
| `DATABASE-SCHEMA.md` | Proposed PostgreSQL/Drizzle data model |
| `OPEN-DESIGN.md` | Open Design runbook for generating design artifacts |
| `RISKS.md` | Risk register: adoption, continuity, safety of public data, legal exposure, AI-drift |
| `SUSTAINABILITY.md` | Operating model, responsibility ladder, cost model, funding, continuity/exit plan |
| `LANDSCAPE.md` | Existing information actors, gap analysis, partner-first positioning |
| `DISTRIBUTION.md` | Awareness plan: intermediary-first waves, share-first design, privacy-safe measurement |
| `prototype/index.html` | Interactive HTML prototype (public pages, workspace home, simulator, FR/EN/AR, light/dark) — design reference with fictional demo data; frozen, not product code |
| `ENGINEERING-NOTES.md` | Proven engineering patterns adopted from the operator's prior monorepos (EP-next, kawa-web): monorepo blueprint, tokens, i18n pipeline, migration discipline, quality gates, AGENTS.md, warts to avoid |

## 26. References

- [W3C — Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/)
- [CNIL — Sensitive data](https://www.cnil.fr/en/node/84950)
- [CNIL — Data Protection Impact Assessment](https://www.cnil.fr/en/node/84909)
- [CNIL — GDPR points of vigilance](https://www.cnil.fr/fr/rgpd-points-de-vigilance)
