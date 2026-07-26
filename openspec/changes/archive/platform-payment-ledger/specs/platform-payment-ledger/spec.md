# platform-payment-ledger Specification

## Purpose

The platform-payment-ledger capability records the money behind manual billing:
how much an agency paid, by what method, against which receipt, for which
period, and which operator recorded it. The ledger is append-only — a mistaken
entry is corrected by a reversal that references it, never by an edit or a
delete — so it stands as evidence when reconciling against a bank statement.
A tenant's paid-through date is derived from its non-reversed payments; a lapsed
date marks the tenant OVERDUE for operators **without** restricting the
tenant's access. Money lives exclusively in `viewpro-api`; InmoView never
receives an amount, a method, a receipt, or a period.

---

## Requirements

### Requirement: Record a Payment

`viewpro-api` MUST expose `POST /operators/tenants/:tenantId/payments`,
protected by `AuthGuard`, `StepUpGuard`, and
`@RequirePlatformPermission(PAYMENTS_WRITE)`. The request MUST carry the amount
in minor units, the currency, the payment method, the period start and end
dates, and the plan the payment is for. A receipt reference and a free-text note
MAY be supplied. The endpoint MUST persist one `TenantPayment` row recording the
acting operator's id and the recording timestamp, and MUST respond 201 with the
created payment. The request MUST be rejected 404 when the tenant does not exist
in the platform registry, and 400 when `periodEnd` is not strictly after
`periodStart`.

#### Scenario: A valid payment is recorded against a known tenant

- GIVEN an operator holding `PAYMENTS_WRITE` with a fresh step-up cookie
- AND a tenant present in the platform registry
- WHEN `POST /operators/tenants/:tenantId/payments` is called with amount `4500000` minor units, currency `ARS`, method `BANK_TRANSFER`, period `2026-08-01`→`2026-08-31`, plan `PROFESIONAL`, and receipt `8842-A`
- THEN the response status is 201
- AND exactly one `TenantPayment` row exists for that tenant
- AND the row records the acting operator's id and the recording timestamp

#### Scenario: Period end must be after period start

- GIVEN an operator holding `PAYMENTS_WRITE` with a fresh step-up cookie
- WHEN a payment is submitted with `periodStart` `2026-08-31` and `periodEnd` `2026-08-01`
- THEN the response status is 400
- AND no `TenantPayment` row is written

#### Scenario: Payment against an unknown tenant is rejected

- GIVEN an operator holding `PAYMENTS_WRITE` with a fresh step-up cookie
- WHEN a payment is submitted for a tenant id absent from the platform registry
- THEN the response status is 404
- AND no `TenantPayment` row is written

---

### Requirement: Amounts Are Integer Minor Units

Payment amounts MUST be stored and transported as integer minor units (cents),
never as floating-point values. The API MUST reject a non-integer amount, a
zero amount, and a negative amount with 400. Serialization MUST NOT convert the
amount to a JavaScript `number` in a way that loses precision for values beyond
`Number.MAX_SAFE_INTEGER`.

#### Scenario: A fractional amount is rejected

- GIVEN an operator holding `PAYMENTS_WRITE` with a fresh step-up cookie
- WHEN a payment is submitted with amount `4500.75`
- THEN the response status is 400
- AND no `TenantPayment` row is written

#### Scenario: Zero and negative amounts are rejected

- GIVEN an operator holding `PAYMENTS_WRITE` with a fresh step-up cookie
- WHEN a payment is submitted with amount `0`, and again with amount `-4500000`
- THEN both responses are 400
- AND no `TenantPayment` row is written

#### Scenario: Summing amounts is exact under values that break float arithmetic

- GIVEN three recorded payments of `1010` , `2020`, and `3030` minor units
- WHEN their total is computed by the revenue summary
- THEN the total is exactly `6060` minor units
- AND the computation never round-trips through a floating-point representation

---

### Requirement: The Ledger Is Append-Only

