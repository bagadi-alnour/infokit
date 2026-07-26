# Simulator Scenarios — InfoKit

## Overview

These scenarios document realistic user journeys through the information simulator. Each demonstrates different needs, user profiles, constraints, and decision trees. Scenarios are **fictional but informed by field context** and do not prescribe code or implementation details.

---

## Scenario 1: Refugee Seeking Medical Care & Shelter (Amira)

**User Profile:**

- Recent arrival in Calais; speaks Arabic and limited French
- Using a basic smartphone with limited data (~2G)
- Stressed, unfamiliar with the city
- No account, no prior knowledge of available services

**Context:**

- Thursday 14:15 (current time: 2026-07-23, Europe/Paris timezone)
- Needs immediate medical care and overnight shelter
- In Parc de la Lande area

**Device & Connectivity:**

- Low-cost Android phone
- Expensive data plan; prefers offline or minimal-bandwidth
- Relies on French/Arabic interfaces; some English

---

### Journey

#### Intro

- Sees simulator entry point on public home
- Privacy notice: No answers saved or linked to identity
- Source and review date visible
- Disclaimer about information vs. legal advice

#### Question 1: What do you need?

- Multi-select or sequential needs
- **Selects:** Medical care + Housing/shelter
- **Can skip:** Proceeds without answering

#### Question 2: Where are you?

- Show a searchable, scrollable list of active cities (from `core.cities`) with localized names and optional short context (e.g., "Calais — port town", "Paris — arrondissements available").
- Include these choices: each active city row, "Not listed / Other", and "Don't know / Skip".
- If the user selects **Calais**: note that Calais has no active `city_areas` (no zone selector) and results will be city-scoped.
- If the user selects a city that has `city_areas` (e.g., Paris): open a second step to pick a zone/area.
- **Selects:** Calais
- **Does not skip:** Wants location-relevant results

#### Question 3: When do you need this?

- Algorithm dynamically generates options based on:
  - Current time (14:15 Thursday)
  - User's answers to Q1 & Q2 (Medical care + Housing/shelter, Calais)
  - Matching activities' actual schedules in `content.schedule_rules`
- **Only shows future time windows** — skips any that have already passed
- **Options generated in real-time** (not hardcoded; not shown here)
- **Selects:** One of the dynamically-generated timing options

#### Question 4: Who is this for?

- Audience filter (affects eligibility filtering)
- **Options:** Myself / Child under 18 / Adult I'm with / Family group
- **Selects:** Myself

#### Result Summary

- Displays user's answers at top
- Shows what was answered, what was skipped
- Displays as a summary card (e.g., "Medical care + Shelter, Calais, today, for myself")

#### Result Cards

- Two ranked recommendation cards
- Each shows: organization name, service type, real open hours remaining, address, distance estimate, languages, last verified date, why this result, safe contact/call button
- **MSF Clinic:** Open now, 3h 45min remaining, walk-in welcome
- **Refuge Solidarité:** Check-in opens 19:00 (4h 45min from now), walk-in welcome

#### Next Steps

- Ranked by proximity and urgency
- Call MSF now / Plan arrival at Refuge / Find fixed information / Browse directory

#### Download

- PDF generated on device; includes: summary, both results, contact details, no analytics

---

### Variations & Edge Cases

- **If answer skipped:** Result cards show "all relevant services in Calais today"
- **If no activities open:** Message explains gap; offers articles/fixed info; shows tomorrow's options
- **If zone activated:** Question 2 becomes multi-select (e.g., for Paris scenario)
- **If user selected multiple needs:** Results may split into service type groups or show mixed recommendations

---

## Scenario 2: Parent Seeking Child Care & School Registration (José)

**User Profile:**

- Spanish-speaking father with two children (ages 5 and 8)
- Recently settled in Calais; working part-time at a local business
- Moderate smartphone literacy; can read and navigate interfaces
- Has a data plan but prefers efficient use

**Context:**

- Tuesday 09:30 morning
- Children need daytime care/school options
- Wants to understand options and requirements
- May need translator or cultural information

