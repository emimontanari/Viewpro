# Tasks — Platform Payment Ledger

Strict TDD is on for this repo: every behavioral task lands its test RED first,
then GREEN. Record the RED/GREEN evidence in `apply-progress.md` as you go.

Validation commands (from `viewpro-app`):

```bash
pnpm --filter @viewpro/platform-api db:validate
pnpm --filter @viewpro/platform-api typecheck
pnpm --filter @viewpro/platform-api test
```

---

## PR 1 — Domain and ledger foundation (no routes)

Backend only. Nothing is reachable over HTTP at the end of this PR; that is
deliberate, so the money primitives are locked by tests before any surface
exists.

- [x] `money.ts`: `BigInt` minor-unit type, parse from string, reject non-integer / zero / negative, add, format. **RED first** with the summation case that is impossible under float arithmetic (`1010 + 2020 + 3030 === 6060n`, no float round-trip).
- [x] `billing-period.ts`: period value object; reject `periodEnd <= periodStart`; paid-through and overdue computation in `America/Argentina/Buenos_Aires` with the current date **injected**, never read from a global.
- [x] Tests pinning overdue at `2026-08-31T23:59` (not overdue) and `2026-09-01T00:01` (overdue, 1 day elapsed).
- [x] `schema.prisma`: `PaymentMethod` enum + `TenantPayment` model per the design, including `reversalOfPaymentId @unique` and both indexes.
- [x] Migration generated and applied against a test database. **Never `migrate dev` against anything shared.**
- [x] `payment-repository.port.ts`: `record`, `reverse`, `listByTenant`, `paidThroughByTenant`, `revenueByMonth`. **No update, no delete.**
- [x] `prisma-payment.repository.ts` implementing the port; non-reversed filtering expressed **once**, in the repository.
- [x] Test asserting the repository surface exposes no update or delete over recorded payments.
- [x] Test: `paidThroughByTenant` returns the furthest `periodEnd`, including when payments were recorded out of order, and is absent with no payments.
- [x] Test: a reversed payment stops contributing to paid-through.

**Gate:** `db:validate` + `typecheck` + `test` green.

---

## PR 2 — Endpoints, permissions, step-up, audit

- [x] Add `PAYMENTS_READ`, `PAYMENTS_WRITE`, `PAYMENTS_REVERSE` to `platform-permissions.constants.ts`.
- [x] Seed them per role in `role-permissions.ts`: READ → OWNER/OPERATIONS/ANALYST, WRITE → OWNER/OPERATIONS, REVERSE → OWNER only.
- [x] Extend `role-permissions.spec.ts` to lock the full matrix, including ANALYST's exclusion from write and OPERATIONS' exclusion from reverse.
- [x] `dto/record-payment.dto.ts`: amount **as string** → `BigInt`; currency; method; period dates; plan; optional receipt and note. Validation rejects fractional, zero, and negative amounts with 400.
- [x] `dto/reverse-payment.dto.ts`: mandatory non-empty reason.
- [x] `POST /operators/tenants/:tenantId/payments` — `AuthGuard` + `StepUpGuard` + `@RequirePlatformPermission(PAYMENTS_WRITE)`; 404 on unknown tenant; 400 on inverted period; 201 on success.
- [x] `POST /operators/payments/:paymentId/reversal` — `AuthGuard` + `StepUpGuard` + `@RequirePlatformPermission(PAYMENTS_REVERSE)`; 409 on double reversal (surfacing the unique constraint, not replacing it).
- [x] `GET /operators/tenants/:tenantId/payments` — `PAYMENTS_READ`; newest-first; reversed rows visibly marked with their reason, never hidden.
- [x] Wrap record and reverse in a single `$transaction` that also appends the `PlatformAuditLog` row with `source = VIEWPRO_NATIVE`, actions `PAYMENT_RECORDED` / `PAYMENT_REVERSED`.
- [x] Test: rolled-back transaction leaves **neither** the payment row **nor** the audit row.
- [x] Test: ANALYST gets 403 `PERMISSION_DENIED` on record and succeeds on list.
- [x] Test: OPERATIONS records successfully and gets 403 on reversal.
- [x] Test: missing step-up gets 403 `STEP_UP_REQUIRED` on both mutations, writing nothing.
- [x] Test: recording issues **no** control-lane call and modifies no tenant limits.
- [x] Register `PaymentsModule` in `app.module.ts`.

**Gate:** full API suite green; permission and step-up matrices locked by test.

---

## PR 3 — Console surfaces

- [ ] `features/payments/api/{schemas,types,service,queries}.ts` mirroring the `features/audit/` layout; amount stays a **string** across the wire.
- [ ] Record-payment dialog: amount, method, period (start/end), plan, receipt, note. Handles `403 STEP_UP_REQUIRED` by opening the step-up modal and retrying — never by logging out.
- [ ] Confirmation step shows the **tenant name** before submitting (guards against recording against the wrong tenant).
- [ ] Payment history section on tenant detail; reversed rows visibly marked with reason.
- [ ] Reversal action visible only to OWNER; hidden — not merely disabled — for other roles.
- [ ] Extend tenant summary and tenant list read models with paid-through and overdue (backend side of this PR).
- [ ] Overdue badge with days elapsed in the tenant list and detail.
- [ ] Test: an overdue tenant renders the badge and still shows all normal actions available (no access restriction implied in the UI).

**Gate:** `viewpro-web` tests green; manual pass through record → history → reverse.

---

## PR 4 — Revenue visibility

- [ ] `GET /operators/revenue/summary` — `PAYMENTS_READ`; collected minor units per calendar month, grouped by plan **and by currency**; reversed payments excluded.
- [ ] Response states the attribution rule explicitly (payments attributed to the month they were **recorded**, not the month they cover) so the figure is not misread as accrual accounting.
- [ ] Test: reversed payments excluded; per-plan totals sum to the month total.
- [ ] Dashboard revenue panel.
- [ ] **Overdue count tile on the dashboard landing** — this is the compensating control for the "warn, don't cut" decision. Without it, a lapse is only visible to someone who opens the right tenant.

**Gate:** summary figures reconcile against the ledger by hand for one seeded month.

---

## Review workload forecast

| PR | Est. changed lines | Risk tier | Lens |
|---|---|---|---|
| 1 | ~350 | Standard | `review-reliability` — money arithmetic, period boundaries, derivation correctness |
| 2 | ~400 | **High** — permissions, step-up, money mutation | Full 4R |
| 3 | ~450 | Standard | `review-readability` — UI composition; may split if it exceeds budget |
| 4 | ~300 | Standard | `review-reliability` — aggregation correctness |

PR 2 is the one that must not be rushed: it is the slice where authorization,
re-authentication, and irreversible money writes meet.

---

## Definition of done

- [ ] All 12 spec requirements have passing scenarios.
- [ ] `apply-progress.md` records RED/GREEN evidence per behavioral task.
- [ ] No update or delete path over recorded payments exists anywhere in the stack.
- [ ] No amount is represented as a floating-point number at any layer.
- [ ] `platform-contract` unchanged; `apps/api` untouched.
- [ ] Delta spec consolidated into `openspec/specs/platform-payment-ledger/` and the change archived — the cycle whose absence left 24 orphaned specs in July.
