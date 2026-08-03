# InfoKit — Airtable-Inspired Design System

> `PRODUCT.md` is the canonical product requirements document. This file defines the supporting visual and interaction system.

> Category: Civic & Nonprofit
> A calm, multilingual service-information product built with the structured clarity of Open Design's bundled Airtable system.

This is the visual contract for InfoKit. Use Open Design's bundled `airtable` design system as the source system, then apply the product-specific rules below. Where the two differ, this file takes precedence.

The public service and the organisation workspace share tokens and components, but not density. Public pages must remain calm, mobile-first, and understandable under stress. Authenticated workspace pages may use denser tables, toolbars, and split views.

## 1. Brand & Visual Direction

### Brand promise

InfoKit helps a person answer two questions quickly: **Where can I get help?** and **Can I rely on this information today?** It also helps associations publish and maintain that information without exposing their internal data.

### Personality

- **Dignity:** calm and non-judgmental about needs, organisations, nationalities, routes, and legal situations.
- **Reliability:** practical about sources, check dates, current status, and uncertainty.
- **Accessibility:** clear across supported devices, connection conditions, languages, reading directions, and literacy levels.
- **Collaboration:** structured enough for associations to work together without making public pages feel like spreadsheets.
- **Responsibility:** explicit about who published, approved, corrected, or owns information.

### Visual signature

- White canvas, deep navy text, and Airtable Blue for the primary action.
- Thin neutral borders, soft blue-tinted shadows, and 12–24px corner radii.
- Clearly grouped records, status chips, compact metadata, and strong alignment.
- One obvious action per region; secondary actions remain quiet.
- Public pages favor large touch targets and generous spacing. Workspace pages use compact, scan-friendly rows.

### Logo guidance

Until a logo is designed, use the text wordmark **InfoKit** with a simple four-cell mark suggesting places, languages, and coordinated services. Do not imitate Airtable's logo or use its proprietary assets.

## 2. Color Palette & Roles

Use semantic tokens rather than raw color values in components.

| Token                         | Value     | Role                                     |
| ----------------------------- | --------- | ---------------------------------------- |
| `--color-canvas`              | `#F4F8FA` | Main page background                     |
| `--color-surface`             | `#FFFFFF` | Cards, panels, dialogs                   |
| `--color-surface-subtle`      | `#EAF1F4` | Secondary regions, table headers         |
| `--color-ink`                 | `#142A35` | Primary text                             |
| `--color-text-muted`          | `#536B76` | Secondary text and metadata              |
| `--color-border`              | `#D2DFE4` | Default borders and dividers             |
| `--color-border-strong`       | `#9FB5BE` | Selected or emphasized boundaries        |
| `--color-accent`              | `#245F8F` | Primary actions, links, focus indicators |
| `--color-accent-hover`        | `#1B4B72` | Hover/pressed primary action             |
| `--color-accent-soft`         | `#DFEDF7` | Selected rows and informational surfaces |
| `--color-success`             | `#267254` | Open, confirmed, complete                |
| `--color-success-soft`        | `#E3F2EB` | Success background                       |
| `--color-warning`             | `#8A5B12` | Uncertain, review soon                   |
| `--color-warning-soft`        | `#F9ECCE` | Warning background                       |
| `--color-danger`              | `#A53E49` | Cancelled, destructive actions, errors   |
| `--color-danger-soft`         | `#F8E5E7` | Danger background                        |
| `--color-neutral-status`      | `#586D77` | Closed or inactive                       |
| `--color-neutral-status-soft` | `#E7EEF1` | Neutral status background                |

### Service-category accents

Service categories may use restrained accent colors for icons, map pins, and tags. Every category must also have a unique icon and visible text label; color is never the only identifier.

| Category            | Accent    |
| ------------------- | --------- |
| Food                | `#D97706` |
| Drinking water      | `#1677A8` |
| Clothing            | `#7C5CC4` |
| Showers             | `#167C80` |
| Device charging     | `#B25E09` |
| Healthcare          | `#C13F5A` |
| Legal assistance    | `#4867B1` |
| General information | `#52606D` |

### Color rules