**Device & Connectivity:**

- Mid-range Android phone
- Reasonable data; can download PDFs or watch short videos if needed
- Prefers Spanish, can read French slowly

---

### Journey

#### Intro

- Same intro screen
- Disclaimer emphasizes: "Not eligibility decision; information only"
- Source date visible: "Last reviewed 2026-07-20"

#### Question 1: What do you need?

- Broad category with subcategories visible
- **Selects:** Family services → Child care / Education
- **Alternative path:** Could select multiple if uncertain

#### Question 2: Where are you?

- Calais, no zones
- **Selects:** Yes, in Calais
- **Implicit:** Results scoped to Calais; no zone sub-filtering

#### Question 3: When do you need this?

- Algorithm dynamically generates options based on:
  - Current time (09:30 Tuesday)
  - User's answers to Q1 & Q2 (Child care + Education, Calais)
  - Matching activities' actual schedules in `content.schedule_rules`
- **Only shows future time windows** — skips any that have already passed
- **Options generated in real-time** (not hardcoded; not shown here)
- **Selects:** One of the dynamically-generated timing options

#### Question 4: Who is this for?

- Child-specific question
- **Options:** Single child (age range shown) / Multiple children / Specific family status
- **Selects:** Multiple children (ages 5 & 8)

#### Result Summary

- "Child care + Education, Calais, today 10:00+, for 2 children"
- Clarifies ages/needs

#### Result Cards

- **Card 1:** School registration program → 10:00 session today → Enrollment requirements → Safe contact for questions → Last verified date
- **Card 2:** After-school care program → Operating 15:00–18:00 (3 days/week, includes today) → Costs, signup info → Contact association
- **Card 3:** Community organization offering parent-child workshops → 14:00 today, welcome drop-in

#### Next Steps

- Call school registration now / Join workshop at 14:00 / Browse Education articles / Contact family-services directory

#### Download

- PDF includes: questions, results, how to register, important contact info, opening hours in Spanish/French side-by-side

---

### Variations & Edge Cases

- **If parent has uncertainty about child age:** Question 4 allows "Not sure" → results show broader age ranges
- **If language barrier:** PDF is downloadable in Spanish; articles may offer audio fallback
- **If none available today:** Shows "enrollment starts Friday" or "waitlist" message and next available date
- **If enrollment/legal documents required:** Links to fixed-information article about education rights and documentation

---

## Scenario 3: Volunteer Seeking Documentation & Language Support (Fatima)

**User Profile:**

- French-speaking local volunteer with NGO experience
- Works part-time with an established association but wants to expand help
- Literate, comfortable with longer text
- Using laptop at association office with good wifi

**Context:**

- Wednesday 16:00
- Wants to understand what documentation exists for vulnerable people
- Needs interpreter or translation resources
- Exploring how to refer cases to appropriate services

**Device & Connectivity:**

- Laptop with good internet
- No bandwidth constraints
- Reads French fluently; may use fixed information articles

---

### Journey

#### Intro

- Same privacy/disclaimer intro
- Note: "Simulator provides information, not case decisions"

#### Question 1: What do you need?

- Broad needs + work/coordination subset
- **Selects:** Legal information / Documentation / Interpreter services
- **Alternative:** Could search documentation index directly (not via simulator)

#### Question 2: Where are you?

- Context: Volunteer may be supporting people in different areas
- **Selects:** Calais (or could leave blank → shows all available)
- **Implicit:** May be filtering for referral purposes

#### Question 3: When do you need this?

- Algorithm dynamically generates options based on:
  - Current time (16:00 Wednesday)
  - User's answers to Q1 & Q2 (Legal information + Documentation + Interpreter services, Calais)
  - Matching organisations' actual availability
- **Only shows future time windows** — skips any that have already passed
- **Options generated in real-time** (not hardcoded; not shown here)
- **Selects:** One of the dynamically-generated timing options

#### Question 4: Who is this for?

- Modified for volunteer/intermediary use case
- **Options:** Newly arrived person / Family / Specific status (unaccompanied minor, etc.) / General resource request
- **Selects:** "General resource request" (exploring landscape, not one case)

