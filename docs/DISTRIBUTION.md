# InfoKit — Awareness and Distribution Plan

> `PRODUCT.md` is the canonical product requirements document. This document plans how anyone in Calais ever learns the product exists. Building the platform creates zero awareness; distribution is scheduled work with owners and measures, not a hope.

**Status:** Living document — last reviewed 17 July 2026

## 1. Principle

In this context, trust travels person-to-person. Exiled people get information from other exiled people, from aid workers, and from forwarded WhatsApp messages — not from app stores or advertising. Therefore:

- **The first users are aid workers, not exiled people.** Every field worker who trusts the tool multiplies it to dozens of people a day.
- **Information must travel well when forwarded.** The unit of distribution is a shared message, not a visit.
- **No promotion before verification.** Distributing a tool with wrong data burns trust once and permanently (R7, R8 in `RISKS.md`).

## 2. Waves, tied to delivery gates (`PRODUCT.md` §8.1)

| Wave                  | When (gate)                         | Audience                                                                               | Action                                                                                                                                                  | Success signal                            |
| --------------------- | ----------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 0 — Internal          | Slice 1 verification loop           | Staff/volunteers of the 3–5 loop orgs                                                  | They use the private site as their own lookup tool during the loop                                                                                      | They open it unprompted between meetings  |
| 1 — Intermediaries    | G1 soft launch                      | Channel Info/RIB responders, day-centre staff, mediators, interpreters, legal drop-ins | Quiet URL + 1-page toolkit (FR/EN); share button demo; ask them to answer real questions with it                                                        | Weekly active intermediaries; shares sent |
| 2 — Physical presence | Verified content ≥ agreed threshold | People in Calais directly                                                              | A6 cards and A3 posters at day centres, distributions, charging points, PASS, org locals — **with each org's permission**                               | Scans/short-link visits per site          |
| 3 — Organic           | Ongoing after Wave 2                | Search and social                                                                      | SEO (server-rendered pages, hreflang, service+city queries such as "douche gratuite calais"); org websites linking; partners posting in existing groups | Search impressions; non-FR sessions       |

We do not post directly into community WhatsApp/Facebook groups ourselves — partners with existing standing do, when they judge it useful.

## 3. WhatsApp-native sharing (product requirement)

Every public service/record gets a **Share** action producing a localized plain-text snippet designed to survive forwarding:

```
Demo evening food distribution — OPEN today 18:00–20:00
Demo location, Calais
Checked 16 July · All public
https://…/s/abc123
```

The snippet is honest even if the link is never opened (status, time, checked date). This is the single most important distribution feature and belongs in Slice 0 scope. A printable per-service card (same content, QR) serves paper flows.

_Feed back into `PRODUCT.md`: share-snippet requirement; short stable URLs._

## 4. Materials

- **A6 card / A3 poster:** icon-led, five launch languages, QR **plus a short memorable URL** (QR alone excludes people), and three words of promise: _free · no account · no name_. Framing is neutral — "local services information", never "app for migrants" (stigma and targeting risk, R5/R8). No photographs of people.
- **Generated, not hand-made:** flyers and cards come from the workspace flyer tool (`FR-P1-039` / `FR-P2-022`): choose a record, languages, and format; the QR code, short URL, and verification date are stamped automatically, and the same flyer is published as a downloadable PDF in the public Downloads section — the physical and digital versions never diverge.
- **Org toolkit page** (`/partners`): what this is, who runs it, how to send corrections, printable materials, the share feature.
- **Transparency page:** who operates it, who funds it, what is not collected (supports R8; see `SUSTAINABILITY.md`).

## 5. Measurement without surveillance

Consistent with `NFR-010` and the privacy posture:

- Cookieless, aggregate analytics only (self-hosted); no user IDs, no fingerprinting, no geolocation logging, no answer values ever.
- Channel-coded short links (poster/share/organic) counted in aggregate.
- Qualitative: during pilot weeks, mediators ask "how did you hear about this?" and tally answers on paper.
- Indicative Wave 2 targets (set properly at G1): ~100 sessions/week within 8 weeks; ≥40% of sessions in non-French languages (the audience test); returning intermediaries week over week. Misses trigger R2's response: stop feature work, fix distribution.

## 6. What we deliberately do not do

- No paid advertising targeting migrants.
- No direct push messaging to the public (no accounts exist — by design).
- No municipal press or official launch events at Stage A/B (R8; reassess later).
- No branding or imagery that photographs or singles out the audience.
- No public launch of a record set the providing orgs haven't verified.
