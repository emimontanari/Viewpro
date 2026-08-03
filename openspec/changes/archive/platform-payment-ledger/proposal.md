# Proposal — Platform Payment Ledger (manual billing)

**Status:** proposed, awaiting acceptance. Blocked on nothing; decision D2 (tier
list prices) is *not* a blocker — see "Amount is entered per payment".

| Item | Value |
|------|-------|
| Stage | Recta Final — Etapa 2 (autoservicio + primer cobro) |
| Slice | platform-payment-ledger |
| Objective | Record money: who paid, how much, how, when, for which period, recorded by whom — immutably — so the team can detect fraud, answer "is this tenant paid up?", and see revenue. |
| Evidence needed | Payment recorded → tenant shows paid-through date; period lapses → console shows OVERDUE without cutting access; reversal leaves both rows; non-privileged operator gets 403; audit row emitted per payment. |
| Do not touch | `apps/api` (InmoView) — money never crosses the control lane. Existing tenant status/limits semantics. The `/admin` legacy lane. |
| Done | Operator can register a payment against a tenant, the console shows paid-through and overdue state, revenue totals are visible, and every money mutation is append-only and audited. |
| Next slice | Tier list prices (D2), then MercadoPago (Etapa 3) creating the same periods automatically. |

---

## Problem

Billing is manual on purpose: an agency signs up on a free tier and an operator
enables their plan by hand once payment lands. Today that enablement is a bare
action. The system records **that** a plan was assigned, but nothing about the
money behind it: how much was paid, by what method, against which receipt, or
what period it covers.

Three consequences:

1. **No fraud control.** As the operator team grows beyond one person, nobody
   can tell an activation backed by a real transfer from one that was never
   paid for. There is no independent record to reconcile against a bank statement.
2. **No dunning signal.** Activation has no end date, so an ACTIVE tenant is
   indistinguishable from one that paid once and stopped. "Who is paid up?" is
   currently unanswerable.
3. **No revenue visibility.** There is no figure for what the product actually
   collected in a month.

## What already exists — deliberately not rebuilt

This slice adds **money**, not auditing. The following already ship and are reused:

| Capability | Where | Reused for |
|---|---|---|
| `PlatformAuditLog` — append-only, `actor`/`action`/`previousValue`/`newValue`/`occurredAt` | `openspec/specs/platform-audit-log` | Every payment mutation emits an audit row; the console feed already renders it |
| `PlatformAuditSource.VIEWPRO_NATIVE` | `apps/viewpro-api/prisma/schema.prisma` | Payments are platform-native — no InmoView outbox hop needed |
| Operator roles + `@RequirePlatformPermission` | `openspec/specs/operator-platform-roles` | New payment permissions slot into the existing catalog |
| Step-up re-auth (password, 5-min reusable window) | `openspec/specs/operator-step-up-auth` | Money mutations are gated by it, like suspend/cancel |
| `PLAN_CATALOG` + `PATCH /operators/tenants/:id/plan` | `apps/viewpro-api/src/platform-plans` | A payment references the plan it pays for; assignment stays a separate action |
| Audit feed UI (filters, drill-down) | `apps/viewpro-web/src/features/audit` | Payment actions appear there for free |

**Explicit non-goal:** re-implementing "who did what, when". That is solved.

## Decisions taken

**D1 — A payment opens a period with an end date.** Every payment records the
window it covers (`periodStart` → `periodEnd`). A tenant's paid-through date is
the latest `periodEnd` across its non-reversed payments. This is what makes
"who is paid up" and MRR answerable, and it is the same shape MercadoPago will
write into later — the gateway becomes another producer of periods, not a
model rewrite.

**D2 — Lapsing warns, it never cuts.** When the paid-through date passes, the
tenant keeps operating and the console marks it OVERDUE with days elapsed.
Suspension stays a deliberate human action behind step-up.

*Consequence — no scheduled job.* OVERDUE is **derived at read time** from the
paid-through date, not a stored state anybody has to transition. No cron, no
background worker, no nightly task that can fail silently. This is the single
biggest scope reduction in the slice and it follows directly from D2.

*Risk accepted:* an operator who never opens the console will not notice a
lapse. Mitigated by surfacing overdue counts on the dashboard, not by automation.

## Design constraints

**Money never reaches InmoView.** Design B isolation holds: `apps/api` receives
resolved limit numbers and nothing else. Amounts, methods, receipts, and periods
live exclusively in `viewpro-api`. No `platform-contract` change, no migration
in the product database.