#### Result Summary

- "Legal information + Documentation + Interpreter services, Calais, ongoing, general overview"

#### Result Cards

- **Card 1:** Legal consultation center → Hours, languages, what to bring, contact → Last verified date
- **Card 2:** Free translation/interpretation service → How to request, languages available → Contact details
- **Card 3:** Fixed-information article → "Documents you may need in Calais" → Rights, verification, safe contacts → In French with Arabic/English fallback

#### Next Steps

- Download legal-info article (in French) / Bookmark interpreter contact for future cases / Browse fixed information / Find organisations by speciality

#### Download

- PDF: Comprehensive list of legal services, interpretation contacts, document requirements, useful fixed articles → Useful for desk reference or printing

---

### Variations & Edge Cases

- **If volunteer looking for a specific case:** Question 4 changed to specific scenario → Results more targeted
- **If volunteer wants organizational info:** Simulator redirects to association directory (not a simulator decision)
- **If legal article is outdated:** Note shows "Last reviewed 2026-07-01 (22 days old) — May need update" → Encourages user to confirm
- **If no interpretation available:** Result shows "Limited availability" + list of partial options + article on working with interpreters

---

## Scenario 4: Field Worker Coordinating Emergency Response (Laurent)

**User Profile:**

- Experienced aid worker coordinating response across multiple associations
- Often in field, uses mobile frequently
- Needs fast lookup without creating account
- Verifying information from public sources

**Context:**

- Saturday 11:45 (evening, during weekend activity coordination)
- Crisis situation: tent city flooded overnight; many people need immediate shelter/hygiene facilities
- Coordinating response across 3+ organizations
- Multiple people affected, scattered locations

**Device & Connectivity:**

- Smartphone (mixed connectivity; sometimes offline)
- Low data usage preferred
- Needs shareable, printable summaries

---

### Journey

#### Intro

- Same privacy/disclaimer
- Note: "Information only; not a case decision"
- Emphasizes freshness/verification date

#### Question 1: What do you need?

