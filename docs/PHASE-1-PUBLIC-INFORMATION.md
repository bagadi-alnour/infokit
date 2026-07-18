# Phase 1 — Public Information

> This document elaborates Phase 1. `PRODUCT.md` is the canonical product requirements document and takes precedence if scope or terminology differs.

## Objective

Launch a useful public product before asking associations to adopt an internal workspace. Anyone should be able to find clear, current, multilingual information without creating an account or providing identity information.

Phase 1 is successful when a person can answer:

- What help is available?
- Where is it?
- Is it available now?
- Which association provides it?
- How recently was the information verified?
- Which reviewed information applies to the answers I choose to provide?

## Users

- People seeking services or practical information in Calais.
- People who cannot read confidently or prefer short spoken/visual information over long text.
- Interpreters, mediators, volunteers, and field workers helping someone find information.
- A small platform editorial team that verifies and maintains Phase 1 content.
- Designated association authors/publishers invited by the platform to maintain their association's articles.

Associations appear in the public directory during Phase 1. A platform editor may publish on their behalf, and a verified association may also receive minimal invitation-only access to create and publish its own articles. This does not constitute the full Phase 2 workspace.

## Public Navigation

1. **Map & services** — places, schedules, status, directions, and service filters.
2. **Articles** — dated, reviewed, multilingual editorial information.
3. **Information simulator** — anonymous questions that produce personalized information paths.
4. **Fixed information** — stable reference pages such as orientation, rights, procedures, transport, and safety guidance.
5. **Basic information** — urgent essentials such as food, water, healthcare, day services, emergency help, and charging.
6. **Associations** — a directory showing what each organisation specializes in.
7. **Language** — a persistent language selector available from every public screen.

On small screens, combine lower-priority destinations under **More**, but keep Map, Basic information, Simulator, and Language immediately reachable.

## Capabilities

### 1. Map and service finder

- List-first service finder with an optional map view.
- One search field with multilingual, typo-tolerant, grouped autocomplete for locations/addresses/landmarks, association names, and needs such as clothes, shoes, tents, water, SIM cards, calling family, and device charging.
- Launch service types (field-confirmed 17–18 July 2026): there are separate services for breakfast, lunch, tea/coffee, drinking water, shower, shoes, tents, asylum information, games, outdoors, artistic activity, SIM cards, and contacting your family (free calls/messages home). Each distribution or session is its own service record with its own schedule and status; categories and need concepts group them without merging them.
- One organisation may publish several service offerings at the same place or at different places. Each offering keeps its own name, description, category, audience, schedule, status, contact, and freshness metadata.
- Each offering may list any number of verified included features, such as laundry, shower, phone charging, social assistance, mental-health support, food, drinking water, a welcome kit, or nursing care. Each feature uses a controlled icon and visible translated label.
- Clickable places with address or directions, service category, audience, schedule, status, included-feature list, every provider's approved logo and text name, safe contact details, and last-verified time.
- Filters for service type, audience, open now, day, language, and accessibility information when verified.
- One required audience category per service/event: all public, women only, children only, under 18 only, families only, or adult men only, plus translated provider eligibility detail and exact age limits where relevant.
- At least one verified providing association per published service/event; cards, details, and map results pair each approved logo with its organisation name.
- Statuses: open, closed, cancelled, and information uncertain; a closed service always shows its next opening time, and open services show a live indicator with a subtle pulse (disabled under reduced-motion preferences).
- Recurring schedules, exceptional openings/closures, and French public-holiday behavior.
- Low-bandwidth list and printable fallback; the map is never the only route to information.

### 2. Articles

- Public articles with title, summary, structured body, cover/inline images, video, language, publisher, owner, source, last-updated date, and review state.
- Lead with a short plain-language summary, key facts, primary action, and visible listen option; long-form detail is secondary.
- No essential outcome may depend on reading the complete long-form article.
- Priority articles provide reviewed localized audio and may provide video, with accessible controls, captions/transcripts, duration/file-size metadata, no autoplay, and a low-bandwidth alternative.
- Images require rights confirmation and localized alt text/equivalent description. Video requires a poster/thumbnail, captions/transcript policy, and low-bandwidth fallback.
- AI-assisted translations display a localized note naming the source and target languages and stating that AI translated the text; human-review state appears separately.
- Freshness question: **Could this information become outdated?**
- When yes, show a reliability date and a public warning from that date.
- Related services, associations, fixed information, and downloads.
- Print and low-bandwidth presentation for important articles.
- Two supported publishing paths:
  - **Association publishing:** an invited, authorised association representative creates and publishes articles owned by their association.
  - **Proxy publishing:** a platform editor enters and publishes information supplied and approved by the responsible association.
- **Joint publication:** a record may display multiple organisations only after each concerned organisation approves the exact revision through a secure link sent to a verified representative email.
- If approval is partial, the public projection hides each non-approving organisation and its structured logo/attribution/content blocks. A later approval activates that organisation's blocks automatically without changing the authored revision.
- Free-text claims about a pending organisation block incremental publication until the editor converts them to an organisation-bound block or changes the sealed revision.
- Representatives and requesters can exchange revision-linked notes and request changes; notifications link back to the secure thread.
- Material changes invalidate the affected revision approvals and require a new approval cycle.
- Both paths use the same ownership, approval, translation, freshness, revision, and audit requirements.

