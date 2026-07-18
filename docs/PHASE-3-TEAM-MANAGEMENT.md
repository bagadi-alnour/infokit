# Phase 3 — Team Management

> This document elaborates Phase 3. `PRODUCT.md` is the canonical product requirements document and takes precedence if scope or terminology differs.

## Objective

Help onboarded associations coordinate staff, volunteers, and interns, and complete the documents required for their participation, while keeping team operations and restricted documents separate from public information and from any future assistance-record module.

Phase 3 builds on the verified organisation workspaces and permissions introduced in Phase 2.

Administration, coordinator, member-agenda, and notification interfaces are available in French and English and follow the user's saved preference.

## Users

- Organisation administrator.
- Coordinator or team lead.
- Restricted document administrator or authorised signatory.
- Staff member.
- Volunteer.
- Intern.
- Viewer/auditor with selected read-only access.

## Capabilities

### Members and onboarding

- Invite staff, volunteers, and interns with expiring links.
- Resend, revoke, or expire pending invitations.
- Activate, deactivate, and offboard members.
- Allow users to maintain their own permitted profile fields.
- Let members declare spoken languages/proficiency, skills, driving-permit categories/status, and completed training/courses with self-declared, pending, verified, rejected, and expired states.
- Before save, explain why each field is requested, who can see it, whether it is required for a role/mission, and how long the organisation keeps it.
- Do not collect a licence number or scan by default; evidence requires a documented need and restricted access.
- Keep accessibility/accommodation information restricted to authorised roles.
- Separate operational onboarding from HR/employment administration.

### Teams and permissions

- Create teams and assign members.
- Assign coordinators/team leads.
- Define organisation-scoped roles and explicit permissions.
- Restrict volunteers to the information needed for their missions.
- Review sensitive permissions regularly.
- Preserve audit history when a member changes role or leaves.

### Availability and planning

- Members submit recurring and one-off availability.
- Members can mark time as available, preferred, unavailable, or uncertain and add a reason only when the organisation has a justified need to collect it.
- Staff can submit an absence request; volunteer and intern unavailability uses wording appropriate to their status rather than implying an employee leave entitlement.
- Coordinators use a day/week staffing board with one row per member and filters for team, team lead, member, role, skill, language, and availability state.
- Coordinators view coverage by day, week, team, skill, and language without opening each member profile.
- Create recurring shifts, meetings, and field events.
- Import `.ics` and approved `.csv` agendas through preview, timezone/field mapping, duplicate detection, row errors, idempotent commit, and batch undo.
- Assign people to shifts and missions.
- Show availability, approved/awaiting absence, assignments, limited-access periods, conflicts, missing coverage, and required qualifications as distinct labelled states; color is never the only identifier.
- Allow members to accept, decline, or request a change.
- Keep planning usable on mobile as a personal agenda; the dense multi-member board is a desktop/tablet coordinator view.
- Personal agendas and the coordinator board include the coordination events (Phase 2 shared inter-organisation agenda) the organisation participates in; internal operational detail never becomes visible to other organisations through that agenda.

### Restricted documents and signatures

- Maintain approved templates for participation documents such as volunteer agreements, internship documents, charters, confidentiality commitments, and policy acknowledgements.
- Prepare a document from a locked template version and member data, then require an authorised person to review it before sending.
- Support one or more signers and an explicit signing order, including an external signer when an internship workflow requires a school or another party.
- Let members review, decline with a reason, or sign assigned documents from mobile or desktop.
- Track draft, ready for review, awaiting signature, partially signed, signed, declined, expired, and cancelled states.
- Send reminders without attaching sensitive documents or exposing their contents in notification previews.
- Store the final signed copy with its template version, signers, timestamps, integrity/evidence data supplied by the signature provider, and audit history.
- Restrict templates, drafts, signed files, and signature evidence to explicit document permissions; team membership alone never grants document access.
- Define retention and deletion rules per document type and allow the member to receive a copy.
- Treat electronic-signature level, identity checks, wording, retention, and evidential requirements as policy decisions validated for each document type; the interface must not claim that every signature has the same legal effect.

### Missions and communication

- Daily and weekly mission views.
- Clear location, time, team, coordinator, instructions, and required/preferred skills, spoken languages/minimum proficiency, driving-permit categories, and training/courses.
- Maintain a training/course catalogue with title, provider, link, description, validity, active state, and verification policy.
- Show why a member matches or misses a criterion. Preferred gaps do not block assignment; required gaps need an authorised override reason and audit event.
- Invitations, reminders, schedule-change notifications, and cancellations.
- Notification preferences and safe delivery channels.
- No sensitive beneficiary or assistance information in notifications.

### Connection to public information

- A public event may reference the responsible internal team without exposing member names.
- Operational changes can prompt an authorised editor to update public status.
- Team availability never becomes public.
- Publishing permissions remain separate from team-management permissions.

## Initial Roles

| Role | Typical permissions |
| --- | --- |
| Organisation administrator | Organisation settings, members, roles, teams, and audit access; document access only when explicitly granted |
| Coordinator | Teams, availability, shifts, missions, meetings, and operational overview |
| Document administrator/signatory | Approved templates, document preparation, signer workflow, signature status, and restricted document audit |
| Staff/volunteer/intern | Own profile and availability, assigned shifts/missions, permitted team information, and documents sent to them |
| Viewer/auditor | Read-only access to selected operational reports |