The payment repository MUST expose no operation that updates or deletes a
recorded payment's monetary fields (`amountMinorUnits`, `currency`, `method`,
`periodStart`, `periodEnd`, `plan`, `receiptReference`, `recordedByOperatorId`,
`recordedAt`). Correction MUST happen exclusively through the reversal path.
No HTTP route may mutate or remove an existing payment row.

#### Scenario: No update or delete path exists on the repository

- GIVEN the payment repository interface and its Prisma implementation
- WHEN their public surface is inspected
- THEN neither exposes an update or a delete operation over recorded payments
- AND the only correction operation is recording a reversal

#### Scenario: A recorded payment's monetary fields are never rewritten

- GIVEN a recorded payment
- WHEN it is later reversed
- THEN the original row's amount, currency, method, period, plan, receipt, recording operator, and recording timestamp are byte-identical to what was first written

---

### Requirement: Reversal Corrects Without Erasing

`viewpro-api` MUST expose `POST /operators/payments/:paymentId/reversal`,
protected by `AuthGuard`, `StepUpGuard`, and
`@RequirePlatformPermission(PAYMENTS_REVERSE)`. Recording a reversal MUST create
a second row linked to the original and MUST leave the original row present and
unmodified. A reversal MUST carry a mandatory reason. Reversing an
already-reversed payment MUST be rejected with 409. A reversed payment MUST NOT
contribute to the tenant's paid-through date nor to revenue totals.

#### Scenario: Reversal leaves both rows and a mandatory reason

- GIVEN a recorded payment
- AND an operator holding `PAYMENTS_REVERSE` with a fresh step-up cookie
- WHEN the payment is reversed with reason `wrong tenant`
- THEN the response status is 201
- AND both the original row and the reversal row are present
- AND the reversal references the original payment's id and stores the reason

#### Scenario: A reversal without a reason is rejected

- GIVEN a recorded payment and an operator holding `PAYMENTS_REVERSE` with a fresh step-up cookie
- WHEN a reversal is submitted with an empty reason
- THEN the response status is 400
- AND no reversal row is written

#### Scenario: Double reversal is rejected

- GIVEN a payment that has already been reversed
- WHEN a second reversal is submitted for the same payment
- THEN the response status is 409
- AND no second reversal row is written

#### Scenario: A reversed payment stops counting

- GIVEN a tenant whose only payment covers `2026-08-01`→`2026-08-31`
- WHEN that payment is reversed
- THEN the tenant's paid-through date is absent
- AND the reversed amount is excluded from revenue totals

---

### Requirement: Paid-Through Date Is Derived

A tenant's paid-through date MUST be computed as the maximum `periodEnd` across
its non-reversed payments, and MUST be absent when the tenant has no such
payment. It MUST NOT be stored as an independently writable column that can
drift from the ledger.

#### Scenario: Paid-through reflects the furthest period

- GIVEN a tenant with non-reversed payments covering `2026-08-01`→`2026-08-31` and `2026-09-01`→`2026-09-30`
- WHEN the tenant is read
- THEN its paid-through date is `2026-09-30`

#### Scenario: Out-of-order recording still yields the furthest period

- GIVEN the September payment was recorded before the August one
- WHEN the tenant is read
- THEN its paid-through date is still `2026-09-30`

#### Scenario: A tenant with no payments has no paid-through date

- GIVEN a tenant that has never been paid for
- WHEN the tenant is read
- THEN its paid-through date is absent
- AND the tenant is not reported as OVERDUE

---

### Requirement: Overdue Is Derived and Never Restricts Access

A tenant MUST be reported OVERDUE when its paid-through date exists and is
earlier than the current date, together with the number of days elapsed since
that date. OVERDUE MUST be computed at read time — it MUST NOT be persisted as
a tenant status, MUST NOT be produced by a scheduled job, and MUST NOT alter
`latestStatus`. Reporting a tenant OVERDUE MUST NOT change its limits, MUST NOT
emit a control-lane command, and MUST NOT restrict the agency's access in any way.