**Amounts are stored as integer minor units** (`BigInt` cents), never floats.
Currency is recorded per payment (`ARS` initially) so the column never has to be
reinterpreted if pricing changes.

**Amount is entered per payment, not read from a price list.** Manual billing in
this market means discounts, annual prepayments, and inflation adjustments; a
fixed catalog price would be wrong more often than right. When D2 resolves,
tier list prices become a *suggested default* in the form, never a constraint on
the recorded amount. This is why D2 does not block this slice.

**Append-only with reversal, never edit or delete.** A mistaken payment is
corrected by recording a reversal that points at the original; both rows remain.
This is the property that makes the ledger admissible as fraud evidence — a row
that can be quietly edited proves nothing.

**Separation of duties.** Two new permissions, following the existing least-
privilege pattern:

| Permission | OWNER | OPERATIONS | ANALYST |
|---|---|---|---|
| `PLATFORM_PAYMENTS_READ` | ✅ | ✅ | ✅ |
| `PLATFORM_PAYMENTS_WRITE` (record) | ✅ | ✅ | ❌ |
| `PLATFORM_PAYMENTS_REVERSE` | ✅ | ❌ | ❌ |

Recording is gated by step-up, exactly like suspend/cancel. ANALYST keeps full
read access — fraud detection depends on the people who cannot write money being
able to see it.

## Scope

**In:**
- `TenantPayment` model in `viewpro-api` (append-only, reversal-linked).
- `POST /operators/tenants/:tenantId/payments` — record, step-up gated.
- `POST /operators/payments/:paymentId/reversal` — reverse, OWNER only.
- `GET /operators/tenants/:tenantId/payments` — per-tenant history.
- Derived paid-through date and OVERDUE state on tenant read models.
- Console: record-payment dialog, payment history on tenant detail, overdue
  badge and days-elapsed in the tenant list.
- Revenue summary: collected per month, split by plan.
- Audit emission (`VIEWPRO_NATIVE`) for record and reversal.

**Out:**
- Payment gateway integration (MercadoPago) — Etapa 3.
- Invoices, AFIP/ARCA electronic billing — separate legal track.
- Automatic suspension or dunning emails.
- Tenant-facing billing UI. Agencies see nothing; this is operator-only.
- Proration, upgrades/downgrades mid-period.

## Risks

| Risk | Mitigation |
|---|---|
| Money stored as float loses cents | `BigInt` minor units enforced at the schema and DTO boundary; test locks a value that breaks under float arithmetic |
| Ledger silently edited, destroying its evidentiary value | No update/delete path exists in the repository; reversal is the only correction; enforced by test |
| A lapse goes unnoticed because nobody opens the console | Overdue count surfaced on the dashboard landing; accepted consequence of D2 |
| Reversal used to hide a fraudulent entry | Reversal is OWNER-only, audited, and leaves both rows visible in history |
| Timezone drift on period boundaries | Periods stored as dates in a fixed timezone (`America/Argentina/Buenos_Aires`), asserted in tests around DST-free boundaries |
| Payment recorded against the wrong tenant | Tenant name shown in the confirmation step; reversal path documented in the runbook |

## Success criteria

1. Recording a payment makes the tenant show a paid-through date in the console.
2. A tenant whose paid-through date has passed shows OVERDUE with days elapsed,
   and **retains full access**.
3. Reversing a payment leaves both rows and restores the previous paid-through date.
4. An ANALYST attempting to record gets 403 `PERMISSION_DENIED`; an OPERATIONS
   operator attempting to reverse gets 403.
5. Recording without a fresh step-up gets 403 `STEP_UP_REQUIRED` and writes nothing.
6. Every record and reversal produces exactly one audit row, visible in the
   existing feed.
7. The revenue summary equals the sum of non-reversed payments for the period.

## Delivery — 4 PRs

| PR | Content | Rough size |
|---|---|---|
| 1 | Schema + migration + domain (money value object, period, derived paid-through) + repository. Backend only, no route. | ~350 lines |
| 2 | Record + reversal endpoints, permissions, step-up wiring, audit emission. | ~400 lines |
| 3 | Console: record dialog, payment history, overdue badge in tenant list. | ~450 lines |
| 4 | Revenue summary endpoint + dashboard panel. | ~300 lines |

Each PR ships with its tests (strict TDD is on for this repo) and stays inside
the 400-line review budget where possible; PR 3 is UI-heavy and may split.
