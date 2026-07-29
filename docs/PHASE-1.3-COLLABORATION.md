# Phase 1.3 — Invited Verifier & Translator Collaboration

> This document elaborates a narrow Phase 1 extension. `PRODUCT.md` is the
> canonical product requirements document and takes precedence if scope or
> terminology differs. `PHASE-1-PUBLIC-INFORMATION.md` remains the parent
> phase specification.

## Positioning

Phase 1.3 adds two controlled collaboration flows on top of the Phase 1
public-information product. Both keep the Phase 1 boundary intact: they
improve **freshness** and **translation** of already-public content without
opening the Phase 2 association workspace.

This is **not** Phase 2 onboarding. There is no full workspace, no broad
organisation settings, no team management, no availability or missions, no
inventory, and no general role administration. It reuses the Phase 1
identities, organisation records, invitations, memberships, editorial
revisions, and audit trail already in place.

The two flows are independent:

1. **Invited organisation verifier onboarding** — a verified organisation
   representative joins as a Phase 1 publisher/verifier to review and refresh
   their organisation's public information, and may invite a small number of
   trusted colleagues into the same limited workflow.
2. **Translator link sharing**: an org admin or publisher assigns one content
   item and target language to an external translator through an opaque,
   expiring link. The translator receives no access to the organisation's
   dashboard. Translators are now named in a directory (`core.translators`) so
   the sender can pick one instead of retyping an address, and an invited
   translator gets their own space — their profile, their languages, their
   courses — which is not an organisation workspace.

### Who runs the platform side

Both flows are started by platform staff, and the platform's own side is split
by kind of work rather than by seniority:

- **`platform_superadmin`** is the technical account: `support.superadmin`,
  `audit.read`, and `platform.staff.manage`. It holds no content permission. One
  address is seeded from deployment configuration
  (`BOOTSTRAP_SUPERADMIN_EMAIL`, granted `platform_superadmin` +
  `platform_operator`); it is the only platform account that is not invited.
- **`platform_content_manager`** is the content account: articles, activities,
  the simulator, and the translation lifecycle. It has no support access, no
  audit read, and cannot staff the platform.
- **`platform_operator`** stays the directory/verification role that runs Flow 1.

The superadmin invites the others (`core.invitations`, kind `platform_admin`).
That invitation names no organisation and reserves no membership: acceptance
inserts the invited roles straight into `core.user_platform_roles`. The split is
hygiene, not a hard wall — a superadmin can role-test into a content context —
so the audit trail, not the permission grid, is what answers who edited what.

## Flow 1 — Invited organisation verifier onboarding

### Who and how

- A **platform operator** verifies or creates the organisation record and
  sends an expiring, invitation-only invite to a designated representative
  (`core.invitations`, kind `association_publisher`). There is no public
  organisation signup or self-service request.
- The representative accepts by signing in with the invited address. A
  verified magic-link login or an existing verified account session proves
  ownership of that sole sign-in address, so acceptance links the pending
  organisation membership and marks the invitation accepted
  (`linkPendingMemberships`). The representative reviews and records acceptance
  of the versioned publishing responsibilities (`core.legal_documents` /
  `core.legal_acceptances`).
- The representative receives only the organisation-scoped Phase 1
  publisher/verifier permissions. A Phase 1.3 invite grants no member
  administration, no organisation settings, no team management, and no access
  to another organisation.

### What the verifier can do

A lightweight, organisation-scoped experience limited to:

- Reviewing their organisation's **public** activities, reusable services, and
  editorial entries.
- Refreshing **freshness metadata** — confirming a record is still accurate
  (`last_verified_at`), setting the next review date (`review_due_at`), and
  clearing items from the organisation's ranked freshness/attention queue
  (`content.review_tasks`, `content.activity_occurrence_confirmations`).
- Correcting, cancelling, or marking a record uncertain when a one-tap
  confirmation is not appropriate. A confirmation only ever applies to the
  exact scope the actor has just seen; viewing or dismissing a prompt never
  refreshes the record.

Everything is versioned and audited (`audit.events`).

### Bounded colleague invitations

- A verifier may invite a **small number** of trusted colleagues into the same
  organisation-scoped publish/verification workflow for the **same**
  organisation only.
- A colleague invitation reuses `core.invitations` with the
  `invited_by_member_id` column set to the inviting membership. Operator
  invitations leave that column null. The per-organisation cap is enforced by
  counting active `association_publisher` memberships plus live invitations for
  the organisation.
- Colleagues get exactly the same limited permissions — they cannot invite
  beyond the cap, administer members, change settings, or reach another
  organisation.

### Offboarding

If a verifier leaves or changes organisation, ending the membership revokes
old-organisation access without changing article custody, factual ownership,
public attribution, URLs, revisions, or audit history. The new organisation
grants access through a separate membership. This matches FR-P1-036.