### 3. Information simulator

The simulator asks short branching questions and assembles a personalized information result. It is an information-navigation tool, not a legal assessment or eligibility calculator.

- One question per screen.
- A city question appears automatically when more than one city is active; the city catalogue (cities and their public areas) is data, not code.
- Optional questions cover current location (city area), timing, and who the information is for.
- Results open with a summary of the given answers, then reviewed guidance and ranked recommendations in a dedicated recommendation-card format with visible reasons, distinct from service-list cards.
- The complete result can be downloaded as a PDF generated on the device; answers and the PDF never leave the device.
- Simple answers such as Yes, No, a translated list choice, and Prefer not to say.
- Skip, Back, Start again, and direct access to essential information.
- Results composed from reviewed content blocks, relevant associations, contacts, and next steps.
- Every rule and result has an owner, source, last-reviewed date, and review/expiry date.
- Answers stay in the current browser session and are not attached to identity, an association account, analytics, or an assistance record.
- No answer is required to access fixed or basic information.
- Result copy must say that it provides information, not a decision or legal advice.

### 4. Fixed information

Fixed information is stable reference content that changes less frequently than news or service schedules. Examples include:

- How to orient yourself in Calais.
- General descriptions of available service types.
- How to use emergency numbers.
- General rights and safety information reviewed by an appropriate specialist.
- Transport and administrative-process explanations.

“Fixed” does not mean permanent. Every page still needs an owner, source, last-reviewed date, and review interval.

### 5. Basic information

Basic information is the fastest route to urgent and frequently needed help:

- Emergency help.
- Food and drinking water.
- Healthcare.
- Shelter or day services where verified information exists.
- Clothing and showers.
- Device charging.
- Legal help.
- Safety and orientation.

Use large icon-and-label tiles, short summaries, and direct links to matching map results. Do not require the simulator first.

Priority basic information also provides a visible listen option. Icons support recognition but never appear without a text label or spoken equivalent.

### 6. Association directory and speciality icons

Each public association profile includes:

- Name and approved logo where permission exists.
- Short purpose statement.
- Any number of verified specialities, with at most one optional primary. Organisations that provide several services with equal weight (water and food, shower and laundry, mental and physical care) mark no primary, and the card shows up to five co-equal specialities; otherwise it shows the primary plus up to four secondary specialities.
- Speciality icons with visible text labels.
- Locations, schedules, supported languages, accessibility information, safe contact methods, website, and last-verified date.
- Service offerings grouped by activity and place. Each offering shows its own status, audience, next opening, short description, and icon-labelled included features.
- Related articles and downloads.

Icons describe services, not the association's brand. Use one consistent open-source outline icon set, such as Lucide, and pair every icon with text.

Organisation specialities provide a compact directory summary. Included features describe one service offering. The profile must not merge every feature offered by an organisation into one flat list or imply that a feature is available during another activity.

| Speciality | Suggested icon name | Example label |
| --- | --- | --- |
| Medical care | `Stethoscope` | Medical care |
| Medication | `Pill` | Medication |
| Doctors/clinical consultation | `UserRoundPlus` | Doctors |
| Mental-health support | `Brain` | Mental-health support |
| Food | `UtensilsCrossed` | Food |
| Drinking water | `Droplets` | Drinking water |
| Clothing | `Shirt` | Clothing |
| Showers/hygiene | `ShowerHead` | Showers & hygiene |
| Device charging | `BatteryCharging` | Device charging |
| Legal assistance | `Scale` | Legal assistance |
| Information/orientation | `CircleHelp` | Information |
| Shelter/day services | `House` | Shelter & day services |
| Transport | `Bus` | Transport |
| Translation/mediation | `Languages` | Translation & mediation |

Illustrative example only: an approved MSF directory record could display **Medical care** (`Stethoscope`), **Medication** (`Pill`), and **Doctors** (`UserRoundPlus`) if MSF confirms those services for the listed Calais location. Do not infer or publish a real association's services without verification.

### Service-offering example

The following MFS example comes from the product brief and defines the required content structure. An editor must verify the organisation name, programme details, schedule, and availability before publication.

| Service offering | Primary category | Included features shown with icons |
| --- | --- | --- |
| Accueil de jour | Day services | Laundry or clothes cleaning (`WashingMachine`), shower (`ShowerHead`), phone charging (`BatteryCharging`), social assistance (`UsersRound`), mental-health support (`Brain`), food (`UtensilsCrossed`), drinking water (`Droplets`), welcome kit (`PackageOpen`) |
| Nurse-led health activity | Healthcare | Nursing care (`Bandage`), dressing changes (`Bandage`), basic pain-relief support (`Pill`), treatment of minor health issues (`Stethoscope`) |

