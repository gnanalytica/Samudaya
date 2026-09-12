# Samudaya — product specification

Derived from the clickable HTML prototype. **The prototype is the source of
truth for behaviour**; this document is the working translation of it into a
domain model, and should be updated alongside it.

> "Plan together. Participate together. Spend transparently."
>
> Every event has its own people, activities, tasks, fund and transparent ledger.

---

## The central idea

This is **not** a facilities-management app. The organising unit is the
**event** — Ganesh Chaturthi, Sports Day, a Cultural Evening. Everything else
hangs off one:

```
Event
├── Checklist        tasks with owner, due date, status → drives "Readiness %"
├── Fund             target, contributions, contributors
├── Activities       cultural acts residents sign up to perform in
├── Volunteer roles  jobs residents sign up to do
├── Expenses         vendor, amount, attached bill, approval trail
└── Closure          surplus rule → published transparency report
```

A resident can see, at any moment: how ready the event is, how much has been
collected, exactly what has been spent and on what, with the bill attached.
That transparency is the product.

---

## Roles

| Role          | Can                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Resident**  | Contribute, join activities, volunteer, suggest activities, vote in polls and fund reallocations, read the full ledger |
| **Committee** | Coordinate activities and volunteer roles, work the checklist                                                          |
| **Admin**     | Create and publish events, approve expenses, approve join requests, close events                                       |
| **Owner**     | Everything, plus transferring ownership                                                                                |

---

## Flows

### Resident onboarding

1. Enter the **Society ID** the admin shared (`MHR-4827`).
2. Pick **tower → flat**, give name and mobile.
3. Request goes to the admin as a **join request**.
4. Admin approves → resident is in.

Invite codes remain as a second path: a code that is already approved, so the
resident skips the waiting step.

### Admin onboarding

1. Community name, flat count, tower count, city.
2. Add flats — manually or by spreadsheet import (preview before confirm).
3. Society ID is generated and shown.
4. Invite residents by WhatsApp / SMS / link / QR.

### Creating an event (7-step wizard)

1. **Details** — name, date, venue, description, expected attendance
2. **Budget** — line items; the total becomes the fund target
3. **Requirements** — toggles (religious, decoration, food, sound, cultural, volunteers, photography, kids) that seed the checklist
4. **Cultural activities** — the acts residents can join
5. **Checklist** — auto-generated from requirements, editable
6. **Fund rule** — what happens to a surplus, decided _before_ money is collected
7. **Preview** — exactly what residents will see, then publish

### Contributing

Pick a preset or custom amount → choose UPI / card / net banking → confirm →
receipt with an ID. The event fund and contributor count update.

### Expenses

A committee member submits an expense with a bill. An admin approves, rejects,
or requests changes. **Only approved expenses appear in the resident ledger**,
and every one shows its vendor, amount, requester, approver and bill.

### Fund reallocation

Surplus cannot be moved on an admin's say-so. The committee proposes a transfer
with a reason; residents vote; it passes only at the configured threshold
(60% by default). The result is written to an audit trail.

### Closing an event

Shows collected / spent / remaining, task completion, bills uploaded, and the
surplus destination fixed at creation. Publishing closes the event and issues
the **transparency report**: full breakdown, every bill, audit history and
participation figures.

---

## Screens

**Resident** — splash · join society · select flat · request sent · home ·
events list · event detail · contribute (amount → payment → receipt) ·
activities list · activity detail · activity joined · suggest activity ·
volunteer list · volunteer confirm · accounts · view bill · fund reallocation
vote · community feed · polls · notifications · my activity

**Admin** — welcome · add flats · import preview · community created · invite
residents · dashboard · create-event wizard · event management (overview,
tasks, expenses, approvals, reports) · add expense · expense approval ·
event closure · final report

---

## Derived values

| Value             | Definition                    |
| ----------------- | ----------------------------- |
| Readiness %       | completed tasks ÷ total tasks |
| Fund raised       | Σ successful contributions    |
| Spent             | Σ **approved** expenses       |
| Available         | raised − spent                |
| Volunteers needed | role target − signed up       |

These are computed from the underlying rows, never stored and hand-updated.

---

## Deliberately out of scope

The prototype covers none of these, and they are **not** part of the product:
maintenance dues and recurring invoices, visitor/gate passes, amenity booking,
service requests and complaints. An earlier build of this repository included
them; they were removed when this specification arrived.