- Reserve `--color-accent` for primary actions, links, selected controls, and focus states.
- Status meaning must use an icon, label, and color together.
- Meet WCAG 2.2 AA contrast for text and interactive components.
- Never place body text directly on a category accent.
- Do not introduce gradients, neon colors, or decorative color washes.

## 3. Typography

Use a Haas-like neutral grotesk without requiring a proprietary font:

```css
font-family:
  Inter,
  "Helvetica Neue",
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

If licensed Haas files are available in the Open Design package, they may replace `Inter` without changing metrics or hierarchy.

| Role             | Desktop | Mobile | Weight | Line height |
| ---------------- | ------- | ------ | ------ | ----------- |
| Display          | 48px    | 36px   | 700    | 1.08        |
| Page title       | 36px    | 30px   | 650    | 1.15        |
| Section title    | 28px    | 24px   | 650    | 1.2         |
| Card title       | 20px    | 18px   | 600    | 1.3         |
| Body large       | 18px    | 18px   | 400    | 1.5         |
| Body             | 16px    | 16px   | 400    | 1.5         |
| Label/button     | 14px    | 15px   | 600    | 1.3         |
| Caption/metadata | 13px    | 14px   | 500    | 1.4         |

### Typography rules

- Use sentence case for headings, buttons, tabs, and table columns.
- Body copy on public pages must not be smaller than 16px.
- Keep public reading lines between 45 and 75 characters.
- Use tabular numerals for schedules, dates, counts, and audit data.
- Use modest positive tracking only for Latin-script labels and captions.
- Disable letter spacing for Arabic and other scripts where tracking harms legibility.
- Support text expansion of at least 50% without clipping or truncating essential information.
- Never encode hierarchy using size alone; pair it with weight, position, or grouping.

## 4. Spacing & Sizing

Use an 8px base grid with 4px available for compact internal spacing.

| Token       | Value | Typical use                 |
| ----------- | ----- | --------------------------- |
| `--space-1` | 4px   | Icon gaps, compact metadata |
| `--space-2` | 8px   | Inline gaps, chip padding   |
| `--space-3` | 12px  | Compact control padding     |
| `--space-4` | 16px  | Card padding on mobile      |
| `--space-5` | 24px  | Card padding on desktop     |
| `--space-6` | 32px  | Section spacing             |
| `--space-7` | 48px  | Major section separation    |
| `--space-8` | 64px  | Public page vertical rhythm |

### Sizing rules

- Minimum public touch target: 44×44px; prefer 48×48px for primary controls.
- Default control height: 44px public, 36px workspace, 40px workspace forms.
- Buttons use 12px radius. Cards use 16px radius. Large feature panels use 24px radius.
- Use 1px borders. Shadows are subtle and never carry hierarchy by themselves.
- Icon sizes: 16px compact, 20px default, 24px public actions, 32px feature icons.

## 5. Layout & Responsive Behavior

### Breakpoints

- Small: below 640px.
- Medium: 640–1023px.
- Large: 1024px and above.
- Wide workspace: 1440px and above.

### Public layout

- Design mobile-first at 390px, then verify at 320px, 768px, and 1440px.
- Use a single column on small screens and a maximum content width of 1200px.
- Reading content uses a 720px maximum width.
- The service finder begins with a list; the map is an optional view, not a dependency.
- On large screens, list and map may form a 5/7 split view.
- Keep language selection visible in the header and reachable within one tap.
- Place the most urgent status, opening time, and directions above the fold.

### Android and iOS applications

- Implement the mobile applications with React Native and Expo while preserving the same information architecture, content ownership, freshness, translation, and privacy behavior as responsive web.
- Respect platform safe areas, native back behavior, keyboard avoidance, system text scaling, screen-reader conventions, deep links, and reduced-motion settings.
- Use native navigation and interaction patterns where they improve comprehension without changing product semantics.
- Request location, notification, camera, or file permissions only at the moment the related user action requires them; public information remains usable when permission is denied.
- Make offline/cached content visibly stale with its last-updated time. Do not persist simulator answers through app storage, backups, analytics, or notifications.
- Keep touch targets at least 44×44 logical pixels and verify representative supported Android and iOS devices.

### Organisation workspace

- Desktop: 240px left navigation, flexible content region, optional 360–440px inspector panel.
- Tablet: collapsible navigation and full-width content.
- Mobile: one task at a time; forms and record details replace split panes.
- Tables may scroll horizontally only when a card/list alternative would lose essential comparison value.
- Keep organisation identity and current workspace visible to prevent cross-organisation mistakes.

### Bidirectionality

- Use logical CSS properties (`margin-inline`, `padding-inline`, `inset-inline`).
- Mirror navigation, directional icons, and progress flows in RTL locales.
- Do not mirror universal icons such as play, check, warning, or external link.
- Test at least one Latin LTR language and Arabic RTL for every public screen.

## 6. Components & Patterns

Reuse components before inventing new controls. Components should expose default, hover, focus, active, disabled, loading, empty, error, and read-only states where applicable.

### Shared primitives

- **Button:** primary blue, secondary white with border, tertiary text-only, destructive red used sparingly.
- **Input/select:** visible label, optional help, 1px border, 12px radius, persistent error text.
- **Chip:** compact icon + label; used for service category, status, language, and review state.
- **Card:** white surface, thin border, 16px radius; shadow only for floating or selected layers.
- **Banner:** icon, short heading, plain-language explanation, and optional action.
- **Dialog/drawer:** preserve context and return focus on close.
- **Toast:** only for confirmation; errors that require action remain inline.

### Public-service components

- **Search autocomplete:** one input with grouped, labelled location, association, and need suggestions; keyboard/touch navigation, typo/no-result/loading/error states, and selected-term clearing.
- **Activity card:** category, activity name, audience label, open/closed/cancelled/uncertain status, next time, place, a compact preview of reusable services, every approved provider logo plus text name where the record names a provider (an activity the platform publishes itself names none, and the row is left out), last verified time, and one primary action.
- **Activity service list:** verified capabilities available within the selected activity. Pair each controlled icon with a visible translated label. Expanded desktop results may use two columns; mobile and low-bandwidth layouts use one column. A compact card may show up to four services plus a localized “+N more” link, while the detail view shows the complete list.
- **Activity group:** an association profile groups separate activity cards by place. Each card owns its description, audience, schedule, status, contact, freshness, and service list. Never show an organisation-wide union of services as if every service were available during every activity.
- **Audience label:** icon and translated text for all public, women only, children only, under 18 only, families only, or adult men only; details show provider wording and exact age range where relevant.
- **Freshness warning:** dated warning shown near the title, never hidden in metadata.
- **Map/list switch:** segmented control with list as the reliable low-bandwidth default.
- **Language selector:** current language name and script; never use flags for language.
- **Essential action tile:** icon, short label, one-line explanation, large tap target.
- **Information-simulator step:** one optional question, simple choices, progress text such as “Step 2 of 4,” Skip, and Start again.
- **Listen control:** prominent play/pause, localized title, duration, progress, playback speed, download/stream size where relevant, transcript, loading/error/retry, and no autoplay.
- **Video block:** poster image, explicit play, duration/size, captions, transcript, equivalent description where needed, and a low-bandwidth alternative.
- **Article image:** responsive rendition, localized alt text or explicit decorative role, credit/rights metadata when public, loading/error state, and low-bandwidth behavior.
- **AI translation notice:** small visible note naming source/target languages and AI use; show human-verification state beside it rather than replacing provenance.
- **Association card:** name, purpose, and verified specialities — one highlighted primary with up to four secondary icons, or up to five co-equal icons when no primary is marked — with visible labels, supported languages/location, and last verified date.
- **Association profile narrative:** optional organisation-confirmed founding year, goals, and values appear below the current-service summary with source and verification metadata. They stay off compact cards and never push actionable service information below decorative history.
- **Speciality icon:** one icon from the controlled taxonomy plus a localized text label. For example, medical care uses a stethoscope, medication a pill, and doctors/clinical consultation a clinician icon. Icons describe verified services, not brand identity.
- **Contact card:** purpose, supported languages, safe contact methods, schedule, and last verified date.
- **Download row:** title, language, file type, file size, publisher, updated date, and freshness state.
- **Invitation panel:** verified association identity, invited representative, narrow permission summary, expiry, publishing responsibilities, and accept/expired/revoked states. Never provide public organisation signup.
- **Ownership and approval panel:** proposed factual owners/publishers, exact revision, secure-email state, revision-linked notes, reviewer/approver, source, approval date, and projection preview. Pending parties/structured blocks stay hidden in public preview and appear after approval.
- **Custody transfer panel:** current administrative custodian, factual-owner warning, destination, expiry, destination acceptance, completion history, and loss-of-access confirmation.

### Workspace components

Implementation boundary: public web pages use the Tailwind primitives in `apps/web/src/components/public`; authenticated web-workspace primitives use the shadcn layer in `apps/web/src/components/ui`; the Expo app uses the React Native Reusables + NativeWind layer in `packages/ui`. All three consume `packages/tokens` under the same utility names. See `UI-ARCHITECTURE.md`. Reuse the appropriate layer before creating a raw control.

- **Record table:** sticky header, sort/filter controls, visible row selection, status cells, and explicit bulk-action mode.
- **Record inspector:** summary first, edit fields second, audit metadata last.
- **Publish bar:** draft state, translation completeness, freshness/review date, preview, immediate publish, scheduled publish, and unpublish actions.
- **Schedule editor:** recurrence summary in plain language plus exception dates and French public-holiday behavior.
- **Runbook calendar:** a full month on wide screens with labelled status dots. Selecting a date changes the runbook; only the current local date offers occurrence confirmation. The containing information rail has an explicit hide control and collapses to a narrow restore control; on narrow screens it remains in document flow.
- **City-team ownership context (Phase 3 gate):** read-only organisation, city, and city-team identity on an activity. It explains that the city team manages every activity for that organisation in the area. Moving an activity to another city is a separate record-level operation, never presented as activity-team assignment.
- **Activity-team assignment (Phase 3 gate):** autocomplete searches the current city team; a valid new email adds or reactivates city-team membership before creating the activity assignment. Show expertise, invitation/account state, and association-only/public-attribution choice. Public attribution fields are separately approved and never reuse the member email or private profile. Before the gate, use labelled fictional local data only.
- **Activity authoring:** require a French title and provide explicit French, English, and Arabic title/description tabs. Rich description controls support headings, emphasis, links, quotes, and lists, but not inline media. Public target and icon-labelled reusable services are first-class fields; services use searchable multiple choice and remain editable in the activity workspace. Existing city-team members use autocomplete, while a valid new email remains assignable for the pending-account path.
- **Member row:** role, city team, invitation/account state, assigned activities, last activity, and overflow actions.
- **Staffing board:** member rows against day/week columns, sticky identity/date headers, team/member filters, labelled availability/absence/assignment/conflict states, coverage warnings, and a mobile personal-agenda alternative.
- **Qualification field:** value/status plus an adjacent explanation of purpose, viewers, required/preferred context, retention, verification, and expiry.
- **Mission requirements:** required/preferred groups for skills, spoken language/proficiency, driving-permit category, and training; show match/gap and audited override state.
- **Agenda import:** file, timezone/mapping, duplicate/error table, selected-row commit, results, and guarded batch undo.
- **Document queue:** member, approved template/version, signer progress, expiry, reminder state, and restricted actions; document titles and contents appear only to permitted roles.
- **Signing view:** exact document preview, signer identity and order, consent/decline actions, expiry, completed-copy access, and visible evidence/audit status without making unsupported legal-validity claims.
- **Audit event:** actor, action, affected item, organisation, timestamp, and reason when required.
- **Inventory movement form:** location, scan/search item, quantity/unit, lot/expiry/condition, reason/source, projected balance, validation, and post confirmation.
- **Inventory ledger:** immutable movement rows, balance filters, correction link, actor/reason, and restricted cost columns only for financial viewers.
- **Inventory transfer:** source/destination, offered/dispatched/received quantities, destination acceptance, notes, discrepancy states, and tenant-local movement links.
- **Inventory alert:** low/out-of-stock or expiry context, threshold/current quantity, location/item, acknowledge/resolve actions, and related review task.
- **Freshness action:** one exact record or occurrence, why it needs attention, public impact, last verification, and adjacent confirm/correct/cancel/uncertain actions. Confirmation never follows from a page view and must record actor, time, and scope.

## 7. Motion, Interaction & Feedback

- Motion communicates state change; it is not decoration.
- Use 120–180ms for hover/focus changes and 180–240ms for drawers, panels, and view transitions.
- Use ease-out for entrances and ease-in for exits.
- Never animate critical status, freshness warnings, or emergency information in a way that delays reading.
- Respect `prefers-reduced-motion`; remove nonessential movement and use instant state changes.
- The only permitted repeating animation is the open-now presence dot's subtle pulse; it stops entirely under `prefers-reduced-motion`.
- Preserve scroll position and filter state when opening and closing a service detail.
- For slow operations, show a progress label after 400ms and a recovery action on failure.
- Offline or stale cached content must be visibly identified with the time it was last updated.

## 8. Voice, Content & Localization

### Voice

- Direct, respectful, and concrete.
- Use short sentences and familiar words.
- State what is known, what is uncertain, and what the user can do next.
- Do not promise availability, eligibility, safety, or legal outcomes.
- Address the reader as “you” where culturally and linguistically appropriate.

### Preferred interface copy

- `Open now` / `Closed` / `Cancelled` / `Information uncertain`.
- `Last verified 16 July at 14:20`.
- `This information may be outdated from 20 July 2026. Check with the listed contact before relying on it.`
- `Get directions`, `Call`, `Show schedule`, `Use list view`, `Start again`.
- `Translation not yet verified` rather than presenting machine translation as reviewed.

### Content rules

- Lead every public detail page with a short plain-language answer, essential facts, and the next action before optional detail.
- No essential action may require reading a 400-word page. Break longer information into clear sections and progressive disclosure and provide a visible listen path for priority content.
- Use short sentences, familiar vocabulary, concrete verbs, and one idea per paragraph.
- Priority content has reviewed localized audio. Video is used when visual demonstration or human explanation materially improves understanding.
- Never autoplay audio or video. Always provide accessible controls, duration/file-size metadata, captions/transcripts, and a low-bandwidth fallback.
- Dates use an unambiguous localized format; include the year when ambiguity is possible.
- Times use the locale convention and always use the Europe/Paris timezone for local service schedules.
- Essential information remains available without answering simulator questions or creating an account.
- Public information-simulator answers stay in the browser session and are not linked to identity or analytics.
- Every public record shows an owner, last-reviewed date, and status or freshness state.
- All mock data must be labeled **Demo data — do not publish**.

## 9. Anti-patterns & Non-negotiables

### Do not

- Turn the public experience into a dense Airtable-style grid.
- Use a map as the only way to find services.
- Hide freshness, uncertainty, cancellation, or translation state.
- Use flags as language selectors or color as the only status signal.
- Show association speciality as an unlabeled icon or infer it from a logo/name without verification.
- Merge services from separate activities or imply that an organisation provides every listed capability during every activity.
- Use tiny text, low-contrast gray, glassmorphism, heavy shadows, gradients, or decorative illustration around urgent content.
- Present a long wall of text before the answer, next action, or listen control.
- Put more than one dominant primary button in the same panel.
- Truncate translated text that could affect access to a service.
- Ask for an account, identity, country of origin, or passport details to view essential information.
- Mix assistance records into ordinary publishing, membership, or inventory screens.
- Hide whether an article was association-published or proxy-published by a platform editor, or imply that proxy publication transfers factual responsibility to the platform.
- Show sensitive information in notifications, analytics, URLs, logs, or public prototypes.
- Add dashboard charts that do not support a specific operational decision.
- Copy Airtable's logo, illustrations, product names, or proprietary assets.

### Always

- Provide keyboard-visible focus, meaningful landmarks, and accessible names.
- Pair icons with text for important actions and states.
- Design loading, empty, error, offline, permission-denied, and outdated states.
- Confirm destructive or public-facing changes and explain their effect.
- Make list view, language selection, and help content work at 320px without horizontal scrolling.
