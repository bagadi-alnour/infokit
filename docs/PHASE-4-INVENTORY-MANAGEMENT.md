# Phase 4 — Inventory Management

> This document elaborates Phase 4. `PRODUCT.md` is the canonical product requirements document and takes precedence if scope or terminology differs.

## Objective

Help verified associations track physical resources across storage locations, events, missions, kits, and transfers while keeping recipient identity and restricted financial values out of ordinary stock workflows.

Phase 4 depends on Phase 3 memberships, roles, audit, teams, missions, and notifications.

## Users

- Organisation administrator.
- Inventory manager.
- Stock operator.
- Transfer approver.
- Financial viewer with a separate permission.
- Inventory viewer/auditor.

Publishing, coordination, document, inventory, financial, and possible future assistance permissions remain separate.

## Capabilities

### Locations and catalogue

- Create organisation storage locations with status, responsible team, internal directions, and access-note classification.
- Maintain item categories, items, variants, units, scan identifiers, translated labels, and active/archived state.
- Configure item tracking for lot/batch, expiry, condition, or serial only where needed.
- Search items/locations and scan barcodes or QR codes on mobile with manual fallback.

### Stock ledger and counts

- Post append-only movements for receipts, donations, purchases, adjustments, damage, expiry, transfers, reservations/releases, kit assembly/disassembly, and distributions.
- Calculate balances by location, item/variant, lot, condition, and reservation state.
- Correct a posted mistake with a compensating movement and reason; do not edit or delete posted lines.
- Run physical counts, show expected quantity snapshots and variances, then create reviewed adjustments.
- Keep unit cost, replacement value, and source documents behind a separate financial permission.

### Reservations, kits, and distribution

- Reserve stock for a public event, private mission, or kit batch and release unused quantity.
- Maintain approved, versioned kit definitions with components, quantities, units, substitutions, and effective dates.
- Assemble or disassemble kits through linked ledger movements.
- Record anonymous aggregate distributions by item/kit, quantity, location/date, and optional event.
- Do not create or link beneficiary profiles for ordinary distribution.

### Transfers

- Transfer stock between locations with dispatch, in-transit, partial receipt, discrepancy, completion, and cancellation states.
- Offer stock to another verified organisation without exposing unrelated balances, costs, locations, suppliers, or members.
- Require a destination inventory admin to accept before cross-organisation receipt.
- Let both parties add transfer notes and retain shared transfer history.
- Post separate source/destination ledger movements linked to the same accepted transfer.

### Alerts and imports

- Configure minimum/preferred stock and expiry-warning windows by location/item.
- Create low-stock, out-of-stock, expiry-soon, and expired alerts with acknowledgement/resolution state.
- Import approved CSV item/opening-balance data through field mapping, unit validation, duplicate checks, preview, row errors, idempotent commit, and compensating batch reversal.
- Link an inventory shortage to an operational/public review task without publishing stock counts or changing a service/event automatically.

## Primary Workflows

### Receive stock

1. Stock operator selects the location and scans or searches for an item.
2. Operator enters quantity/unit, source, condition, and required lot/expiry data.
3. Preview shows the movements and projected balance.
4. Operator posts the receipt.
5. The ledger updates balances and relevant alerts.

### Record anonymous distribution

1. Stock operator selects a location and optional linked public event/private mission.
2. Operator scans/selects items or kits and enters aggregate quantities.
3. The product shows available/reserved balance and any conflict.
4. Operator posts the distribution without recipient identity.

### Transfer to another organisation

1. Source inventory admin selects items, quantities, source location, destination organisation, logistics, and offer expiry.
2. Destination inventory admin accepts, declines, or adds a note.
3. Acceptance reserves stock; source dispatch moves it into transit.
4. Destination records received quantities and discrepancies.
5. Each organisation receives its own ledger entries and the shared transfer retains both decisions.

### Correct a stock mistake

1. Authorised operator opens the posted movement.
2. Operator selects **Correct**, provides a reason, and enters the compensating quantities.
3. Preview shows the original and correction together.
4. Posting preserves both movements and refreshes the calculated balance.

## Required Screens

| ID    | Screen                                                |
| ----- | ----------------------------------------------------- |
| P4-01 | Inventory overview, alerts, and recent movements      |
| P4-02 | Storage locations                                     |
| P4-03 | Item/category/variant catalogue                       |
| P4-04 | Item balances, lots, expiry, and movement history     |
| P4-05 | Receive, adjust, damage, expire, and distribute stock |
| P4-06 | Internal transfer dispatch/receipt                    |
| P4-07 | Cross-organisation transfer offers/acceptance         |
| P4-08 | Reservations linked to events/missions                |
| P4-09 | Kit definitions and assembly/disassembly              |
| P4-10 | Low-stock and expiry alerts                           |
| P4-11 | Barcode/QR scan and manual fallback                   |
| P4-12 | Inventory CSV import preview/results/reversal         |

## Privacy and Security

- Do not store recipient identities, assistance notes, or eligibility data in inventory records.
- Restrict costs/replacement values and source financial documents through a separate permission.
- Require reasons for adjustments, reversals, discrepancies, and destructive state changes.
- Keep cross-organisation transfer access limited to the two parties and the shared transfer data.
- Recheck organisation/permission context in every posting, acceptance, dispatch, receipt, and reversal transaction.
- Record movement/import/transfer actors and timestamps in append-only audit history.

## Phase 4 Exit Criteria

- Pilot organisations reconcile calculated balances with physical counts for agreed locations/items.
- Stock operators complete the movement types used in the pilot without editing posted history.
- Cross-organisation transfer requires destination acceptance and preserves tenant isolation.
- Anonymous distribution works without a recipient account or assistance record.
- Alerts identify configured shortages and expiring lots.
- Financial-field access, imports/reversal, unit handling, permissions, and ledger invariants pass review.
- Pilot administrators complete inventory workflows in French and English.

## Not in Phase 4

- Beneficiary profiles, named distribution histories, household records, or eligibility decisions.
- Full procurement, invoicing, accounts payable, general ledger, budgeting, or donor CRM.
- Payroll, HR, fleet, route optimisation, or warehouse robotics.
- Public stock quantities without a later approved public-information requirement.