## Flow 2: source-first translation and external review

### Source authoring and publication

- The author selects one source language for an article, activity, or public
  event. Saving creates or updates the source draft; it does not publish.
- The platform records an immutable translation-source version with the source
  language, canonical source payload, SHA-256 hash, author, and change impact.
  An article source version also points to its immutable editorial revision.
- An actor with the content publication permission may publish the source after
  the ownership, provider, freshness, approval, and safety gates pass. Missing
  target translations do not block that publication.
- After source publication, the platform may request machine translations for
  enabled target languages that have a named review owner. The configured AI
  provider and content type must have prior approval. Generated target rows keep
  the provider job reference, source-version link, content hash, and AI method;
  they remain outside active publication.

### Who and how

- A user with `content.translation.request` assigns one editorial article,
  activity, or public event to an external translator, with one target language
  per assignment.
- The sender picks the translator from the directory — the translators their own
  organisation invited, plus those listed for the whole network — filtered by the
  target language, or types an address by hand as before. The chosen entry is
  recorded as `translation_assignments.translator_id`, while the email and name
  stay on the assignment as the record of what was actually sent.
- Phase 1.3 allows one live assignment per content item and target language.
  Rejection, revocation, recorded expiry, or completed publication frees the
  slot for reassignment.
- The sender chooses an expiry from bounded platform presets. The platform
  enforces a maximum lifetime and permits revocation before expiry.
- The email contains an opaque route such as
  `/[ui-locale]/translate/[token]`. It contains no content type or record ID.
  The platform stores the token hash and sends the raw token only in that email.
- The first valid request exchanges the raw token for a scoped, HttpOnly
  assignment session and redirects to a URL without the token. The assignment
  expiry and revocation state continue to govern that session.