- Multiple urgent categories (can multi-select)
- **Selects:** Emergency shelter / Hygiene facilities / Medical care / Clothing/supplies
- **Skips verbally naming this "emergency"** (simulator doesn't differentiate urgency)

#### Question 2: Where are you?

- Critical for coordination
- **Selects:** Calais (could be multiple areas)
- **Implicit:** Results scoped; may need to rerun for different zones if Paris-style zones existed

#### Question 3: When do you need this?

- Algorithm dynamically generates options based on:
  - Current time (23:45 Saturday)
  - User's answers to Q1 & Q2 (Emergency shelter + Hygiene + Medical + Clothing, Calais)
  - Matching activities' actual schedules
- **Only shows future time windows** — skips any that have already passed
- **Options generated in real-time** (not hardcoded; not shown here)
- **Selects:** One of the dynamically-generated timing options

#### Question 4: Who is this for?

- Modify for large group/mass response
- **Options:** Group of people / Large group (50+) / Mixed families / Vulnerable subgroup / General resource
- **Selects:** "Large group (50+)"

#### Result Summary

- "Emergency shelter + Hygiene + Medical + Clothing, Calais, today evening, large group response"
- Note: "Large group coordination may exceed single-service capacity; consider multi-organization response"

#### Result Cards

- **Card 1:** Main shelter facility → Capacity Saturday evening → Contact for group arrangements → Last verified
- **Card 2:** Hygiene station → Shower/toilet hours Saturday → First-come-first-served vs. group booking → Contact
- **Card 3:** Mobile medical clinic → Available weekend? → If yes, hours and where → Contact
- **Card 4:** Clothing distribution center → Open Saturday? → Quantity available? → Contact

#### Next Steps

- **Call main shelter NOW** / **Contact hygiene coordinator** / **Coordinate multi-org response** / **Print checklist for field teams**

#### Download

- PDF: All four results + contact details + Saturday hours summary + capacity notes → Shareable with partner organizations
- QR code linking to same information online (for when devices sync later)

---

### Variations & Edge Cases

- **If large-group request exceeds capacity:** Results show "Primary venue at capacity; secondary options available"
- **If no shelter available today:** Shows "Next available: Tomorrow 18:00" + article on emergency shelter protocols
- **If field worker needs to reach multiple areas:** Could run simulator multiple times or switch city/zone (future)
- **If offline:** Cached results show; warns "Last updated [time]"; sync when online
- **If coordinator needs to print:** PDF formatted for pocket-printing, QR codes link to full details

---

## Scenario 5: New Arrival Using Public Home to Browse (Khalid)

**User Profile:**

- Recently arrived, Arabic speaker, learning French
- Using public wifi from a café
- No mobile data; occasional access to shared devices
- Curious about what exists; not in acute crisis

**Context:**

- Friday 13:00
- Exploring InfoKit for first time
- Wants general overview of available services
- May come back later or share with friends

**Device & Connectivity:**

- Borrowed tablet from café
- Wifi available but unreliable
- Prefers to not create account

---

### Journey

#### Intro

- Public home page visible
- Notices "Simulator" as one option among many (list first, map second)
- Notices language selector: FR/EN/AR immediately visible
- **Switches to Arabic**

#### Question 1: What do you need?

- Browses all options to understand scope
- Sees: Medical / Shelter / Food / Education / Work / Legal / Language / Other
- **Selects:** Nothing specific initially; just exploring
- **Actually:** Simulator asks "Or would you like to explore without answering?" → Allows guided tour
- **Selects:** "Yes, show me what's available"

#### Question 2: Where are you?

- **Skips:** "Not sure yet" / "Show all Calais"
- Results default to city-wide overview

#### Question 3: When do you need this?

- Algorithm dynamically generates options based on:
  - Current time (13:00 Friday)
  - User's answers to Q1 & Q2 (if answered; could be skipped)
  - Available activities' actual schedules
- **Only shows future time windows** — skips any that have already passed
- **Options generated in real-time** (not hardcoded; not shown here)
- **Khalid's choice:** **Skips** — "Not time-dependent for this journey"
- **Result:** Returns all open OR regularly available services (not time-filtered)

#### Question 4: Who is this for?

- **Skips:** General exploration

#### Result Summary

- "General overview, all services in Calais, all times, for anyone"
- Displays 5–8 broad service categories with representative examples

#### Result Cards (Simplified for Overview)

- **Card:** Basic Information → "What to know when you arrive in Calais" → Overview article in Arabic
- **Card:** Food Services → Which organizations offer meals and when
- **Card:** Medical Care → Free health clinics, hours
- **Card:** Shelter Options → Overnight accommodation, how to access
- **Card:** Language Support → Interpreters and translation help

#### Next Steps

- Browse associations directory / Read fixed information / Find specific service / Download full guide

#### Download

- PDF: InfoKit welcome guide in Arabic → Basic services, key contacts, how the platform works

---

### Variations & Edge Cases

- **If user returns with specific need:** Simulator available for targeted search
- **If offline:** Cached overview shows; warns "Updated [time]"; refreshes when online
- **If user wants to save:** PDF download is main sharing method (no account needed)
- **If user wants map view:** Link to map (list always first; map as secondary option)

---

## Design Principles Across Scenarios

### 1. One Decision at a Time

- Each scenario shows exactly one question per screen
- Users can skip, go back, restart at any time
- No overwhelming form or multi-step checkout

### 2. Optional Answers

- Every answer is optional
- Skipping generates results based on remaining context
- "Don't know" is a valid answer, not an error

### 3. Session-Only Answers

- All scenarios: User's answers stay in browser session
- No persistence, no linking to identity
- Restart clears everything

### 4. Dynamic, Not Hardcoded

- Timing questions generated from real schedules
- Location options configured per city (Calais: no zones; Paris: zones)
- Results change based on current day/time

### 5. Reviewed Results Only

- All result cards show: source, last verified date, review status
- No unverified information in results
- Disclaimers explain what simulator is not (eligibility, legal advice)

### 6. Distinct from Service List

- Result cards look different from ordinary service-finder results
- Include "Why this result" reasoning visible
- Ranked by relevance to user's answers

### 7. Multimodal & Inclusive

- Short text leads each card
- Contact links/call buttons prominent
- PDF download for offline/sharing
- Fallback to text if maps/video fail
- Language support in Arabic/French/English from day one

### 8. Privacy & Transparency

- Clear upfront: "Your answers stay on your phone"
- Answers never appear in URLs, logs, analytics
- Privacy statement visible on intro screen

---

## Scope & Limitations

**Simulator provides:**

- Information about available services
- Reviewed referrals
- General guidance
- Links to safe contacts

**Simulator does NOT provide:**

- Eligibility decisions
- Legal advice
- Case management
- Personal assistance records
- Medical diagnoses or treatment recommendations

**When simulator should redirect:**

- Urgent medical issues → Direct to emergency contact
- Legal cases → Link to legal consultation services
- Sensitive situations → Link to safe-contact hotlines
- Eligibility questions → "Contact the organization directly"

---

## Dynamic Timing Algorithm Principle

**Question 3 ("When do you need this?") generates options based on current time, not hardcoded choices.**

### Rules

1. **Current Time & Timezone**
   - Read system time + user's timezone (default: Europe/Paris)
   - Example: Saturday 23:45 UTC+2 = evening/night

2. **Skip Elapsed Windows**
   - Do NOT show time periods that have already passed
   - Example at 12:40: Skip "This morning" (already passed)
   - Example at 14:15: Skip "Before 14:00" (already passed)

3. **Generate Future Windows Only**
   - Show only windows where `current_time < window_end`
   - Include "time remaining" in label (e.g., "next 4 hours")
   - Order by proximity: closest first

4. **Cross-Activity Deduplication**
   - If 5 services close at 18:00, show one option: "Today (next 4 hours, before 18:00)"
   - Not 5 identical options

5. **Day Boundary Logic**
   - If no services open today after current time → skip to "Tomorrow"
   - If midnight approaching (22:00+) → highlight "Tonight (remaining hours)"
   - Don't show "Tomorrow" if it's already past midnight

### Examples

**Current time: 12:40 (Thursday)**

- ✅ "Today (afternoon, 13:00+)"
- ✅ "Today (evening, 18:00+)"
- ✅ "Tomorrow (Friday)"
- ❌ "This morning" (12:00 already passed)

**Current time: 23:45 (Saturday)**

- ✅ "Tonight (remaining ~15 min, before 00:00)"
- ✅ "Tomorrow (Sunday, 08:00+)"
- ❌ "This morning" (passed ~14 hours ago)
- ❌ "This afternoon" (passed ~9 hours ago)
- ❌ "This evening" (partially passed; confusing)

**Current time: 06:30 (Tuesday)**

- ✅ "This morning (07:00+)"
- ✅ "This afternoon (13:00+)"
- ✅ "This week (Wed/Thu/Fri if services run those days)"
- ❌ "Before 06:00" (already passed)

**Current time: 01:15 (Sunday, overnight)**

- ✅ "Later today (08:00+)"
- ✅ "This week (Mon/Tue/etc)"
- ❌ "Last night" (already passed)
- ❌ "This evening" (not yet; show only if services exist later today)

---

## Approved Organisations & Content

- **Multi-city support:** Zones (city_areas) activate per city; same simulator engine
- **Seasonal variations:** Holiday schedules, weather-related closures, affect timing options
- **Capacity visibility:** If integrations exist, show real-time availability (reserved for Phase 2+)
- **Feedback loop:** Organisations review which simulator paths are most used; adjust content accordingly
- **Translator/mediator workflows:** Field workers may use simulator to prepare information for others

---

## Approved Organisations & Content

All scenarios assume:

- Organisations are verified in `core.organisations` with published status
- Activities linked to organisations have approved schedules in `content.schedule_rules`
- Services are tagged and linked through `content.activity_services`
- Simulator flows are reviewed by organisations before publication
- All results have documented sources in `simulator.node_sources`