#### Scenario: A lapsed tenant is reported overdue with elapsed days

- GIVEN a tenant whose paid-through date is `2026-08-31`
- AND the current date is `2026-09-03`
- WHEN the tenant is read
- THEN it is reported OVERDUE with 3 days elapsed

#### Scenario: Going overdue changes nothing about access

- GIVEN a tenant that becomes overdue
- WHEN its record is read after the paid-through date passes
- THEN its `latestStatus` is unchanged
- AND its limits are unchanged
- AND no control-lane command is issued to InmoView
- AND no outbox event is produced

#### Scenario: A tenant paid through today is not overdue

- GIVEN a tenant whose paid-through date equals the current date
- WHEN the tenant is read
- THEN it is NOT reported OVERDUE

---

### Requirement: Period Boundaries Use a Fixed Timezone

Period start and end MUST be interpreted as calendar dates in
`America/Argentina/Buenos_Aires`, so that overdue computation does not shift
with the server's timezone. A payment whose period ends today MUST NOT be
overdue at any hour of that day.

#### Scenario: End-of-period day is not overdue at any hour

- GIVEN a tenant paid through `2026-08-31`
- WHEN the tenant is read at `2026-08-31T23:59` in `America/Argentina/Buenos_Aires`
- THEN it is NOT reported OVERDUE

#### Scenario: Overdue starts the following calendar day

- GIVEN the same tenant
- WHEN it is read at `2026-09-01T00:01` in `America/Argentina/Buenos_Aires`
- THEN it is reported OVERDUE with 1 day elapsed

---

### Requirement: Permission Separation for Money Operations

Three permissions MUST be added to the platform catalog and seeded per role:
`PLATFORM_PAYMENTS_READ` (OWNER, OPERATIONS, ANALYST),
`PLATFORM_PAYMENTS_WRITE` (OWNER, OPERATIONS), and
`PLATFORM_PAYMENTS_REVERSE` (OWNER only). A request lacking the required
permission MUST be rejected 403 with `PERMISSION_DENIED` and MUST NOT write.

#### Scenario: ANALYST cannot record a payment but can read the ledger

- GIVEN an operator whose role is ANALYST
- WHEN they call the record-payment endpoint
- THEN the response is 403 with code `PERMISSION_DENIED`
- AND no `TenantPayment` row is written
- AND the same operator CAN list that tenant's payments successfully

#### Scenario: OPERATIONS can record but cannot reverse

- GIVEN an operator whose role is OPERATIONS with a fresh step-up cookie
- WHEN they record a payment
- THEN the response is 201
- AND WHEN they attempt to reverse any payment
- THEN the response is 403 with code `PERMISSION_DENIED`
- AND no reversal row is written

---

### Requirement: Money Mutations Require Step-Up

Recording a payment and recording a reversal MUST both be gated by
`StepUpGuard`. A request without a fresh step-up MUST be rejected 403 with
`STEP_UP_REQUIRED` and MUST NOT write any row.

#### Scenario: Recording without step-up is blocked

- GIVEN an operator holding `PAYMENTS_WRITE` with a valid access cookie but no step-up cookie
- WHEN they call the record-payment endpoint
- THEN the response is 403 with code `STEP_UP_REQUIRED`
- AND no `TenantPayment` row is written

#### Scenario: Reversing without step-up is blocked

- GIVEN an operator holding `PAYMENTS_REVERSE` with a valid access cookie but no step-up cookie
- WHEN they call the reversal endpoint
- THEN the response is 403 with code `STEP_UP_REQUIRED`
- AND no reversal row is written

---

### Requirement: Every Money Mutation Is Audited