- `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, rate limiting, and
  token redaction apply to the exchange and translator pages. Analytics, logs,
  error reports, and notification previews exclude the token and submitted text.
- Link possession authorises the assignment session; it does not prove the
  translator's identity. A later policy may require email OTP when identity
  evidence matters.

### The translator view

- Shows only the immutable source payload pinned when the sender created the
  assignment, plus the target fields for the requested language.
- Lets the translator save a draft and submit the translation back to the
  sender.
- Exposes no organisation dashboard, organisation content, member data, or other
  translator assignment — including for a translator who also has their own
  space. The link is a session over one payload, never a way into an account.

The assignment holds submitted target fields
(`submitted_content_json`) until a reviewer accepts them, keeping unreviewed
external text out of the public translation tables. On acceptance, a reviewer
promotes the text into the content type's own translation row (for editorial,
`content.editorial_revision_translations`), where the existing translation
quality, method, content hash, source-version link, and AI-provenance rules
apply. Acceptance does not activate public publication. An actor with the
content publication permission performs that action.

### The translator directory and space

- A platform operator, or an organisation admin with
  `translator.directory.manage`, creates a `core.translators` entry and invites
  the person (`core.invitations`, kind `translator`). The entry exists first with
  status `invited`, the same way a team invitation is preceded by its member row.
- Accepting is the same proof as every other invitation — signing in with the
  invited address — and links the entry's `user_id`. It grants no organisation
  membership and no organisation roles: account linking deliberately skips
  translator invitations. What it does grant is the platform `translator` role,
  three permissions wide: `translator.workspace.read` for the assignments
  addressed to that entry and nothing else, `content.translation.submit` to work
  them, and `translator.profile.manage` for their own profile.
- `directory_scope` decides who may send that translator work: `organization`
  keeps them to the organisation that invited them, `all_organizations` lists
  them for every organisation on the platform. `owner_organization_id` only
  records who brought them in.
- Their space holds their own profile (display name, headline, bio, timezone),
  the language pairs they work in (`core.translator_languages`), and the courses
  they have added to their skills. It is not an organisation workspace: no
  organisation content, no member data, no other translator's assignments.

### Separate state dimensions

The management page composes three state dimensions instead of flattening them
into one label:

| Dimension            | Values                                                               |
| -------------------- | -------------------------------------------------------------------- |
| Translation quality  | source, draft, machine generated, needs review, verified, rejected   |
| Assignment lifecycle | requested, draft, submitted, reviewed, accepted, rejected, published |
| Locale publication   | unpublished, published                                               |

The assignment lifecycle follows:

`requested -> draft -> submitted -> reviewed -> accepted | rejected -> published`

- **requested** — the sender created the assignment; the link is live.
- **draft** — the translator has saved work but not submitted.
- **submitted** — the translator returned the translation.
- **reviewed** — a reviewer has examined the submission.
- **accepted / rejected** — the reviewer's decision, with a note.
- **published**: an accepted translation was promoted and an authorised
  publisher activated the target locale.

Each transition and its author are recorded in
`content.translation_assignment_events` (the external translator acts by
token; senders and reviewers act as authenticated users), complementing the
global audit log.

The queue shows combined labels such as `Machine generated · Unpublished` and
`Verified · Published`. `published` never enters the content translation-quality
enum.

### Fallback and source changes

- A request for a locale without a verified active translation receives the
  current source publication. The page labels the fallback in the requested UI
  language, names the source language, and sets the source block's `lang` and
  `dir` attributes.
- Machine-generated, rejected, stale, and unreviewed target text never replaces
  the source fallback.
- Each new source version records one translation impact: `initial`, `none`,
  `review_required`, or `regenerate`.
- The platform assigns `none` only when no translatable source field changed.
  Changed translatable meaning defaults to `review_required`. A full rewrite or
  an explicit author decision may use `regenerate`.
- A reviewer must confirm that a carried-forward translation remains accurate
  before it stays active against the new source version. The record keeps the
  prior source-version or editorial-revision reference.
- A new assignment pins the new source version. Existing assignment sessions
  keep their original source and cannot submit against the new version; the
  sender revokes or replaces them.

## Schema summary

Phase 1.3 extends the Phase 0/1 schema additively:

| Change      | Table / enum                                                         | Purpose                                                                                                         |
| ----------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| New column  | `core.invitations.invited_by_member_id`                              | Marks publisher-originated colleague invitations and scopes the per-organisation cap                            |
| New column  | `core.invitations.translator_id`, nullable `organization_id`         | A `translator`-kind invitation names a directory entry instead of an organisation membership                    |
| New tables  | `core.translators`, `core.translator_languages`                      | The translator's own identity, profile, directory scope, and language pairs                                     |
| New column  | `content.translation_assignments.translator_id`                      | Optional link from one send to the directory entry it was picked from                                           |
| New enums   | `translator_status`, `translator_directory_scope`                    | Invited/active/inactive/suspended, and who may send that translator work                                        |
| New values  | `invitation_kind.translator`, `invitation_kind.platform_admin`       | The two invitation kinds that grant access outside any membership: a translator space, or platform staff roles  |
| New roles   | `translator`, `platform_content_manager` (was `platform_editor`)     | The translator's own minimal role, and the content half of the platform's technical/content split               |
| New enum    | `translation_assignment_state`                                       | The translator assignment lifecycle                                                                             |
| New enum    | `translation_assignment_entity`                                      | Allowed targets: `editorial_entry`, `activity`, `public_event`, `simulator_flow`                                |
| New enum    | `translation_impact`                                                 | Source-change impact: `initial`, `none`, `review_required`, `regenerate`                                        |
| New enum    | `translation_job_state`                                              | Provider-neutral machine-translation lifecycle: queued, submitted, succeeded, failed, cancelled                 |
| New table   | `content.translation_source_versions`                                | Immutable source language, payload/hash, version, author, and change impact for one content item                |
| New table   | `content.translation_jobs`                                           | Idempotent machine-translation request/output and provider provenance pinned to one source version and language |
| New table   | `content.translation_assignments`                                    | Expiring per-language assignment pinned to one source version                                                   |
| New table   | `content.translation_assignment_events`                              | Per-assignment state-transition history                                                                         |
| New tables  | `content.activity_publications`, `content.public_event_publications` | Locale activation history with source-version and localized-content hashes                                      |
| New columns | Content translation tables                                           | Source-version link, target content hash, AI provider/job provenance, verification, and carry-forward reference |

The flow reuses organisation verifications, memberships, permissions,
invitations, publishing-responsibility acceptance, editorial revisions,
publication pointers/snapshots, freshness columns, and the review queue.

No Phase 2+ workspace, membership, or inventory tables are added. The one
exception is the course catalogue pulled forward from
`DATABASE-SCHEMA.md` §12 (`operations.training_courses`,
`operations.training_records`), because the people this phase already invites —
members and translators alike — are the people who take those courses.

## UX contract

- **Invitation-only verifier access.** No public organisation signup or
  self-initiated request; the platform controls who is invited.
- **Limited colleague invitations.** A verifier may invite only a small,
  capped number of colleagues, only into the same organisation, only into the
  same limited workflow.
- **Scoped translator session.** The token exchange grants access to one pinned
  source version and target language. Revocation or expiry ends that access.
- **Visible state.** The queue displays translation quality, assignment state,
  and locale publication as separate values.

## Not in Phase 1.3

- Full organisation workspace, settings, or profile claiming.
- Member administration or broad custom-role management.
- Team management, availability, shifts, missions, or notifications.
- Inventory, HR, assistance records, or beneficiary registration.
- Uncapped or cross-organisation invitations.
- Translator access to an organisation's dashboard, its content, its member
  data, or another translator's assignments. A translator's own space is theirs
  alone.
- Parallel live translator assignments for the same item and target language.
- Automatic promotion of a translator submission to public without review.
- Automatic publication by a translation reviewer who lacks the content
  publication permission.