These rows are two service records. They may use the same provider and place, but each record retains its own description, schedule, audience, status, and included-feature assignments. The day-centre features do not appear on the nurse-led activity unless the provider confirms that they are available during that activity.

## Invitation-only Association Publishing

Phase 1 includes the minimum account workflow needed for associations to publish their own articles:

1. A platform operator verifies or creates the association record.
2. The operator sends an expiring invitation to a designated representative.
3. The representative accepts the invitation, creates credentials, and reviews publishing responsibilities.
4. The representative receives only the association author/publisher permissions approved for Phase 1.
5. The representative creates, translates, previews, and publishes articles owned by that association.
6. Every action is versioned and audited.

If the publisher changes organisation, offboarding removes access to the former organisation without moving its articles. The new organisation grants a separate membership. Historical revisions, factual ownership, public attribution, URLs, and audit events remain unchanged.

There is no public organisation signup, self-initiated organisation request, or automatic workspace creation. The platform controls which organisations are invited. A Phase 1 invite does not grant member administration, team management, organisation settings, or access to another organisation.

## Content Operations

During Phase 1, content is managed through a restricted publishing tool shared by platform editors and invited association publishers according to their permissions. It must support:

- Create, edit, preview, publish, unpublish, and archive.
- Translation and verification state.
- Content owner, source, last-reviewed date, and review/expiry date.
- Service status and schedule exceptions.
- Association records and speciality taxonomy.
- Simulator questions, branches, results, and source metadata.
- Audit history for important public changes.
- Organisation-scoped article access for invited association publishers.
- Platform proxy publication with recorded association approval.
- Per-organisation joint-publication requests, secure email approval links, notes, changes-requested/reminder/expiry/decline/invalidated states, approval-filtered public projections, and revision-specific audit evidence.

This publishing capability is intentionally narrower than the Phase 2 association workspace. Phase 2 retains the same organisation IDs, user identities, articles, URLs, translations, and revision history while adding full profile control, additional publishing content types, administration, and broader roles.

## Required Screens

| ID | Screen |
| --- | --- |
| P1-01 | Public home/basic information |
| P1-02 | Service autocomplete, audience filters, list/map |
| P1-03 | Service detail |
| P1-04 | Article list and article detail |
| P1-05 | Information simulator intro/question/result |
| P1-06 | Fixed-information index and page |
| P1-07 | Association directory |
| P1-08 | Association profile with speciality icons |
| P1-09 | Language selector and translation-fallback states |
| P1-10 | Printable/low-bandwidth view |
| P1-11 | Association invitation acceptance and publisher sign-in |
| P1-12 | Minimal association article editor, media, AI provenance, joint-approval notes/projection, preview, and publication history |
| P1-13 | Downloads index and detail |

## Safety and Accessibility

- No account is required.
- No persistent personal profile or stored simulator answers.
- Do not collect identity, contact details, country of origin, or passport status merely to show essential information.
- A simulator question may ask for contextual information only when optional, purposeful, and documented.
- Support the configured 15-language catalogue, visible fallback states, and Arabic RTL.
- Meet WCAG 2.2 AA, 44×44px touch targets, keyboard navigation, and 200% zoom.
- Design for limited literacy: short summaries and key actions precede detail, priority content has reviewed audio, and audio/video never autoplays.
- Status and speciality use icon, label, and color together.
- Label prototype content **Demo data — do not publish**.

## Phase 1 Exit Criteria

- Map/list, articles, simulator, fixed information, basic information, and association directory are usable on mobile.
- A person can reach matching service information within two minutes without an account.
- Autocomplete groups relevant location, association, and need suggestions in the selected language without requiring location permission.
- Each service/event shows one audience category and at least one verified provider logo plus text name.
- Association profiles group separate service offerings, and search/detail/profile views show only the verified features assigned to the selected offering.
- Every public record has ownership, source, freshness, and translation metadata.
- Uncertain, outdated, cancelled, offline, missing-translation, and no-results states are designed and tested.
- The simulator produces traceable results from reviewed rules without storing answers.
- Association specialities use an agreed icon taxonomy and verified labels.
- An invited association publisher can publish an owned article without accessing another organisation or Phase 2/3/4 features.
- A platform editor can publish the same type of article on behalf of an association with recorded approval and factual ownership.
- Joint publication hides a pending organisation and its structured blocks, then adds them automatically when that organisation approves the exact sealed revision.
- At least one LTR and one RTL public journey pass accessibility review.
- People with limited literacy can understand and act on representative priority content without reading the long-form page.
- Required launch audio/video, captions/transcripts, media controls, and low-bandwidth behavior pass review in the approved languages.

## Not in Phase 1

- Public organisation signup or self-initiated organisation account requests.
- Full organisation settings, profile claiming, member administration, or broad custom-role management.
- Invitations for ordinary organisation members, operational roles, or teams; Phase 1 invitations are limited to designated article publishers.
- Volunteer availability, shifts, missions, or notifications.
- Inventory, HR, assistance records, or beneficiary registration.
