# Design — Platform Payment Ledger

## Approach

A new `payments/` module in `viewpro-api`, following the existing module shape
(`platform-control/`, `platform-data/`): controller + DTOs + repository port with
a Prisma adapter + `__tests__/`. No new architectural pattern is introduced.

The ledger is the only writer of money. Everything a reader needs — paid-through
date, overdue state, revenue — is **derived from it** rather than stored
alongside it, so no second source of truth can drift.

### Why derived instead of stored

A `paidThroughAt` column on `PlatformTenant` would be faster to read and would
be wrong the first time anyone writes it out of band. `PlatformTenant` is
already an event-sourced projection where exactly one column (`plan`) is
command-written, and that exception carries a comment explaining its drift-clear
recompute. Adding a second command-written column that must stay in lockstep
with a separate table is how projections rot.

At current scale the derivation is a `MAX(periodEnd) WHERE NOT reversed GROUP BY
tenantId` over a table with tens of rows. If it ever becomes a real cost, the
fix is a materialized read model recomputed from the ledger — not a hand-written
column.

## Target files

### New — `apps/viewpro-api/src/payments/`

| File | Responsibility |
|---|---|
| `payments.module.ts` | Wiring; imports `PermissionsModule`, `DatabaseModule`, audit repository |
| `payments.controller.ts` | `POST /operators/tenants/:tenantId/payments`, `POST /operators/payments/:paymentId/reversal`, `GET /operators/tenants/:tenantId/payments` |
| `revenue.controller.ts` | `GET /operators/revenue/summary` |
| `dto/record-payment.dto.ts` | Amount as string→BigInt, currency, method, period dates, plan, receipt, note; class-validator rules |
| `dto/reverse-payment.dto.ts` | Mandatory reason |
| `payment-repository.port.ts` | Port: `record`, `reverse`, `listByTenant`, `paidThroughByTenant`, `revenueByMonth`. **No update, no delete** |
| `prisma-payment.repository.ts` | Adapter; wraps write + audit emit in one `$transaction` |
| `money.ts` | `BigInt` minor-unit helpers, currency type, parse/format at the boundary |
| `billing-period.ts` | Period value object; paid-through and overdue computation in `America/Argentina/Buenos_Aires` |
| `__tests__/` | Controller, repository, money, period, and permission-matrix specs |

### Modified

| File | Change |
|---|---|
| `apps/viewpro-api/prisma/schema.prisma` | Add `TenantPayment` model + `PaymentMethod` enum; migration |
| `apps/viewpro-api/src/permissions/platform-permissions.constants.ts` | Add `PAYMENTS_READ`, `PAYMENTS_WRITE`, `PAYMENTS_REVERSE` |
| `apps/viewpro-api/src/permissions/role-permissions.ts` | Seed the three per role; `role-permissions.spec.ts` locks the matrix |
| `apps/viewpro-api/src/platform-data/tenant-detail.controller.ts` | Tenant summary gains paid-through + overdue |
| `apps/viewpro-api/src/platform-data/*tenant-list*` | Tenant list rows gain paid-through + overdue |
| `apps/viewpro-api/src/app.module.ts` | Register `PaymentsModule` |

### New — `apps/viewpro-web/src/features/payments/`

Mirrors the existing `features/audit/` layout (`api/{queries,schemas,service,types}.ts`,
`components/`, co-located `__tests__/`): record-payment dialog with step-up
handling, payment history table, overdue badge, revenue panel.

### Modified — console

| File | Change |
|---|---|
| `features/tenants/**` (list + detail) | Overdue badge with days elapsed; "Registrar pago" action; payment history section |
| Dashboard landing | Overdue count tile — the compensating control for D2's "warn, don't cut" |

## Data model