An editor from Phase 2 does not automatically receive team-management access. A coordinator does not automatically receive publishing, restricted-document, or sensitive-data access. Organisation administrators configure access but do not automatically read signed documents unless policy requires it and the permission is granted.

## Primary Workflows

### Invite and onboard a member

1. Coordinator creates an invitation with role and optional team.
2. Person receives an expiring link.
3. Person creates credentials and reviews the privacy notice.
4. Person reviews the purpose/visibility/retention notices and selects permitted languages, permit status/categories, courses, skills, and availability.
5. Coordinator verifies qualifications when necessary.
6. If participation documents are required, an authorised document administrator prepares and sends them through the restricted workflow.
7. Person sees their team, schedule, missions, and document tasks they are permitted to access.

### Plan a week

1. Coordinator opens weekly coverage.
2. System shows availability, language/skill needs, and conflicts.
3. Coordinator creates or adjusts shifts and missions.
4. Members receive invitations and accept/decline.
5. Coordinator resolves remaining gaps.
6. Relevant public events are checked for schedule consistency.

### Import an agenda

1. Coordinator uploads an `.ics` or approved `.csv` file.
2. Preview shows timezone, mappings, duplicates, unsupported recurrence, and row errors without creating events.
3. Coordinator confirms selected valid records.
4. The system reports created, skipped, and failed rows under one idempotent batch.
5. An authorised coordinator can undo unchanged records from that batch.

### Handle a last-minute cancellation

1. Member declines or coordinator cancels an assignment.
2. Coverage warning identifies the affected team/event.
3. Coordinator reassigns or cancels the operational activity.
4. If public service changes, an authorised editor is prompted to update the public status.
5. Notifications and audit events are recorded.

### Prepare and sign a participation document

1. Authorised document administrator selects the member and an approved template.
2. System fills permitted member/organisation fields and identifies missing required information.
3. Administrator reviews the generated document, signer list, signing order, expiry, and retention rule.
4. Member and any additional signers receive secure invitations and review the exact document version.
5. Each signer signs or declines; the system records status without revealing document contents to ordinary coordinators.
6. When complete, every permitted party receives or can retrieve the final signed copy.
7. The signed file, signature evidence, template version, timestamps, and audit events are retained according to policy.

## Required Screens

| ID | Screen |
| --- | --- |
| P3-01 | Team-management overview |
| P3-02 | Members and invitation states |
| P3-03 | Member operational profile |
| P3-04 | Team list and team detail |
| P3-05 | Availability calendar/form |
| P3-06 | Weekly coverage planner |
| P3-07 | Shift/event editor |
| P3-08 | Mission detail and assignment |
| P3-09 | Member schedule/mobile agenda |
| P3-10 | Notifications and preferences |
| P3-11 | Roles, permissions, and permission review |
| P3-12 | Team audit history |
| P3-13 | Restricted document centre and signature-status queue |
| P3-14 | Template-based document preparation, review, and signing |
| P3-15 | Training/course catalogue and member qualifications |
| P3-16 | Agenda import preview, results, and undo |

## Privacy and Safety

- Collect only operational information with a documented purpose.
- Show the approved purpose, visibility, requirement context, and retention rule before collecting spoken language, training, skill, or driving-permit status.
- Store driving-permit status/category without licence number or image unless a separately approved restricted-evidence policy requires it.
- Do not collect sex, country, emergency contacts, or accommodation information without a specific justified need.
- Restrict accommodation and emergency-contact information.
- Do not put participation/employment documents, contract details, signature evidence, absence reasons, or accommodation information in the ordinary team profile or staffing board.
- Use a separate encrypted document store with explicit document permissions; do not treat an ordinary upload as a signed record.
- Avoid copying member data into documents unless the approved template requires it.
- Do not include document files or sensitive document titles in email, SMS, or push notification previews.
- Record access to restricted documents as well as signature actions.
- Do not expose personal contact details to all members by default.
- Do not place assistance records or free-text case notes in team screens.
- Notifications must not reveal sensitive personal or assistance information.
- Offboarding must revoke access promptly and preserve the minimum required audit trail.

## Phase 3 Exit Criteria

- Pilot organisations can onboard and offboard members safely.
- Coordinators can plan coverage and assign missions without spreadsheets for the pilot workflow.
- Members can update availability and see assignments on mobile.
- Members can review the purpose and state of their language, training, skill, and permit declarations.
- Mission matching distinguishes required/preferred criteria and audits required-condition overrides.
- Representative `.ics`/`.csv` imports avoid retry duplicates and support batch undo.
- Coordinators can scan the week by team and member, distinguish availability from assignments/absences, and resolve coverage gaps without opening individual profiles.
- Pilot organisations can prepare, route, sign, retrieve, and audit at least one volunteer-agreement workflow and one internship-document workflow using approved templates.
- Restricted document access, signer authentication, integrity evidence, reminders, retention, cancellation, and offboarding behavior pass security and policy review.
- Role separation between publishing, coordination, inventory, and future sensitive data is verified.
- Last-minute operational changes reliably trigger public-information review when necessary.
- Permission reviews, audit history, and notification privacy pass testing.

## Not in Phase 3

- Payroll, payslips, time-clock/payroll calculations, performance reviews, recruitment, or full HR management.
- General-purpose contract drafting or legal approval of document templates; Phase 3 only uses organisation-approved templates and configured signing workflows.
- Inventory and financial administration.
- Assistance records, beneficiary registration, or cross-organisation person identifiers.
- Public exposure of team membership, availability, or internal instructions.