Recording a payment and recording a reversal MUST each append exactly one
`PlatformAuditLog` row with `source = VIEWPRO_NATIVE`, in the same database
transaction as the write. The audit row's `action` MUST be `PAYMENT_RECORDED`
or `PAYMENT_REVERSED`, its `actor` MUST identify the operator, its `tenantId`
MUST identify the tenant, and its `newValue` MUST carry the amount, currency,
method, and period. If the transaction rolls back, NO audit row may remain.

#### Scenario: Recording appends exactly one native audit row in-transaction

- GIVEN a successful payment recording
- WHEN the transaction commits
- THEN exactly one `PlatformAuditLog` row exists with `action = 'PAYMENT_RECORDED'` and `source = 'VIEWPRO_NATIVE'`
- AND its `actor` identifies the recording operator and its `newValue` carries amount, currency, method, and period

#### Scenario: Reversal appends its own audit row carrying the reason

- GIVEN a successful reversal
- WHEN the transaction commits
- THEN exactly one `PlatformAuditLog` row exists with `action = 'PAYMENT_REVERSED'`
- AND it references the reversed payment and carries the reversal reason

#### Scenario: A rolled-back payment leaves no audit row

- GIVEN a payment write whose enclosing transaction aborts
- WHEN the transaction rolls back
- THEN no `TenantPayment` row and no `PlatformAuditLog` row remain for that attempt

---

### Requirement: Payment History Endpoint

`viewpro-api` MUST expose `GET /operators/tenants/:tenantId/payments`,
protected by `@RequirePlatformPermission(PAYMENTS_READ)`, returning that
tenant's payments newest-first with their reversal state resolved, so a reversed
payment is visibly marked rather than hidden.

#### Scenario: History returns payments newest-first with reversal state

- GIVEN a tenant with three payments, the middle one reversed
- WHEN the history endpoint is called
- THEN all three payments are returned, newest first
- AND the reversed one is marked as reversed, carrying its reason

---

### Requirement: Revenue Summary

`viewpro-api` MUST expose a revenue summary, protected by
`@RequirePlatformPermission(PAYMENTS_READ)`, reporting collected minor units per
calendar month, broken down by plan. Reversed payments MUST be excluded.
Payments MUST be attributed to the month in which they were **recorded**, and
the attribution rule MUST be stated in the response so the figure is not
misread as accrual accounting.

#### Scenario: Reversed payments are excluded from the summary

- GIVEN two payments recorded in the same month, one later reversed
- WHEN the revenue summary is computed for that month
- THEN only the non-reversed payment's amount is included

#### Scenario: Revenue is broken down by plan

- GIVEN payments for `BASICO` and `PROFESIONAL` recorded in the same month
- WHEN the summary is computed
- THEN each plan's collected total is reported separately
- AND their sum equals the month's total

---

### Requirement: Money Never Crosses Into InmoView

No amount, currency, payment method, receipt reference, or period MAY be sent
over the platform-control lane, written to the InmoView database, or added to
`platform-contract`. Recording or reversing a payment MUST NOT issue a
control-lane command and MUST NOT change tenant limits.

#### Scenario: Recording a payment issues no control-lane call

- GIVEN a successful payment recording
- WHEN the request completes
- THEN no call is made to the InmoView platform-control lane
- AND no tenant limits are modified
- AND `platform-contract` carries no payment-related type

---

## Invariants

- A recorded payment's monetary fields are never updated or deleted; correction is by reversal only.
- Amounts are integer minor units end to end; no floating-point representation of money exists in the stack.
- Paid-through date is always derived from non-reversed payments, never independently writable.
- OVERDUE is computed at read time and never persisted, never scheduled, and never restricts tenant access.
- Reversal is OWNER-only; recording is OWNER/OPERATIONS; reading is available to all roles including ANALYST.
- Both money mutations require a fresh step-up and emit exactly one `VIEWPRO_NATIVE` audit row in the same transaction.
- A reversed payment contributes to neither paid-through nor revenue, yet remains visible in history.
- Money never reaches `apps/api`, the control lane, or `platform-contract`.
