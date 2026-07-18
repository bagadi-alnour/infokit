# Calais Info — Landscape and Positioning

> `PRODUCT.md` is the canonical product requirements document. This document maps who already provides information to exiled people in and around Calais, what gap remains, and how Calais Info relates to each actor. Success is measured by people getting current information — not by this platform beating another.

**Status:** Living document — key facts web-verified 17 July 2026; items marked *verify* are Phase 0 tasks
**Doctrine:** partner-first. Interoperate before duplicating; duplicate only what is demonstrably missing.

## 1. Actors

| Actor | What it is | Languages | Channel | Calais coverage | Relationship strategy |
| --- | --- | --- | --- | --- | --- |
| **Watizat** | Association publishing monthly info guides for exiled people since 2018 | FR, EN, AR, Pashto, Dari | Print + PDF | Paris, Lyon, Toulouse, Oise editions active in 2026; **no current Calais edition found** (*verify history and why*) | Model + potential partner; method exchange; print complements web |
| **Soliguide (Solinum)** | National digital directory of solidarity services; free, anonymous, multilingual; ~38 départements, national ambition; **open API on data.gouv.fr** | Multiple | Web | ***Verify first*** — search soliguide.fr for Calais | The most important check in Phase 0 (see §3) |
| **Channel Info Project / Refugee Info Bus** (L'Auberge des Migrants) | Info along the UK–France border (project launched Nov 2022); RIB since 2016: wifi, charging, legal info, WhatsApp | Multiple incl. AR | Field presence, WhatsApp, social | Calais / Grande-Synthe (*verify current activity*) | Closest local analogue; ideal first intermediary partner — their responders as first users (`DISTRIBUTION.md`) |
| **InfoMigrants** | News service (France Médias Monde/DW) with practical guides; active Calais tag | FR, EN, AR, Dari, Pashto, Bengali | Web, social | News-level, not schedule-level | Complementary; no dependency |
| **Local operational associations** — L'Auberge des Migrants, Utopia 56, Secours Catholique, Médecins du Monde, Refugee Community Kitchen, Calais Food Collective, Collective Aid, Salam, La Cabane Juridique, HRO (*verify each in Phase 0*) | Service providers; each communicates via its own Facebook/Instagram/WhatsApp/paper | Varies | Fragmented | They **are** Calais | Not competitors — these are the factual owners the product serves and the source of every record |
| **WhatsApp/Facebook/Telegram groups, word of mouth** | The real information network | All | Messaging | Total | Not replaceable — feed it (share-cards designed for forwarding) |
| **Google Maps / search** | Default first reflex on any smartphone | All | Web | Aid services poorly represented, often stale | Opportunity: SEO + accurate structured data |
| **State/institutional** (préfecture, OFII, PADA operators) | Official procedure information | FR mostly | Web, paper | Procedures, not daily services | Not a data partner at this stage; audience trust barrier (R8) |

## 2. Gap analysis

| Capability | Watizat | Soliguide | Channel Info/RIB | InfoMigrants | Groups/WoM | **Calais Info target** |
| --- | --- | --- | --- | --- | --- | --- |
| Calais-specific service detail | (no current edition) | *verify* | ✔ field | ✖ | ✔ | ✔ |
| Day-level freshness with visible verification | ✖ monthly print | partial | conversation-level | ✖ | no provenance | ✔ **core differentiator** |
| Multilingual incl. AR/Ps/Dari | ✔ | partial | partial | ✔ | ✔ | ✔ |
| No account, anonymous | ✔ | ✔ | ✔ | ✔ | ✖ (needs group access) | ✔ |
| Maintained by the responsible orgs | ✖ centrally edited | partial | ✖ | ✖ | ✖ | ✔ (Phase 2 premise) |
| Works without phone/battery/data | ✔ **print wins** | ✖ | ✔ in person | ✖ | ✖ | partial (print export, offline PWA) |

The open slot is a **verified current-state layer for Calais**: is it open now, who provides it, when was that last checked. Honest caveat: the slot is empty because filling it costs continuous organisational labor — the absence of a Watizat Calais edition is evidence of the cost, not just of the opportunity. That is risk R1, and it is the pilot's central question.

## 3. The Soliguide decision (Phase 0, week 1)

Check soliguide.fr coverage of Calais and contact Solinum. Three outcomes:

1. **Soliguide covers Calais well** → do not build a duplicate directory. Reposition: Calais-freshness layer and association workspaces (Phases 2–4), contributing public data to Soliguide through their API.
2. **Soliguide covers Calais thinly or not at all** → Calais Info fills the gap; design the schema export so records can later be contributed to or synced with Soliguide rather than fragmenting the national picture.
3. **Partnership** → Calais Info becomes the Calais maintenance loop for data that also lives in Soliguide.

In all three outcomes: interoperability beats duplication, and the conversation with Solinum happens **before** public launch.

## 4. If the premise fails

If no association will own its data (R1 fires), the fallback positions are, in order: contribute verified Calais data to Soliguide; support Watizat in reviving a Calais edition (web tooling for their print workflow); run a smaller platform-editor-only service with an honest record count. The project's goal — current information reaching people — survives the platform not surviving.

## 5. Naming check

"Calais Info" is generic and adjacent to municipal/local-news naming (*verify collisions: mairie communications, local media such as Nord Littoral*). For the audience, the name must signal independence from authorities (R8). Decide the public name before Wave 2 distribution; the working title can stand until then.

The project's stated ambition is global with Calais as the first territory. That argues for an umbrella brand with per-territory names ("X — Calais") rather than an identity locked to one city — but do not spend naming energy on hypothetical territories before the Calais pilot proves the model (see `PRODUCT.md` §2 and §23).

## 6. Phase 0 verification checklist

- [ ] soliguide.fr: search Calais; count and quality of records; contact Solinum about API/coverage.
- [ ] Watizat: did a Calais edition exist, when, and why did it stop? Method exchange call.
- [ ] Channel Info Project / RIB: current activity, channels, willingness to pilot as intermediary.
- [ ] Each association in §1: current channels, who updates them, appetite for a monthly verification loop.
- [ ] Existing posters/QR/info points physically present in Calais today.
- [ ] Name collision scan and final public name.

## Sources

- [Watizat](https://watizat.org/en/) — guides index (Paris, Lyon, Toulouse, Oise; 2026 editions)
- [Soliguide](https://soliguide.fr/fr) · [Solinum — Soliguide](https://solinum.org/soliguide) · [data.gouv.fr — API Solidarité](https://www.data.gouv.fr/dataservices/solidarite)
- [Calais Appeal — Channel Info Project / Refugee Info Bus](https://www.calaisappeal.org/refugee-info-bus)
- [InfoMigrants — Calais tag](https://www.infomigrants.net/en/tag/calais/)
