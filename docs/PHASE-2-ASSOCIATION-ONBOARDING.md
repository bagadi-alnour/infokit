# Phase 2 — Association Onboarding and Publishing

> This document elaborates Phase 2. `PRODUCT.md` is the canonical product requirements document and takes precedence if scope or terminology differs.

## Objective

Bring verified associations fully into InfoKit so each organisation can maintain its public profile, services, schedules, articles, simulator content, contacts, and downloads without accessing another organisation's private workspace. Associations that received limited article-publishing access in Phase 1 are upgraded rather than re-created.

Phase 2 changes the content model from platform-managed publishing to shared, accountable publishing.

## Prerequisite

Phase 1 public journeys, content types, speciality taxonomy, freshness rules, and translation behavior must be stable enough for associations to manage them safely. Any association already invited to publish articles in Phase 1 keeps the same organisation identity, user account, content ownership, URLs, translations, and revision history.

## Users

- Platform operator or moderator.
- Organisation administrator.
- Organisation editor.
- Translator or reviewer with explicitly limited permissions.

Team coordinators, staff, volunteers, interns, and restricted participation-document workflows are introduced in Phase 3.

## Capabilities

### Organisation onboarding

- Invitation-only onboarding; there is no public organisation signup or self-initiated account request.
- A platform operator identifies or receives an offline referral for an association, verifies its identity, and checks for duplicates or impersonation.
- The platform operator creates or selects the organisation record and sends an expiring invitation to the first organisation administrator.
- For a Phase 1 publishing association, the operator upgrades its existing organisation record and invites or promotes the appropriate administrator without creating a duplicate workspace.
- Accept platform terms, publishing responsibilities, and privacy notice.
- Create or claim the public association profile.

### Isolated organisation workspace

- Every record is scoped to one organisation unless explicitly platform-owned.
- The current organisation and user role remain visible.
- An administrator or editor in one organisation cannot access another organisation's private data.
- Platform moderation is explicit and audited.

### Public-profile management

- Edit purpose, optional founding year, goals, values, verified locations, safe contacts, supported languages, accessibility information, website, and source metadata inherited from the pre-onboarding draft.
- Store any number of verified specialities from the Phase 1 taxonomy, mark at most one as primary, order them, and select up to four secondary specialities for the initial public summary card.
- Organisation admins can request speciality additions, removal, reordering, or a new primary. New/changed claims require platform reverification; removal can take effect with effective-dated audit history.
- Preview speciality icons and labels in public contexts.
- Submit logo/brand assets only when the organisation has permission to use them.
- See last-verified, review-due, and outdated states.

### Publishing

- Create and maintain several distinct service offerings, places, schedules, exceptional openings/closures, events, audience policies, and verified provider associations/logos.
- Assign controlled icon-labelled features to each service offering, add translated offering-specific detail, order the feature list, and set availability as available, scheduled, on request, or limited.
- Preview an association profile grouped by service offering and confirm that features from one offering do not appear on another.
- Create, translate, preview, publish, unpublish, and archive articles with images/video and AI-translation provenance.
- Maintain fixed/basic information only when the platform grants the relevant permission.
- Propose or maintain simulator questions and result content through a review workflow.
- Upload approved PDFs/files with translated metadata and freshness dates.
- Generate print-ready flyers (card/poster formats) for services, events, and the profile, with QR code, short URL, selected languages, and verification date; each flyer is also stored as a public downloadable PDF so the physical and digital versions stay in sync.
- Preview the exact public state before publishing.
- Publish urgent cancellations with visible translation fallback when policy permits.
- Propose joint/shared information with several organisations and request revision-specific approval from each verified representative by secure email link.
- Exchange notes or changes requests in the secure approval thread. Public projections hide each pending organisation and its structured blocks, then add them automatically after approval.
- Transfer article administrative custody only through an admin-initiated request accepted by the destination organisation/platform; preserve factual-owner, URL, revision, approval, and audit history.
- Use the publishing/admin dashboard and email workflow in French or English according to the user's preference.

### Shared inter-organisation agenda

- A workspace agenda (calendar and list) shows coordination events across organisations for the active city.
- An event is hosted by one organisation (or the platform) and is either **organisation-scoped** (internal) or **inter-organisation** — visible to authenticated members of every verified organisation. Coordination events are never public.
- Events support one-off and recurring schedules (for example, a daily inter-association coordination briefing that other organisations join), concrete occurrences, safe location and contact details, and cancellation or changes with a visible reason.
- Creating and editing requires an explicit coordination permission granted by the organisation administrator; every active member of a verified organisation can view inter-organisation events.
- Organisations can mark participation (attending / interested / declined), visible to the other participants.
- The agenda shows no member personal data; in Phase 3, relevant coordination events also appear in members' personal agendas and coordinator boards.

### Roles and permissions

Initial roles:

| Role                       | Scope                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| Platform operator          | Verify organisations, moderate shared taxonomies/content, investigate audit events          |
| Organisation administrator | Organisation settings, profile, users with Phase 2 roles, permissions, audit view           |
| Editor                     | Places, services, schedules, articles, contacts, downloads, and permitted simulator content |
| Translator/reviewer        | Assigned languages/content and verification state only                                      |

Permissions remain organisation-scoped and explicit. Team membership and operational scheduling permissions wait until Phase 3.

### Governance and quality

- Content owner, source, last-reviewed date, and review/expiry date are required where applicable.
- Revision history and audit events record important changes.
- Joint-publication history records every requested organisation, verified approver, exact revision/hash, note, changes-requested/approval/decline/expiry/invalidated state, and immutable public projection.
- Conflicting information has a moderation and escalation workflow.
- The platform can suspend publishing without deleting the organisation's audit history.
- Leaving the platform has a documented handover, archive, and data-retention process.
- A publisher who changes organisation loses the old membership's access; articles do not follow the person unless admins complete a custody transfer.

## Primary Workflows

### Onboard an association

1. Platform operator verifies the association through the agreed offline/operational process and checks duplicates.
2. Operator creates or upgrades the organisation record.
3. Operator sends an expiring invitation to the first organisation administrator.
4. Administrator accepts the invitation, credentials, terms, publishing responsibilities, and privacy notice.
5. Administrator reviews/claims the public profile and selects verified specialities.
6. Existing Phase 1 articles and publishing users appear automatically when applicable.
7. Administrator invites editors or translators within Phase 2 permissions.
8. Organisation creates or reviews each service offering and its feature assignments.
9. Organisation previews and publishes its first full-workspace update.

### Publish a closure

1. Editor opens the relevant service.
2. Editor selects affected occurrence(s) and adds an exceptional closure.
3. Public preview shows status, date, reason, translations, and fallback behavior.
4. Editor publishes.
5. Public map/list updates and an audit event is created.

### Publish an article

1. Editor creates content and translations.
2. Editor answers whether it can become outdated.
3. When yes, the reliability date is required.
4. Reviewer verifies translations/content when the workflow requires it.
5. Editor previews and publishes.

### Host a recurring inter-association briefing

1. An authorised member of the hosting organisation creates a coordination event: recurrence (for example every weekday at 09:30), safe location and contact, and visibility **inter-organisation**.
2. The event appears in the shared agenda of every verified organisation in that city.
3. Other organisations mark participation; their state is visible to participants.
4. A change or cancellation updates the affected occurrence with a visible reason and notifies participating organisations safely.
5. Participation and changes remain auditable; nothing appears publicly.

### Transfer article custody

1. A source-organisation or platform admin selects the article and destination.
2. The admin reviews custody separately from historical factual ownership/public attribution.
3. A destination admin accepts or declines the expiring request.
4. Acceptance changes edit control while preserving URL, revisions, approvals, attribution, and audit history.

## Required Screens

| ID    | Screen                                                             |
| ----- | ------------------------------------------------------------------ |
| P2-01 | Platform verification and organisation invitation                  |
| P2-02 | Platform approval/duplicate review                                 |
| P2-03 | Workspace overview and review queue                                |
| P2-04 | Public profile and speciality editor                               |
| P2-05 | Places/services table and record inspector                         |
| P2-06 | Schedule and exception editor                                      |
| P2-07 | Article editor, translation review, and joint-publication approval |
| P2-08 | Simulator-content editor/review                                    |
| P2-09 | Files/downloads manager                                            |
| P2-10 | Phase 2 roles and invitations                                      |
| P2-11 | Audit log and revision history                                     |
| P2-12 | Article-custody transfer requests/history                          |
| P2-13 | Shared inter-organisation agenda and coordination-event editor     |

## Phase 2 Exit Criteria

- At least two verified pilot associations manage their own public profiles and listings.
- Every organisation workspace originates from a platform-issued invitation, and duplicate/impersonation checks are recorded.
- Organisation isolation and role permissions pass security testing.
- An editor can publish a cancellation in under one minute.
- Review reminders reduce outdated public listings.
- Speciality changes preserve verification/effective history and keep pending additions out of the public profile.
- An editor can maintain two offerings from the same organisation or place with separate schedules, audiences, statuses, and feature lists.
- Every public change is attributable and reversible.
- Platform moderation handles duplicates, conflicts, suspension, and organisation departure.
- Approval projections hide pending parties and activate their structured content only after exact-revision approval.
- Article custody transfer requires destination acceptance and does not rewrite factual ownership.
- Pilot administrators complete the core dashboard/publishing workflows in French and English.
- Pilot organisations host and join at least one recurring inter-organisation event in the shared agenda, including a cancellation with a visible reason.

## Not in Phase 2

- Operational teams, volunteer availability, shifts, missions, or internal team-meeting scheduling; the shared inter-organisation agenda above is in scope, while member-level scheduling arrives in Phase 3.
- Staff/volunteer/intern participation-document signing, general HR records, contracts, payroll, and performance management.
- Inventory and kit distribution.
- Assistance records, beneficiary profiles, or cross-organisation person matching.