```prisma
enum PaymentMethod {
  BANK_TRANSFER
  CASH
  MERCADOPAGO_LINK
  OTHER
}

model TenantPayment {
  id                  String        @id @default(uuid())
  tenantId            String
  amountMinorUnits    BigInt
  currency            String        @default("ARS")
  method              PaymentMethod
  plan                String
  periodStart         DateTime      @db.Date
  periodEnd           DateTime      @db.Date
  receiptReference    String?
  note                String?

  recordedByOperatorId String
  recordedAt           DateTime     @default(now())

  // Reversal linkage — a reversal row points at the payment it cancels.
  reversalOfPaymentId String?       @unique
  reversalOfPayment   TenantPayment? @relation("PaymentReversal", fields: [reversalOfPaymentId], references: [id])
  reversedBy          TenantPayment? @relation("PaymentReversal")
  reversalReason      String?

  @@index([tenantId, periodEnd])
  @@index([recordedAt])
  @@map("tenant_payments")
}
```

**`reversalOfPaymentId` is `@unique`** — that single constraint is what makes
double reversal impossible at the database level rather than only in a service
check that a concurrent request could race past. The 409 in the spec is the
friendly surface over it.

A reversal row carries `amountMinorUnits` equal to the original as a positive
value; it is identified as a reversal by `reversalOfPaymentId` being non-null,
not by a negative amount. Queries filter with `reversalOfPaymentId IS NULL AND
id NOT IN (SELECT reversalOfPaymentId ...)` — expressed once in the repository,
never restated in callers.

## Money handling

`BigInt` end to end. Prisma maps `BigInt` to PostgreSQL `bigint`; the DTO
accepts the amount as a **string** and parses to `BigInt`, because a JSON number
beyond `Number.MAX_SAFE_INTEGER` is already corrupted before validation runs.
Serialization back out is a string for the same reason. `money.ts` owns parse,
validate, add, and format; nothing outside it touches raw amount arithmetic.

Currency is stored per row and defaults to `ARS`. Multi-currency totals are out
of scope: the revenue summary groups by currency and never sums across them.

## Timezone

Periods are calendar dates (`@db.Date`), not instants. Overdue compares "today
in `America/Argentina/Buenos_Aires`" against `periodEnd`. Argentina has no DST,
which removes the usual ambiguity, but the timezone is stated explicitly rather
than relying on the server's clock so a container in UTC behaves identically.
`billing-period.ts` takes the current date as an injected dependency so tests
pin it instead of stubbing globals.

## Transaction boundary

Record and reverse each run as one `$transaction`: write the payment row, then
append the `PlatformAuditLog` row with `source = VIEWPRO_NATIVE`. This mirrors
the existing in-transaction audit emit that `platform-audit-log` already
specifies for status and limits changes — same guarantee, same failure mode: if
the audit append fails, the money write rolls back with it. A payment that
exists without its audit row is exactly the state this slice is meant to prevent.

## Validation

Per `openspec/config.yaml` testing block, from `viewpro-app`:

- `pnpm --filter @viewpro/platform-api db:validate`
- `pnpm --filter @viewpro/platform-api typecheck`
- `pnpm --filter @viewpro/platform-api test`
- Console: existing `viewpro-web` test command

Strict TDD is on: every requirement in the spec lands RED first, with the
evidence recorded in `apply-progress.md`.

Specific tests that must exist because they encode decisions rather than
mechanics:

- A summation whose exact result is impossible under float arithmetic.
- Repository surface assertion: no update/delete over recorded payments.
- Permission matrix: ANALYST reads and is refused writes; OPERATIONS records and
  is refused reversal.
- Overdue at `23:59` on the period-end day, and at `00:01` the next day.
- Rolled-back transaction leaves neither payment nor audit row.
- Recording issues no control-lane call.

## Rollout

Additive: a new table, three new permissions, new routes, new UI. No existing
route changes shape, no data migration, no backfill. Tenants already active keep
operating exactly as they do now — they simply have no paid-through date until
someone records their first payment.

Deploy order: migrate `viewpro-api` (Paso 4 of the go-live runbook, `DIRECT_URL`),
then the API, then the console. The console degrades cleanly against an
un-migrated API because every payment surface is additive.

## Non-goals

Payment gateway integration, invoices, AFIP/ARCA, automatic suspension, dunning
emails, tenant-facing billing UI, proration, multi-currency totals.

## Open question for the operator, not a blocker

Historical payments already collected out of band are **not** backfilled by this
slice. If they should be, that is a separate seeded import with its own audit
trail — recording them by hand through the UI is also valid at current volume,
and leaves a truthful `recordedAt`.
